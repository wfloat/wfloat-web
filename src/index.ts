import {
  // getSherpaOnnxVersion,
  createOfflineTts,
  prepareWfloatText,
  // OfflineTtsConfig,
} from "./wasm/sherpa-onnx-tts.js";
// @ts-ignore
import createSherpaModule from "./wasm/sherpa-onnx-wasm-main-tts.js";
import { testText } from "./testText.js";
export { SpeechClient } from "./speech/speechClient.js";

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
  // print: console.log,
  // printErr: (s: string) => console.error("wasm:", s),
  // onAbort: (what: any) => console.error("wasm abort:", what),
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

  for (let i = 0; i < testText.length; i++) {
    const item = testText[i];

    const result = prepareWfloatText(Module, {
      text: item.original,
      emotion: "neutral",
      style: "default",
      intensity: 0.5,
      pace: 0.5,
    });

    const trimmedTextClean = result.textClean.map((str) => str.replace("😐🙂⑤⑤", ""));

    const textMatches =
      result.text.length === item.text.length &&
      result.text.every((val, idx) => val === item.text[idx]);

    const textCleanMatches =
      trimmedTextClean.length === item.text_clean.length &&
      trimmedTextClean.every((val, idx) => val === item.text_clean[idx]);

    if (!textMatches || !textCleanMatches) {
      throw new Error(
        `Wfloat mismatch at index ${i}


Original:
${item.original}


Expected text:
${JSON.stringify(item.text, null, 2)}


Actual text:
${JSON.stringify(result.text, null, 2)}


Expected text_clean:
${JSON.stringify(item.text_clean, null, 2)}


Actual textClean (trimmed):
${JSON.stringify(trimmedTextClean, null, 2)}
`,
      );
    }
  }

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

    const audio = tts.generateWithCallback(
      {
        // text: "If you hear this, T T S works. Wfloat is a technology! Words are here's word? aaaa b   ",
        text: "A.😐🙂⓪① B. C.😄😏②③ D! E?😡🎭④⑤ F. G. H.😲🧐⑥⑦ I! J?😱😜⑧⑨",
        sid: 0,
        speed: 1.0,
      },
      (chunk) => {
        console.log("chunk samples:", chunk.length);
        return true; // continue
      },
    );

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

    const audio2 = tts.generateWithProgressCallback(
      {
        // text: "If you hear this, T T S works. Wfloat is a technology! Words are here's word? aaaa b   ",
        // text: "K Mr. Sir.😐🙂⓪① L. M.😄😏②③ N! O?😡🎭④⑤ P. Q. R.😲🧐⑥⑦ S! T?😱😜⑧⑨",
        text: "I was thinking.  maybe we should wait.",
        sid: 0,
        speed: 1.0,
      },
      (chunk, progress) => {
        console.log(`progress ${(progress * 100).toFixed(1)}%`, "chunk:", chunk.length);
        return true; // continue
      },
    );

    const filename2 = "validate2.wav";
    tts.save(filename2, audio2);

    // extract wav from emscripten fs
    const wav2 = Module.FS.readFile(filename2);

    // surface it
    const blob2 = new Blob([wav2.buffer], { type: "audio/wav" });
    const url2 = URL.createObjectURL(blob2);

    const el2 = document.createElement("audio");
    el2.controls = true;
    el2.src = url2;
    document.body.appendChild(el2);

    const end = performance.now();
    // console.log(`tts.generate took ${(end - start).toFixed(2)} ms`);

    // mem = Module.wasmMemory || Module.HEAP8.buffer;
    // bytes = mem.byteLength;

    // console.log("WASM linear memory after generate():", bytes / (1024 * 1024), "MB");

    // write wav using existing package code

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

// async function main() {
//   // console.log(await getVersion());
//   try {
//     await runTts();
//   } catch (error) {
//     console.error(error);
//   }
//   // validateTtsOnPage();
// }

// main();

async function main() {
  const Module = await createSherpaModule(moduleConfig);
  Module.FS.chdir("/");
  // Module._free?.();
}

// main();
