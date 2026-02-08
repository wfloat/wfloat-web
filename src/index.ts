import {
  // getSherpaOnnxVersion,
  createOfflineTts,
  // OfflineTtsConfig,
} from "./wasm/sherpa-onnx-tts.js";
// @ts-ignore
import createSherpaModule from "./wasm/sherpa-onnx-wasm-main-tts.js";

// const STAGE = "LOCAL"; // "PROD"

// const REGISTRY_URL = STAGE === "PROD" ? "https://registry.wfloat.com" : "";

const moduleConfig = {
  locateFile: (path: string) => {
    console.log(`Locating file ${path}`);
    if (path.endsWith(".wasm")) {
      return "/assets/sherpa-onnx-wasm-main-tts.wasm";
    }
    if (path.endsWith(".data")) {
      return "/assets/sherpa-onnx-wasm-main-tts.data";
    }

    return path;
  },
  print: console.log,
  printErr: (s: string) => console.error("wasm:", s),
  onAbort: (what: any) => console.error("wasm abort:", what),
};

// export async function getVersion() {
//   const sherpaOnnxModule = await createSherpaModule(moduleConfig);
//   console.log(getSherpaOnnxVersion(sherpaOnnxModule));

//   console.log(sherpaOnnxModule.FS.readdir("/"));

//   return getSherpaOnnxVersion(sherpaOnnxModule);
// }

export async function runTts() {
  const Module = await createSherpaModule(moduleConfig);

  const memoryUtil = Module.wasmMemory;

  const memUtilOld = Module.HEAP8.buffer;

  const isWasm32 = Module.HEAP32?.BYTES_PER_ELEMENT === 4;

  const response = await fetch("/assets/model.onnx");

  if (!response || !response.body) {
    throw Error("Failed to fetch model.onnx");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  // Allocate once, after streaming
  const modelData = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    modelData.set(chunk, offset);
    offset += chunk.length;
  }

  // Write into Emscripten FS
  Module.FS.writeFile("/model.onnx", modelData);

  console.log(Module.FS.readdir("/"));

  // const config: OfflineTtsConfig = {
  //   offlineTtsModelConfig: {
  //     offlineTtsVitsModelConfig: {
  //       model: "./model.onnx",
  //       tokens: "./tokens.txt",
  //       dataDir: "./espeak-ng-data",
  //     },
  //     numThreads: 1,
  //     debug: 1,
  //     provider: "cpu",
  //   },
  //   maxNumSentences: 1,
  // };

  // make sure relative paths resolve where you think
  Module.FS.chdir("/");

  // sanity checks
  console.log("cwd:", Module.FS.cwd());
  console.log("model exists:", Module.FS.analyzePath("/model.onnx").exists);
  console.log("tokens exists:", Module.FS.analyzePath("/tokens.txt").exists);
  console.log("espeak dir exists:", Module.FS.analyzePath("/espeak-ng-data").exists);

  const sp = Module.stackSave();
  try {
    const tts = createOfflineTts(Module, {
      offlineTtsModelConfig: {
        offlineTtsWfloatModelConfig: {
          model: "/model.onnx", // or "./model.onnx"
          tokens: "/tokens.txt", // or "./tokens.txt"
          dataDir: "/espeak-ng-data", // or "./espeak-ng-data"
          noiseScale: 0.667,
          noiseScaleW: 0.8,
          lengthScale: 1.0,
        },
        // optional explicit guard so VITS is not selected
        // offlineTtsVitsModelConfig: { model: "" },

        numThreads: 1,
        debug: 1,
        provider: "cpu",
      },
      ruleFsts: "",
      ruleFars: "",
      maxNumSentences: 1,
    });
    console.log("TTS did init!");

    const audio = tts.generate({
      text: "If you hear this, T T S works.",
      sid: 0,
      speed: 1.0,
    });

    const end = performance.now();
    // console.log(`tts.generate took ${(end - start).toFixed(2)} ms`);

    // mem = Module.wasmMemory || Module.HEAP8.buffer;
    // bytes = mem.byteLength;

    // console.log("WASM linear memory after generate():", bytes / (1024 * 1024), "MB");

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

    tts.free();
  } catch (e) {
    Module.stackRestore(sp);

    console.error("caught:", e);
    if (Module.getExceptionMessage) {
      const [typ, msg] = Module.getExceptionMessage(e);
      console.error("C++ exception:", typ, msg);
    }
    throw e;
  }

  // // const tts = createOfflineTts(Module);
  // const tts = createOfflineTts(Module, {
  //   offlineTtsModelConfig: {
  //     offlineTtsVitsModelConfig: {
  //       model: "/model.onnx",
  //       tokens: "/tokens.txt",
  //       dataDir: "/espeak-ng-data",
  //     },
  //     numThreads: 1,
  //     debug: 1,
  //     provider: "cpu",
  //   },
  //   maxNumSentences: 1,
  // });
  // // const start = performance.now();

  // console.log("TTS did init!");

  // // generate audio
  // const audio = tts.generate({
  //   text: "If you hear this, T T S works.",
  //   sid: 0,
  //   speed: 1.0,
  // });

  // const end = performance.now();
  // console.log(`tts.generate took ${(end - start).toFixed(2)} ms`);

  // mem = Module.wasmMemory || Module.HEAP8.buffer;
  // bytes = mem.byteLength;

  // console.log("WASM linear memory after generate():", bytes / (1024 * 1024), "MB");

  // write wav using existing package code
  // const filename = "validate.wav";
  // tts.save(filename, audio);

  // extract wav from emscripten fs
  // const wav = Module.FS.readFile(filename);

  // surface it
  // const blob = new Blob([wav.buffer], { type: "audio/wav" });
  // const url = URL.createObjectURL(blob);

  // const el = document.createElement("audio");
  // el.controls = true;
  // el.src = url;
  // document.body.appendChild(el);

  // cleanup
  // tts.free();

  // mem = Module.wasmMemory || Module.HEAP8.buffer;
  // bytes = mem.byteLength;

  // console.log("WASM linear memory FREEING tts:", bytes / (1024 * 1024), "MB");

  // Module.FS.unlink(filename); // no-op if not present

  // Module._free?.();

  // return end - start;
  console.log("I didn't hang");
  // return 1;
}

async function main() {
  // console.log(await getVersion());
  try {
    await runTts();
  } catch (error) {
    console.error(error);
  }
  // validateTtsOnPage();
}

main();
