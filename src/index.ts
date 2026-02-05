import { getSherpaOnnxVersion, createOfflineTts } from "./wasm/sherpa-onnx-tts.js";
// @ts-ignore
import createSherpaModule from "./wasm/sherpa-onnx-wasm-main-tts.js";

const moduleConfig = {
  // locateFile: (path: string) => {
  //   console.log(`Locating file ${path}`);
  //   if (path.endsWith(".wasm")) {
  //     return "https://registry.wfloat.com/assets/sherpa-onnx-wasm-main-tts.wasm";
  //   }
  //   if (path.endsWith(".data")) {
  //     return "https://registry.wfloat.com/assets/sherpa-onnx-wasm-main-tts.data";
  //   }
  //   // Fallback for other files (though unlikely needed)
  //   return path;
  // },
  // // Optional: Add print/printErr for logging, or other config like noExitRuntime: true
  // print: console.log,
  // printErr: console.error,
};

export async function getVersion() {
  const sherpaOnnxModule = await createSherpaModule(moduleConfig);
  console.log(getSherpaOnnxVersion(sherpaOnnxModule));

  console.log(sherpaOnnxModule.FS.readdir("/"));

  return getSherpaOnnxVersion(sherpaOnnxModule);
}

export async function validateTtsOnPage() {
  // create wasm module
  const Module = await createSherpaModule();

  // create tts
  const tts = createOfflineTts(Module);

  console.log("Sample rate:", tts.sampleRate);
  console.log("Num speakers:", tts.numSpeakers);

  const start = performance.now();

  // generate audio
  const audio = tts.generate({
    text: "If you hear this, T T S works.",
    sid: 0,
    speed: 1.0,
  });

  const end = performance.now();
  console.log(`tts.generate took ${(end - start).toFixed(2)} ms`);

  // write wav using existing package code
  const filename = "validate.wav";
  tts.save(filename, audio);

  // extract wav from emscripten fs
  const wav = Module.FS.readFile(filename);

  // surface it
  const blob = new Blob([wav.buffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);

  const el = document.createElement("audio");
  el.controls = true;
  el.src = url;
  document.body.appendChild(el);

  // cleanup
  tts.free();
  Module.FS.unlink(filename);
  Module._free?.(); // no-op if not present
}

async function main() {
  console.log(await getVersion());
  validateTtsOnPage();
}

main();
