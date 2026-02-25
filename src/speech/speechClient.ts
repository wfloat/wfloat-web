import { AudioPlayer } from "./audioPlayer.js";
import { SpeechClientStatus, SpeechGenerateOptions, SpeechOnProgressEvent } from "./speechTypes.js";
import { WorkerClient } from "../worker/workerClient.js";

export class SpeechClient {
  private static status: SpeechClientStatus = "off";
  public static player: AudioPlayer | null = null;
  private static onProgressCallback: ((event: SpeechOnProgressEvent) => void) | null = null;

  static async loadModel(modelId: string): Promise<void> {
    if (this.status === "loading-model") {
      console.warn(
        `Received multiple SpeechClient.loadModel(...) calls in rapid succession. Ignoring most recent loadModel call with modelId "${modelId}".`,
      );
    } else {
      this.status = "loading-model";
      // console.log("Starting speech model load");
      await WorkerClient.postMessage({
        type: "speech-load-model",
        modelId,
      });
      this.player = new AudioPlayer({
        inputSampleRate: 22050,
        scheduleAheadSec: 0.5,
        tickMs: 50,
      });
      // console.log("Speech model loaded complete!");
      this.status = "idle";
    }
  }

  static async generate(options: SpeechGenerateOptions): Promise<void> {
    // AudioPlayer.clear();
    if (this.status === "generating") {
      this.status = "terminating-generate";
      await WorkerClient.postMessage({ type: "speech-terminate-early" });
    } else if (this.status === "terminating-generate") {
      console.warn(
        `Received multiple SpeechClient.generate(...) calls in rapid succession. Ignoring most recent generate call with input text "${options.text.length > 100 ? options.text.slice(0, 100) + "..." : options.text}".`,
      );
      return;
    }

    this.status = "generating";
    this.onProgressCallback = options.onProgressCallback ?? null;

    const { onProgressCallback, ...workerOptions } = options;

    await WorkerClient.postMessage({
      type: "speech-generate",
      options: workerOptions,
    });
    // console.log("SPEECH GENERATION COMPLETE");
    this.onProgressCallback = null;
    this.status = "idle";
  }

  static async play(): Promise<void> {
    if (!this.player) {
      console.warn("SpeechClient.play() ignored because the audio player is not initialized.");
      return;
    }
    if (!this.player.isStartGateOpen) {
      console.warn("SpeechClient.play() ignored because audio is not ready to play yet.");
      return;
    }
    await this.player.play();
  }

  static async pause(): Promise<void> {
    if (!this.player) {
      console.warn("SpeechClient.pause() ignored because the audio player is not initialized.");
      return;
    }
    if (!this.player.isStartGateOpen) {
      console.warn("SpeechClient.pause() ignored because audio is not ready to play yet.");
      return;
    }
    await this.player.pause();
  }

  static getOnProgressCallback(): ((event: SpeechOnProgressEvent) => void) | null {
    return this.onProgressCallback;
  }

  // static async free(): Promise<void> {
  //   if (this.tts) {
  //     this.tts.free();
  //     this.tts = null;
  //   }
  //   this.sherpaModule = null;
  // }
}
