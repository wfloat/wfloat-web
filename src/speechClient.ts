import {
  createOfflineTts,
  GeneratedAudio,
  OfflineTts,
  OfflineTtsConfig,
  OfflineTtsGenerateConfig,
  SherpaModule,
  prepareWfloatText,
  WfloatPrepareTextConfig,
  ModuleConfig,
  OfflineTtsProgressCallback,
  getSherpaModule,
} from "./wasm/sherpa-onnx-tts.js";

type SpeechClientGenerateOptions = {};

// const MODEL_NAME = "model.onnx";
// const TOKENS_NAME = "tokens.txt";
const MODEL_NAME = "lessac_high.onnx";
const TOKENS_NAME = "lessac_high_tokens.txt";

export class SpeechClient {
  private static sherpaModule: SherpaModule | null = null;
  private static tts: OfflineTts | null = null;

  static async loadModel(modelId: string): Promise<void> {
    await this.free();
    this.sherpaModule = await getSherpaModule();

    const tokensResponse = await fetch(`/assets/${TOKENS_NAME}`);
    if (!tokensResponse.ok) {
      throw new Error("Failed to fetch tokens.txt");
    }
    const tokensText = await tokensResponse.text();
    this.sherpaModule.FS.writeFile(`/${TOKENS_NAME}`, tokensText);

    // var contents = this.sherpaModule.FS.readFile("/libritts_r-medium_tokens.txt", {
    //   encoding: "utf8",
    // });
    // console.log(contents);
    // console.log(this.sherpaModule.FS.readdir("/"));

    const response = await fetch(`/assets/${MODEL_NAME}`);
    if (!response.ok || !response.body) {
      throw new Error("Failed to fetch model.onnx");
    }
    const reader = response.body.getReader();
    const stream = this.sherpaModule.FS.open(`/${MODEL_NAME}`, "w+");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      this.sherpaModule.FS.write(stream, value, 0, value.length);
    }
    this.sherpaModule.FS.close(stream);

    this.tts = createOfflineTts(this.sherpaModule, {
      offlineTtsModelConfig: {
        offlineTtsWfloatModelConfig: {
          model: `/${MODEL_NAME}`,
          tokens: `/${TOKENS_NAME}`,
          dataDir: "/espeak-ng-data",
          noiseScale: 0.667,
          noiseScaleW: 0.8,
          lengthScale: 1.0,
        },
        numThreads: 1,
        debug: 1,
        provider: "cpu",
      },
      ruleFsts: "",
      ruleFars: "",
      maxNumSentences: 1,
    });

    // // console.log(sherpaModule.wasmMemory);
    // // console.log(sherpaModule.HEAP8.buffer);
    // console.log(this.sherpaModule.HEAP8);
    // let mem = this.sherpaModule.HEAP8.buffer;
    // let bytes = mem.byteLength;

    // console.log("WASM linear memory after generate():", bytes / (1024 * 1024), "MB");

    // const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // // await sleep(5000);

    // const sherpaModule2 = await getSherpaModule();
    // mem = sherpaModule2.HEAP8.buffer;
    // bytes = mem.byteLength;

    // console.log("WASM linear memory after generate():", bytes / (1024 * 1024), "MB");

    // await this.destroy();
    // this.sherpaModule = (await createSherpaModule(defaultModuleConfig)) as SherpaModule;
    // this.tts = createOfflineTts(this.sherpaModule, {
    //   offlineTtsModelConfig: {
    //     offlineTtsWfloatModelConfig: {
    //       model: "/model.onnx",
    //       tokens: "/tokens.txt",
    //       dataDir: "/espeak-ng-data",
    //       noiseScale: 0.667,
    //       noiseScaleW: 0.8,
    //       lengthScale: 1.0,
    //     },
    //     numThreads: 1,
    //     debug: 1,
    //     provider: "cpu",
    //   },
    //   ruleFsts: "",
    //   ruleFars: "",
    //   maxNumSentences: 1,
    // });
  }

  static async generate(
    voiceId: string,
    text: string,
    options: SpeechClientGenerateOptions,
  ): Promise<string> {
    if (!this.tts || !this.sherpaModule) {
      throw new Error("SpeechClient is not created. Call loadModel() first.");
    }

    const preparedInput = prepareWfloatText(this.sherpaModule, {
      text: "Hello world! How are you today? I hope you are doing well as we take on this challenging task! What have you been up to lately?",
      emotion: "neutral",
      style: "default",
      intensity: 0.8,
      pace: 0.6,
    });

    const textClean = preparedInput.textClean.join(" ");

    const result = this.tts.generateWithProgressCallback(
      {
        text: textClean,
        sid: 3,
        speed: 1.0,
      },
      (samples, progress) => {
        console.log(progress);
      },
    );
    // const result = this.tts.generate({
    //   text: textClean,
    //   sid: 3,
    //   speed: 1.0,
    // });

    const filename = "output.wav";
    this.tts.save(filename, result);

    // extract wav from emscripten fs
    const wav = this.sherpaModule.FS.readFile(filename) as any;

    // surface it
    const blob = new Blob([wav.buffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);

    const el = document.createElement("audio");
    el.controls = true;
    el.src = url;
    document.body.appendChild(el);

    return url;
  }

  static async free(): Promise<void> {
    if (this.tts) {
      this.tts.free();
      this.tts = null;
    }
    this.sherpaModule = null;
  }
}
