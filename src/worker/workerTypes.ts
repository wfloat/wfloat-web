import {
  LoadModelOnProgressEvent,
  SpeechGenerateOptions,
  SpeechGenerateDialogueOptions,
} from "../speech/speechTypes";

export type WorkerRequestTemplate =
  | { type: "speech-load-model"; modelId: string }
  | { type: "speech-generate"; options: SpeechGenerateWorkerOptions }
  | { type: "speech-generate-dialogue"; options: SpeechGenerateDialogueWorkerOptions }
  | { type: "speech-terminate-early" };

export type WorkerRequest = WorkerRequestTemplate & { id: number };

export type WorkerResponse =
  | { id: number; type: "speech-load-model-done"; sampleRate: number }
  | { id: number; type: "speech-load-model-progress"; event: LoadModelOnProgressEvent }
  | { id: number; type: "speech-generate-done" }
  | { id: number; type: "request-error"; error: string }
  | {
      id: number;
      type: "speech-generate-chunk";
      samples: Float32Array;
      index: number;
      silencePaddingSec: number;
      progress: number;
      tRuntime: number;
      tPlayAudio: number;
      highlightStart: number;
      highlightEnd: number;
      text: string;
    }
  | { id: number; type: "speech-terminate-early-done" };

export type SpeechGenerateWorkerOptions = Omit<
  SpeechGenerateOptions,
  "onProgressCallback" | "onFinishedPlayingCallback"
>;

export type SpeechGenerateDialogueWorkerOptions = Omit<
  SpeechGenerateDialogueOptions,
  "onProgressCallback" | "onFinishedPlayingCallback"
>;

export type GetModelAssetsArgs = {
  modelId: string;
  platform: string;
  version: string;
};

export type ModelAssetsResponse = {
  model_onnx: string;
  model_tokens: string;
  wasm_binary: string;
  wasm_data: string;
};
