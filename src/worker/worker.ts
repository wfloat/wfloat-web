import {
  SherpaModule,
  ModuleConfig,
  OfflineTts,
  createOfflineTts,
  prepareWfloatText,
} from "../wasm/sherpa-onnx-tts.js";
import {
  SPEAKER_IDS,
  SpeechClientGenerateOptions,
  SpeechEmotion,
  SpeechStyle,
  VALID_EMOTIONS,
  VALID_SIDS,
  VALID_STYLES,
} from "../speech/speechTypes.js";
// @ts-ignore
import createSherpaModule from "../wasm/sherpa-onnx-wasm-main-tts.js";
import { WorkerRequest, WorkerResponse } from "./workerTypes.js";
import { computeStartTime } from "../util/schedulingUtil.js";

let SherpaModuleInstancePromise: Promise<SherpaModule>;
let TTS: OfflineTts | null = null;

const defaultModuleConfig: ModuleConfig = {
  locateFile: (path: string) => {
    if (path.endsWith(".wasm")) return "/assets/sherpa-onnx-wasm-main-tts.wasm";
    if (path.endsWith(".data")) return "/assets/sherpa-onnx-wasm-main-tts.data";
    return path;
  },
  print: (text: string) => console.log(text),
  printErr: (text: string) => console.error("wasm:", text),
  onAbort: (what: unknown) => console.error("wasm abort:", what),
};

export function getSherpaModule() {
  if (!SherpaModuleInstancePromise) {
    SherpaModuleInstancePromise = createSherpaModule(defaultModuleConfig);
  }
  return SherpaModuleInstancePromise;
}

function postResponse(message: WorkerResponse, transfer: Transferable[] = []): void {
  (
    self as unknown as { postMessage: (value: WorkerResponse, transfer: Transferable[]) => void }
  ).postMessage(message, transfer);
}

async function handleLoadSpeechModel(id: number, modelId: string): Promise<void> {
  const MODEL_NAME = "wumbospeech0_medium_epoch_614.onnx";
  const TOKENS_NAME = "wumbospeech0_medium_epoch_332_tokens.txt";

  if (TTS) {
    TTS.free();
    TTS = null;
  }
  const sherpaModule = await getSherpaModule();

  const tokensResponse = await fetch(`/assets/${TOKENS_NAME}`);
  if (!tokensResponse.ok) {
    throw new Error("Failed to fetch tokens.txt");
  }
  const tokensText = await tokensResponse.text();
  sherpaModule.FS.writeFile(`/${TOKENS_NAME}`, tokensText);

  const response = await fetch(`/assets/${MODEL_NAME}`);
  if (!response.ok || !response.body) {
    throw new Error("Failed to fetch model.onnx");
  }
  const reader = response.body.getReader();
  const stream = sherpaModule.FS.open(`/${MODEL_NAME}`, "w+");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sherpaModule.FS.write(stream, value, 0, value.length);
  }
  sherpaModule.FS.close(stream);

  TTS = createOfflineTts(sherpaModule, {
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

  postResponse({ id, type: "speech-load-model-done", sampleRate: TTS.sampleRate });
}

async function handleSpeechGenerate(
  id: number,
  options: SpeechClientGenerateOptions,
): Promise<void> {
  // this.status = "generating";
  const sherpaModule = await getSherpaModule();

  if (!TTS) {
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

  const preparedInput = prepareWfloatText(
    sherpaModule,
    {
      text,
      emotion,
      style,
      intensity,
      pace: 0.5,
    },
    TTS.handle,
  );

  console.log("prepared input", preparedInput);

  const textClean = preparedInput.textClean.join(" ");

  let start = performance.now();

  let totalStart = performance.now();

  let tRuntime = 0;

  const sampleRate = TTS.sampleRate;
  let tPlayAudio: number | null;
  const sentencePhonemesList = preparedInput.textPhonemes;

  const result = TTS.generateWithProgressCallback(
    {
      text: textClean,
      sid,
      speed,
    },
    (samples, progress) => {
      let end = performance.now();

      let runtime = end - start;
      tRuntime += runtime;
      let runtimeSec = runtime / 1000;

      let n = preparedInput.textClean.length;
      let index = Math.floor(progress * n) - 1;

      if (index === 0) {
        let phonemesPerSec = preparedInput.textPhonemes[index].length / runtimeSec;
        let audioSecPerPhoneme =
          samples.length / sampleRate / preparedInput.textPhonemes[index].length;

        const preventOverrunConstant = 0.75;
        phonemesPerSec *= preventOverrunConstant;
        audioSecPerPhoneme *= preventOverrunConstant;
        tPlayAudio =
          computeStartTime(sentencePhonemesList, phonemesPerSec, audioSecPerPhoneme) * 1000;
      }

      // AudioPlayer.addSamples(samples);
      // if (index + 1 < preparedInput.text.length) {
      // AudioPlayer.addSilence();
      // }

      // if (totalDuration >= tStart!) {
      //   if (this.status === "generating") {
      //     this.status = "playing";
      //     AudioPlayer.play();
      //   }
      // }

      // console.log({
      //   progress,
      //   index,
      //   currentText: preparedInput.text[index],
      //   phonemesPerSecond: preparedInput.textPhonemes[index].length / runtimeSec,
      //   "audioPerPhoneme (seconds)":
      //     samples.length / sampleRate / preparedInput.textPhonemes[index].length,
      // });

      postResponse({
        id,
        type: "speech-generate-chunk",
        samples,
        index,
        progress,
        tPlayAudio: tPlayAudio!,
        tRuntime: tRuntime,
        highlightStart: 0,
        highlightEnd: 1,
      });

      // start = performance.now();
    },
  );

  // console.log(`Computed totalDuration (sec): ${tRuntime / 1000}`);
  // console.log(`actual duration (sec): ${(performance.now() - totalStart) / 1000}`);

  // const filename = "output.wav";
  // this.tts.save(filename, result);

  // // extract wav from emscripten fs
  // const wav = this.sherpaModule.FS.readFile(filename) as any;

  // // surface it
  // const blob = new Blob([wav.buffer], { type: "audio/wav" });
  // const url = URL.createObjectURL(blob);

  // const el = document.createElement("audio");
  // el.controls = true;
  // el.src = url;
  // document.body.appendChild(el);

  // return url;
  postResponse({ id, type: "speech-generate-done" });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  try {
    if (message.type === "speech-load-model") {
      await handleLoadSpeechModel(message.id, message.modelId);
      return;
    }

    if (message.type === "speech-generate") {
      handleSpeechGenerate(message.id, message.options);
      return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    postResponse({
      id: message.id,
      type: "request-error",
      error: errorMessage,
    });
  }
};
