// @ts-ignore
import createModule from "./sherpa-onnx-wasm-main-tts.js";

let modulePromise: Promise<any> | null = null;

export function getModule() {
  if (!modulePromise) {
    modulePromise = createModule({
      locateFile(path: string) {
        return new URL(path, import.meta.url).toString();
      },
    });
  }
  return modulePromise;
}
