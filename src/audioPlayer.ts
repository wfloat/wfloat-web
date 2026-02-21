export class AudioPlayer {
  private static audioContext: AudioContext | null = null;
  private static gainNode: GainNode | null = null;
  private static sampleRate: number = 44100;

  private static nextStartTime: number = 0;
  private static isPlaying: boolean = false;
  private static scheduledSources: AudioBufferSourceNode[] = [];

  // private static masterBuffer: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(0));

  // --- Initialization ---
  public static setSampleRate(sampleRate: number): void {
    if (this.audioContext) {
      throw new Error("Cannot change sample rate after initialization.");
    }
    if (this.sampleRate != sampleRate) {
      this.recreate();
    }
    this.sampleRate = sampleRate;
  }

  private static ensureContext(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  // --- Add audio samples ---
  public static addSamples(samples: Float32Array): void {
    this.ensureContext();
    if (!this.audioContext || !this.gainNode) return;

    const buffer = this.audioContext.createBuffer(1, samples.length, this.sampleRate);
    buffer.copyToChannel(samples as any, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    source.start(this.nextStartTime);
    this.scheduledSources.push(source);

    this.nextStartTime += buffer.duration;
  }

  // --- Add silence ---
  public static addSilence(paddingSeconds: number = 0.1): void {
    const length = Math.floor(this.sampleRate * paddingSeconds);
    const silence = new Float32Array(length);
    this.addSamples(silence);
  }

  // --- Playback control ---
  public static async play(): Promise<void> {
    this.ensureContext();
    if (!this.audioContext) return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
  }

  public static async pause(): Promise<void> {
    if (!this.audioContext) return;

    if (this.audioContext.state === "running") {
      await this.audioContext.suspend();
    }

    this.isPlaying = false;
  }

  // --- Volume control ---
  public static setVolume(volume: number): void {
    this.ensureContext();
    if (!this.gainNode) return;

    this.gainNode.gain.value = Math.max(0, volume);
  }

  public static getVolume(): number {
    if (!this.gainNode) return 1;
    return this.gainNode.gain.value;
  }

  // --- Cleanup ---
  public static clear(): void {
    if (!this.audioContext) return;

    for (const src of this.scheduledSources) {
      try {
        src.stop();
      } catch {}
    }

    this.scheduledSources = [];

    // Reset timeline so new audio starts immediately
    this.nextStartTime = this.audioContext.currentTime;
  }

  private static recreate(): void {
    if (this.scheduledSources.length) {
      for (const src of this.scheduledSources) {
        try {
          src.stop();
        } catch {}
      }
    }

    this.scheduledSources = [];
    this.nextStartTime = 0;
    this.isPlaying = false;

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.gainNode = null;
  }
}
