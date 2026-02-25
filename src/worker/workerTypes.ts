import { SpeechGenerateOptions } from "../speech/speechTypes";

export type WorkerRequestTemplate =
  | { type: "speech-load-model"; modelId: string }
  | { type: "speech-generate"; options: SpeechGenerateWorkerOptions }
  | { type: "speech-terminate-early" };

export type WorkerRequest = WorkerRequestTemplate & { id: number };

export type WorkerResponse =
  | { id: number; type: "speech-load-model-done"; sampleRate: number }
  | { id: number; type: "speech-generate-done" }
  | { id: number; type: "request-error"; error: string }
  | {
      id: number;
      type: "speech-generate-chunk";
      samples: Float32Array;
      index: number;
      progress: number;
      tRuntime: number;
      tPlayAudio: number;
      highlightStart: number;
      highlightEnd: number;
    }
  | { id: number; type: "speech-terminate-early-done" };

export type SpeechGenerateWorkerOptions = Omit<SpeechGenerateOptions, "onProgressCallback">;
