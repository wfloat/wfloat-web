import { AudioPlayer } from "../speech/audioPlayer.js";
import { SpeechClient } from "../speech/speechClient.js";
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
        // Ignore stale streams if a new generation started
        // if (!AudioPlayer.isAcceptingStream(message.id)) return;

        // Lock onto the first stream id we see (optional but useful)
        // AudioPlayer.setActiveStreamId(message.id);

        // AudioPlayer.addSamples(message.samples);

        // Decide when to start actual playback:
        // You can use your model's timing hints OR buffered audio amount (or both).
        //
        // - message.tRuntime and message.tPlayAudio are your model's notion of
        //   "runtime" and "when audio should start".
        // - AudioPlayer.getBufferedSeconds() is real buffered audio in the worklet.
        //
        const onProgressCallback = SpeechClient.getOnProgressCallback();
        SpeechClient.player!.enqueue(message.samples, 22050, () => {
          if (!onProgressCallback) return;

          onProgressCallback({
            progress: message.progress,
            isPlaying: SpeechClient.player?.isPlaying ?? false,
            textHighlightStart: message.highlightStart,
            textHighlightEnd: message.highlightEnd,
            text: message.text,
          });
        });
        const shouldStart = message.tRuntime >= message.tPlayAudio;
        if (shouldStart) {
          // Open the gate so scheduling begins *but only if the user hasn't paused*.
          // (If the user never pressed Play, this will just buffer until they do.)
          SpeechClient.player!.setStartGateOpen(true);
        }
        if (shouldStart && !SpeechClient.player!.isPausedByUser) void SpeechClient.player!.play();

        // // const state = AudioPlayer.getState();
        // console.log(`Audio player state ${state}`);
        // if (shouldStart && (state === "waiting" || state === "primed")) {
        //   void AudioPlayer.play();
        // }

        return;
      }

      // if (message.type === "speech-generate-chunk") {
      //   console.log(message.id, message.index);
      //   // AudioPlayer.addSamples(message.samples);
      //   if (message.progress < 1) {
      //     // AudioPlayer.addSilence();
      //   }
      //   if (message.tRuntime >= message.tPlayAudio) {
      //     if (// AudioPlayer workerId matches this message and the AudioPlayer is in a waiting state (not playing or paused)) {
      //       console.log("START PLAYING AUDIO NOW!!!!!");
      //       //   void AudioPlayer.play().catch((error) => {
      //       //     console.warn("AudioPlayer.play() failed", error);
      //       //   });
      //     }
      //   } else {
      //     console.log("NOT YET!!");
      //   }
      //   return;
      // }

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
