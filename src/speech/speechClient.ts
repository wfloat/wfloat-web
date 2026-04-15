import { AudioPlayer } from "./audioPlayer.js";
import {
  LoadModelOnProgressEvent,
  LoadModelOptions,
  SpeechClientStatus,
  SpeechGenerateOptions,
  SpeechGenerateDialogueOptions,
  SpeechOnProgressEvent,
} from "./speechTypes.js";
import { WorkerClient } from "../worker/workerClient.js";
import { getPersistentId, setPersistentId } from "../util/persistentIdStorage.js";

export class SpeechClient {
  private static status: SpeechClientStatus = "off";
  public static player: AudioPlayer | null = null;
  private static loadModelOnProgressCallback: ((event: LoadModelOnProgressEvent) => void) | null =
    null;
  private static generateOnProgressCallback: ((event: SpeechOnProgressEvent) => void) | null = null;

  static async loadModel(modelId: string, options: LoadModelOptions = {}): Promise<void> {
    if (this.status === "loading-model") {
      console.warn(
        `Received multiple SpeechClient.loadModel(...) calls in rapid succession. Ignoring most recent loadModel call with modelId "${modelId}".`,
      );
    } else {
      this.status = "loading-model";
      this.loadModelOnProgressCallback = options.onProgressCallback ?? null;
      try {
        const cachedPersistentId = getPersistentId();
        console.log(`persisted id here: ${cachedPersistentId}`);
        const response = await WorkerClient.postMessage({
          type: "speech-load-model",
          modelId,
          ...(cachedPersistentId ? { persistentId: cachedPersistentId } : {}),
        });
        if (response.type !== "speech-load-model-done") {
          throw new Error(`Unexpected worker response type: ${response.type}`);
        }
        setPersistentId(response.persistentId);
        this.player = new AudioPlayer({
          inputSampleRate: 22050,
          scheduleAheadSec: 0.5,
          tickMs: 50,
        });
        this.loadModelOnProgressCallback?.({ status: "completed" });
        this.status = "idle";
      } catch (error) {
        this.status = "off";
        throw error;
      } finally {
        this.loadModelOnProgressCallback = null;
      }
    }
  }

  static async generate(options: SpeechGenerateOptions): Promise<void> {
    if (this.status === "terminating-generate") {
      console.warn(
        `Received multiple SpeechClient.generate(...) calls in rapid succession. Ignoring most recent generate call with input text "${options.text.length > 100 ? options.text.slice(0, 100) + "..." : options.text}".`,
      );
      return;
    }

    const wasGenerating = this.status === "generating";

    this.player?.primeForUserGesture();
    await this.player?.lock();
    try {
      await this.player?.resetForNewGeneration();

      if (wasGenerating) {
        this.status = "terminating-generate";
        console.warn("TRYING TO TERMINATE EARLY");
        await WorkerClient.postMessage({ type: "speech-terminate-early" });
      }

      this.status = "generating";
      this.generateOnProgressCallback = options.onProgressCallback ?? null;
      this.player?.setOnFinishedPlayingCallback(options.onFinishedPlayingCallback ?? null);

      const { onProgressCallback, onFinishedPlayingCallback, ...workerOptions } = options;

      this.player?.unlock();
      await WorkerClient.postMessage({
        type: "speech-generate",
        options: workerOptions,
      });
      // console.log("SPEECH GENERATION COMPLETE");
      this.player?.markGenerationComplete();
      this.generateOnProgressCallback = null;
      this.status = "idle";
    } finally {
      this.player?.unlock();
    }
  }

  static async generateDialogue(options: SpeechGenerateDialogueOptions): Promise<void> {
    if (this.status === "terminating-generate") {
      const inputText = options.segments.map((e) => e.text).join(" ");

      console.warn(
        `Received multiple SpeechClient.generate(...) calls in rapid succession. Ignoring most recent generate call with input text "${inputText.length > 100 ? inputText.slice(0, 100) + "..." : inputText}".`,
      );
      return;
    }

    const wasGenerating = this.status === "generating";

    this.player?.primeForUserGesture();
    await this.player?.lock();
    try {
      await this.player?.resetForNewGeneration();

      if (wasGenerating) {
        this.status = "terminating-generate";
        console.warn("TRYING TO TERMINATE EARLY");
        await WorkerClient.postMessage({ type: "speech-terminate-early" });
      }

      this.status = "generating";
      this.generateOnProgressCallback = options.onProgressCallback ?? null;
      this.player?.setOnFinishedPlayingCallback(options.onFinishedPlayingCallback ?? null);

      const { onProgressCallback, onFinishedPlayingCallback, ...workerOptions } = options;

      this.player?.unlock();
      await WorkerClient.postMessage({
        type: "speech-generate-dialogue",
        options: workerOptions,
      });
      // console.log("SPEECH GENERATION COMPLETE");
      this.player?.markGenerationComplete();
      this.generateOnProgressCallback = null;
      this.status = "idle";
    } finally {
      this.player?.unlock();
    }
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
    return this.generateOnProgressCallback;
  }

  static getLoadModelOnProgressCallback(): ((event: LoadModelOnProgressEvent) => void) | null {
    return this.loadModelOnProgressCallback;
  }

  // static async free(): Promise<void> {
  //   if (this.tts) {
  //     this.tts.free();
  //     this.tts = null;
  //   }
  //   this.sherpaModule = null;
  // }
}
