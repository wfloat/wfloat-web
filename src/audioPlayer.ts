export class AudioPlayer {
  private static audioContext: AudioContext | null = null;
  private static gainNode: GainNode | null = null;

  private static sampleRate: number = 22050;

  // Single accumulated mono buffer (grows as samples are added)
  private static masterBuffer: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(0));

  private static sourceNode: AudioBufferSourceNode | null = null;

  private static isPlaying: boolean = false;
  private static playbackStartTime: number = 0; // AudioContext time
  private static playbackOffset: number = 0; // seconds into buffer

  private static volume: number = 1.0;

  // -----------------------------
  // Configuration
  // -----------------------------

  public static setSampleRate(rate: number): void {
    if (this.audioContext) {
      throw new Error("Cannot change sample rate after initialization.");
    }
    this.sampleRate = rate;
  }

  private static ensureInitialized(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: this.sampleRate,
      });

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  // -----------------------------
  // Buffer Management
  // -----------------------------

  public static addSamples(samples: Float32Array<ArrayBufferLike>): void {
    this.ensureInitialized();

    const combined = new Float32Array(this.masterBuffer.length + samples.length);

    combined.set(this.masterBuffer, 0);
    combined.set(samples, this.masterBuffer.length);

    this.masterBuffer = combined;
  }

  public static addSilence(paddingSeconds: number = 0.1): void {
    const frameCount = Math.floor(this.sampleRate * paddingSeconds);
    const silence = new Float32Array(frameCount); // already zeroed
    this.addSamples(silence);
  }

  // -----------------------------
  // Playback Control
  // -----------------------------

  public static async play(): Promise<void> {
    this.ensureInitialized();
    if (!this.audioContext || !this.gainNode) return;
    if (this.isPlaying) return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    if (this.playbackOffset >= this.getDuration()) {
      // If at end, reset to beginning
      this.playbackOffset = 0;
    }

    const remainingFrames =
      this.masterBuffer.length - Math.floor(this.playbackOffset * this.sampleRate);

    if (remainingFrames <= 0) return;

    const audioBuffer = this.audioContext.createBuffer(1, remainingFrames, this.sampleRate);

    const offsetFrames = Math.floor(this.playbackOffset * this.sampleRate);

    audioBuffer.copyToChannel(this.masterBuffer.subarray(offsetFrames), 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.playbackOffset = 0;
      }
    };

    this.sourceNode = source;

    this.playbackStartTime = this.audioContext.currentTime;
    source.start(0);

    this.isPlaying = true;
  }

  public static pause(): void {
    if (!this.audioContext || !this.isPlaying) return;

    const elapsed = this.audioContext.currentTime - this.playbackStartTime;

    this.playbackOffset += elapsed;

    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {}
    }

    this.sourceNode = null;
    this.isPlaying = false;
  }

  public static stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {}
    }

    this.sourceNode = null;
    this.playbackOffset = 0;
    this.isPlaying = false;
  }

  // -----------------------------
  // Volume
  // -----------------------------

  public static setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  public static getVolume(): number {
    return this.volume;
  }

  // -----------------------------
  // Cleanup
  // -----------------------------

  public static async free(): Promise<void> {
    this.stop();
    this.masterBuffer = new Float32Array(0);

    if (this.audioContext) {
      await this.audioContext.close();
    }

    this.audioContext = null;
    this.gainNode = null;
  }

  // -----------------------------
  // Utilities
  // -----------------------------

  public static getDuration(): number {
    return this.masterBuffer.length / this.sampleRate;
  }

  public static getCurrentTime(): number {
    if (!this.audioContext) return 0;
    if (!this.isPlaying) return this.playbackOffset;

    return this.playbackOffset + (this.audioContext.currentTime - this.playbackStartTime);
  }
}
