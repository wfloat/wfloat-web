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

type SpeechEmotion =
  | "neutral"
  | "joy"
  | "sadness"
  | "anger"
  | "fear"
  | "surprise"
  | "dismissive"
  | "confusion";

type SpeechStyle = "default" | "sarcastic" | "playful" | "calm" | "dramatic" | "serious";

type SpeechClientGenerateOptions = {
  voiceId?: string | number;
  text: string;
  emotion?: SpeechEmotion | string;
  style?: SpeechStyle | string;
  intensity?: number;
  speed?: number;
};

const VALID_EMOTIONS: SpeechEmotion[] = [
  "neutral",
  "joy",
  "sadness",
  "anger",
  "fear",
  "surprise",
  "dismissive",
  "confusion",
];

const VALID_STYLES: SpeechStyle[] = [
  "default",
  "sarcastic",
  "playful",
  "calm",
  "dramatic",
  "serious",
];

const SPEAKER_IDS: Record<string, number> = {
  skilled_hero_man: 0,
  skilled_hero_woman: 1,
  fun_hero_man: 2,
  fun_hero_woman: 3,
  strong_hero_man: 4,
  strong_hero_woman: 5,
  mad_scientist_man: 6,
  mad_scientist_woman: 7,
  clever_villain_man: 8,
  clever_villain_woman: 9,
  narrator_man: 10,
  narrator_woman: 11,
  wise_elder_man: 12,
  wise_elder_woman: 13,
  outgoing_anime_man: 14,
  outgoing_anime_woman: 15,
  scary_villain_man: 16,
  scary_villain_woman: 17,
  news_reporter_man: 18,
  news_reporter_woman: 19,
};

const VALID_SIDS = Object.values(SPEAKER_IDS);

const MODEL_NAME = "wumbospeech0_medium_epoch_614.onnx";
const TOKENS_NAME = "wumbospeech0_medium_epoch_332_tokens.txt";
// const MODEL_NAME = "lessac_high.onnx";
// const TOKENS_NAME = "lessac_high_tokens.txt";

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

  static async generate(options: SpeechClientGenerateOptions): Promise<string> {
    if (!this.tts || !this.sherpaModule) {
      throw new Error("SpeechClient is not created. Call loadModel() first.");
    }

    const text = options.text;
    if (!text) {
      throw new Error("text is required.");
    }

    let emotion: SpeechEmotion = "neutral";
    if (VALID_EMOTIONS.includes(options.emotion as SpeechEmotion)) {
      emotion = options.emotion as SpeechEmotion;
    }

    let style: SpeechStyle = "default";
    if (VALID_STYLES.includes(options.style as SpeechStyle)) {
      style = options.style as SpeechStyle;
    }

    let intensity = 0.5;
    if (
      typeof options.intensity === "number" &&
      Number.isFinite(options.intensity) &&
      options.intensity >= 0 &&
      options.intensity <= 1
    ) {
      intensity = options.intensity;
    }

    let speed = 1.0;
    if (typeof options.speed === "number" && Number.isFinite(options.speed)) {
      speed = options.speed;
    }

    let sid = 0;
    if (typeof options.voiceId === "number") {
      if (!Number.isInteger(options.voiceId) || !VALID_SIDS.includes(options.voiceId)) {
        throw new Error(`Invalid numeric voiceId: ${options.voiceId}`);
      }
      sid = options.voiceId;
    } else if (typeof options.voiceId === "string") {
      const voiceName = options.voiceId.trim();
      if (!voiceName) {
        sid = 0;
      } else {
        const mappedSid = SPEAKER_IDS[voiceName];
        if (mappedSid !== undefined) {
          sid = mappedSid;
        } else {
          throw new Error(`Invalid string voiceId: ${voiceName}`);
        }
      }
    }

    const preparedInput = prepareWfloatText(this.sherpaModule, {
      text,
      emotion,
      style,
      intensity,
      pace: 0.5,
    });

    const textClean = preparedInput.textClean.join(" ");

    const result = this.tts.generateWithProgressCallback(
      {
        text: textClean,
        sid,
        speed,
      },
      (samples, progress) => {
        console.log(progress);
      },
    );

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
