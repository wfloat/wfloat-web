import { SpeechClientGenerateOptions } from "../speech/speechTypes";

export type WorkerRequestTemplate =
  | { type: "speech-load-model"; modelId: string }
  | { type: "speech-generate"; options: SpeechClientGenerateOptions };

export type WorkerRequest = WorkerRequestTemplate & { id: number };

export type WorkerResponse =
  | { id: number; type: "speech-load-model-done" }
  | { id: number; type: "speech-generate-done"; wavBuffer: ArrayBuffer }
  | { id: number; type: "request-error"; error: string };
