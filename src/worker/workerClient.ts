import { SpeechClient } from "../speech/speechClient.js";
import { WorkerRequest, WorkerRequestTemplate, WorkerResponse } from "./workerTypes.js";
// @ts-ignore
import workerCode from "./worker-inline.js";

const blob = new Blob([workerCode], { type: "text/javascript" });
const CHUNK_SAMPLE_RATE = 22050;

export class WorkerClient {
  private static id: number = 1;
  private static worker = new Worker(URL.createObjectURL(blob), { type: "module" });
  private static initialized = false;
  private static pending = new Map<
    number,
    { resolve: (value: WorkerResponse) => void; reject: (err: Error) => void }
  >();

  private static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === "speech-load-model-progress") {
        const pendingRequest = this.pending.get(message.id);
        if (!pendingRequest) {
          console.warn(
            `Ignoring 'speech-load-model-progress' response received from the web worker with id: '${message.id}' but there is no speech-load-model message in the queue with this id.`,
          );
          return;
        }

        SpeechClient.getLoadModelOnProgressCallback()?.(message.event);
        return;
      }

      if (message.type === "speech-generate-chunk") {
        const pendingRequest = this.pending.get(message.id);
        if (!pendingRequest) {
          console.warn(
            `Ignoring 'speech-generate-chunk' response received from the web worker with id: '${message.id}' but there is no speech-generate message in the queue with this id.`,
          );
          return;
        }

        const player = SpeechClient.player;
        if (!player || player.isLocked) return;

        const onProgressCallback = SpeechClient.getOnProgressCallback();
        player.enqueue(message.samples, CHUNK_SAMPLE_RATE, () => {
          if (!onProgressCallback) return;

          onProgressCallback({
            progress: message.progress,
            isPlaying: player.isPlaying,
            textHighlightStart: message.highlightStart,
            textHighlightEnd: message.highlightEnd,
            text: message.text,
          });
        });
        if (message.progress < 1 && message.silencePaddingSec > 0) {
          player.enqueueSilence(message.silencePaddingSec, CHUNK_SAMPLE_RATE);
        }
        // The timing heuristic is only useful while more audio may still arrive.
        // For the final chunk, leaving the gate closed can deadlock playback:
        // the chunk stays buffered, nothing schedules, and finished never fires.
        const shouldStart = message.progress >= 1 || message.tRuntime >= message.tPlayAudio;
        if (shouldStart && !player.isStartGateOpen) {
          // Open the gate so scheduling begins *but only if the user hasn't paused*.
          // (If the user never pressed Play, this will just buffer until they do.)
          player.setStartGateOpen(true);
          if (!player.isPausedByUser) {
            console.log("calling play");
            void player.play();
          }
        }

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

  static async postMessage(workerRequestTemplate: WorkerRequestTemplate): Promise<WorkerResponse> {
    this.init();

    return new Promise<WorkerResponse>((resolve, reject) => {
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
