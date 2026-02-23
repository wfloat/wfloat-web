import { AudioPlayer } from "../audioPlayer.js";
import { WorkerRequest, WorkerRequestTemplate, WorkerResponse } from "./workerTypes.js";

export class WorkerClient {
  private static id: number = 1;
  private static worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  private static initialized = false;
  private static pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();

  private static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === "speech-generate-chunk") {
        console.log(message);
        // AudioPlayer.addSamples(message.samples);
        if (message.progress < 1) {
          // AudioPlayer.addSilence();
        }
        if (message.tRuntime >= message.tPlayAudio) {
          // if (AudioPlayer.getStatus() === "waiting") {
          //   console.log("START PLAYING AUDIO NOW!!!!!");
          //   void AudioPlayer.play().catch((error) => {
          //     console.warn("AudioPlayer.play() failed", error);
          //   });
          // }
        }
        return;
      }

      if (message.type === "speech-load-model-done") {
        // AudioPlayer.setSampleRate(message.sampleRate);
      }

      // if (message.type === "speech-terminate-early-done") {
      //   Atomics.store(this.terminateEarlyView, 0, 0);

      //   this.terminateEarlyResolve?.();
      //   this.terminateEarlyResolve = null;
      //   this.terminateEarlyPromise = null;
      //   return;
      // }

      const pendingRequest = this.pending.get(message.id);
      if (!pendingRequest) return;

      this.pending.delete(message.id);

      if (message.type === "request-error") {
        pendingRequest.reject(new Error(message.error));
        return;
      }

      pendingRequest.resolve(message);
    };

    this.worker.onerror = (event: ErrorEvent) => {
      const error = new Error(event.message || "Worker error");
      for (const [id, pendingRequest] of this.pending.entries()) {
        this.pending.delete(id);
        pendingRequest.reject(error);
      }
    };
  }

  // static async terminateSpeechGenerateEarly(): Promise<void> {
  //   this.init();

  //   if (this.terminateEarlyPromise) {
  //     // already waiting for speech generation to terminate
  //     return this.terminateEarlyPromise;
  //   }

  //   this.terminateEarlyPromise = new Promise<void>((resolve) => {
  //     this.terminateEarlyResolve = resolve;
  //   });

  //   Atomics.store(this.terminateEarlyView, 0, 1);

  //   return this.terminateEarlyPromise;
  // }

  static async postMessage(workerRequestTemplate: WorkerRequestTemplate) {
    this.init();

    return new Promise((resolve, reject) => {
      this.pending.set(this.id, { resolve, reject });

      const request: WorkerRequest = {
        id: this.id,
        ...workerRequestTemplate,
      };

      this.id += 1;

      this.worker.postMessage(request);
    });
  }
}
