// AudioPlayer.ts
// HTTP-safe fallback streaming mono PCM player (Float32Array chunks).
// No AudioWorklet, no SharedArrayBuffer.
// Never drops unplayed audio.
// Supports: play/pause/clear, “start gate” (delay scheduling until shouldStart),
// underrun => silence (nothing scheduled), seamless when chunks arrive in time.

export type AudioPlayerOptions = {
  /** Sample rate of incoming chunks (your worker output). */
  inputSampleRate?: number; // default 22050

  /** Sample rate hint for AudioContext; browser may ignore and pick hardware rate. */
  contextSampleRateHint?: number; // default 22050

  /** Keep this much audio scheduled into the future (seconds). */
  scheduleAheadSec?: number; // default 0.5

  /** Scheduler tick interval (ms). */
  tickMs?: number; // default 50

  /** Small cushion so we don’t schedule “in the past”. */
  safetySec?: number; // default 0.02

  /** Fade time for pause/resume to reduce clicks. */
  rampSec?: number; // default 0.01

  /**
   * Start-gate initial state:
   * - true  => normal behavior (schedules as soon as you play)
   * - false => won’t schedule until you call setStartGateOpen(true)
   */
  startGateInitiallyOpen?: boolean; // default true
};

function resampleLinear(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate) return input;
  const ratio = outRate / inRate;
  const outLen = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLen);

  for (let i = 0; i < outLen; i++) {
    const t = i / ratio;
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = t - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class AudioPlayer {
  private readonly inputSampleRate: number;
  private readonly scheduleAheadSec: number;
  private readonly tickMs: number;
  private readonly safetySec: number;
  private readonly rampSec: number;

  private readonly ctx: AudioContext;
  private readonly gain: GainNode;

  // Not-yet-scheduled audio
  private queue: AudioBuffer[] = [];
  private queuedSec = 0;

  // Sources already scheduled (so clear() can stop them)
  private scheduled = new Set<AudioBufferSourceNode>();

  // Next scheduled start time in AudioContext time
  private nextTime = 0;

  private timer: number | null = null;
  private disposed = false;

  // User intent: true if user wants playback (i.e., not paused)
  private playRequested = false;
  // Tracks an explicit user pause separately from the initial "not yet played" state.
  private pausedByUserExplicitly = false;

  // Gate: when false, we do NOT schedule any audio (useful for your tRuntime/tPlayAudio logic)
  private startGateOpen: boolean;

  constructor(opts: AudioPlayerOptions = {}) {
    this.inputSampleRate = opts.inputSampleRate ?? 22050;
    this.scheduleAheadSec = opts.scheduleAheadSec ?? 0.5;
    this.tickMs = opts.tickMs ?? 50;
    this.safetySec = opts.safetySec ?? 0.02;
    this.rampSec = opts.rampSec ?? 0.01;
    this.startGateOpen = opts.startGateInitiallyOpen ?? true;

    this.ctx = new AudioContext({
      sampleRate: opts.contextSampleRateHint ?? this.inputSampleRate,
      latencyHint: "interactive",
    });

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(this.ctx.destination);

    // Start paused
    void this.ctx.suspend();
    this.nextTime = this.ctx.currentTime + this.safetySec;

    this.startScheduler();
  }

  /** True only when user wants play AND the context is running AND the gate is open. */
  get isPlaying(): boolean {
    return this.playRequested && this.startGateOpen && this.ctx.state === "running";
  }

  /** True if the user has paused (so your code can avoid auto-starting). */
  get isPausedByUser(): boolean {
    return this.pausedByUserExplicitly;
  }

  /**
   * If user pressed Play but gate is closed (waiting for shouldStart),
   * state is "waiting" instead of "playing".
   */
  get state(): "paused" | "waiting" | "playing" {
    if (!this.playRequested) return "paused";
    return this.startGateOpen ? "playing" : "waiting";
  }

  /** How many seconds of audio are buffered (queued + already scheduled ahead). */
  getBufferedSeconds(): number {
    const now = this.ctx.currentTime;
    const scheduledAhead = Math.max(0, this.nextTime - now);
    return scheduledAhead + this.queuedSec;
  }

  /** Enqueue a mono chunk (sequential). */
  enqueue(samples: Float32Array, sampleRate = this.inputSampleRate): void {
    if (this.disposed) throw new Error("AudioPlayer is disposed");
    if (samples.length === 0) return;

    const pcm = resampleLinear(samples, sampleRate, this.ctx.sampleRate);

    const buf = this.ctx.createBuffer(1, pcm.length, this.ctx.sampleRate);
    buf.copyToChannel(pcm as any, 0);

    this.queue.push(buf);
    this.queuedSec += buf.duration;
  }

  /**
   * Optional helper if you receive a transferred ArrayBuffer + known length.
   * If you send Float32Array directly (recommended), you don't need this.
   */
  enqueueTransferred(buffer: ArrayBuffer, length: number, sampleRate = this.inputSampleRate): void {
    const view = new Float32Array(buffer, 0, length);
    this.enqueue(view, sampleRate);
  }

  /**
   * Open/close the “start gate”.
   * - While closed: nothing schedules, so audio does NOT get consumed.
   * - When opened: we re-anchor nextTime to "now + safety" and start scheduling.
   */
  setStartGateOpen(open: boolean): void {
    if (this.disposed) return;

    const wasOpen = this.startGateOpen;
    this.startGateOpen = open;

    if (!wasOpen && open) {
      // Start scheduling from "now" so we don't have a big silent gap from old nextTime.
      this.nextTime = this.ctx.currentTime + this.safetySec;
    }
  }

  /** Convenience: call this each chunk with your shouldStart boolean. */
  updateShouldStart(shouldStart: boolean): void {
    // Only opens (never auto-closes) unless you explicitly want to close it.
    if (shouldStart) this.setStartGateOpen(true);
  }

  /**
   * Start/resume playback. Must be called from a user gesture in many browsers.
   * Idempotent: safe to call multiple times.
   */
  async play(): Promise<void> {
    if (this.disposed) throw new Error("AudioPlayer is disposed");

    this.playRequested = true;
    this.pausedByUserExplicitly = false;

    // If already running, nothing else needed.
    if (this.ctx.state === "running") return;

    // Fade-in (when we actually resume)
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(0, t);
    this.gain.gain.linearRampToValueAtTime(1, t + this.rampSec);

    await this.ctx.resume();
  }

  /**
   * Pause without consuming buffered audio; resume continues at the correct sample.
   * Idempotent: safe to call multiple times.
   */
  async pause(): Promise<void> {
    if (this.disposed) return;
    this.pausedByUserExplicitly = true;
    if (!this.playRequested) return;

    this.playRequested = false;

    if (this.ctx.state !== "running") return;

    // Fade-out then suspend (reduces click)
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + this.rampSec);

    await sleep(Math.ceil(this.rampSec * 1000));
    await this.ctx.suspend();
  }

  /**
   * Drop all queued + scheduled audio and reset timeline.
   * Does NOT change user intent (playRequested) or gate state.
   */
  clear(): void {
    if (this.disposed) return;

    for (const s of this.scheduled) {
      try {
        s.stop();
      } catch {
        // ignore
      }
    }
    this.scheduled.clear();

    this.queue.length = 0;
    this.queuedSec = 0;

    this.nextTime = this.ctx.currentTime + this.safetySec;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;

    this.clear();
    await this.ctx.close();
  }

  // ---- internal scheduling loop ----

  private startScheduler(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), this.tickMs);
  }

  private tick(): void {
    if (this.disposed) return;

    // Do not schedule unless:
    // - user wants play, and
    // - start gate is open
    if (!this.playRequested || !this.startGateOpen) return;

    const now = this.ctx.currentTime;

    // If we underrun or got reset, re-anchor.
    if (this.nextTime < now + this.safetySec) {
      this.nextTime = now + this.safetySec;
    }

    const horizon = now + this.scheduleAheadSec;

    while (this.nextTime < horizon && this.queue.length > 0) {
      const buf = this.queue.shift()!;
      this.queuedSec -= buf.duration;
      this.scheduleBuffer(buf);
    }

    // If queue is empty, we schedule nothing => silence until more chunks arrive.
  }

  private scheduleBuffer(buf: AudioBuffer): void {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);

    this.scheduled.add(src);
    src.onended = () => this.scheduled.delete(src);

    src.start(this.nextTime);
    this.nextTime += buf.duration;
  }
}
