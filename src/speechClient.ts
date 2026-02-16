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

export class SpeechClient {
  private sherpaModule: SherpaModule | null = null;
  private tts: OfflineTts | null = null;

  async loadModel(modelId: string): Promise<void> {
    await this.free();
    this.sherpaModule = await getSherpaModule();

    this.tts = createOfflineTts(this.sherpaModule, {
      offlineTtsModelConfig: {
        offlineTtsWfloatModelConfig: {
          model: "/model.onnx",
          tokens: "/tokens.txt",
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

    // console.log(sherpaModule.wasmMemory);
    // console.log(sherpaModule.HEAP8.buffer);
    console.log(sherpaModule.HEAP8);
    let mem = sherpaModule.HEAP8.buffer;
    let bytes = mem.byteLength;

    console.log("WASM linear memory after generate():", bytes / (1024 * 1024), "MB");

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    await sleep(5000);

    const sherpaModule2 = await getSherpaModule();
    mem = sherpaModule2.HEAP8.buffer;
    bytes = mem.byteLength;

    console.log("WASM linear memory after generate():", bytes / (1024 * 1024), "MB");

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

  async generate(
    voiceId: string,
    text: string,
    options: SpeechClientGenerateOptions,
  ): Promise<string> {
    if (!this.tts || !this.sherpaModule) {
      throw new Error("SpeechClient is not created. Call create() first.");
    }

    const preparedInput = prepareWfloatText(this.sherpaModule, {
      text: "Hello world! How are you today?",
      emotion: "neutral",
      style: "default",
      intensity: 0.5,
      pace: 0.5,
    });

    const textClean = preparedInput.textClean.join(" ");

    const result = this.tts.generateWithProgressCallback(
      {
        text: textClean,
        sid: 0,
        speed: 1.0,
      },
      (samples, progress) => {
        console.log(samples, progress);
      },
    );

    return "";
  }

  async free(): Promise<void> {
    if (this.tts) {
      this.tts.free();
      this.tts = null;
    }
    this.sherpaModule = null;
  }
}
