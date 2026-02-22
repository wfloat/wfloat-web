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
  // getSherpaModule,
} from "../wasm/sherpa-onnx-tts.js";
import { computeStartTime } from "../util/schedulingUtil.js";
import { AudioPlayer } from "../audioPlayer.js";
import { SpeechClientStatus, SpeechClientGenerateOptions } from "./speechTypes.js";
import { WorkerClient } from "../worker/workerClient.js";

export class SpeechClient {
  private static status: SpeechClientStatus | null = null;

  static async loadModel(modelId: string): Promise<void> {
    if (this.status === "loading-model") {
      console.warn("dont call this again! this call was ignored.");
    } else {
      this.status = "loading-model";
      console.log("Starting speech model load");
      await WorkerClient.postMessage({
        type: "speech-load-model",
        modelId,
      });
      console.log("Speech model loaded complete!");
      this.status = null;
    }
  }

  static async generate(options: SpeechClientGenerateOptions): Promise<void> {
    AudioPlayer.clear();
    await WorkerClient.postMessage({
      type: "speech-generate",
      options,
      // options: {
      //   voiceId?: string | number;
      //   text: string;
      //   emotion?: SpeechEmotion | string;
      //   style?: SpeechStyle | string;
      //   intensity?: number;
      //   speed?: number;
      //   onProgressCallback?: (event: SpeechOnProgressEvent) => void;
      // }
    });
    // this.status = "generating";
    // if (!this.tts || !this.sherpaModule) {
    //   throw new Error("SpeechClient is not created. Call loadModel() first.");
    // }
    // const text = options.text;
    // if (!text) {
    //   throw new Error("text is required.");
    // }
    // let emotion: SpeechEmotion = "neutral";
    // if (VALID_EMOTIONS.includes(options.emotion as SpeechEmotion)) {
    //   emotion = options.emotion as SpeechEmotion;
    // }
    // let style: SpeechStyle = "default";
    // if (VALID_STYLES.includes(options.style as SpeechStyle)) {
    //   style = options.style as SpeechStyle;
    // }
    // let intensity = 0.5;
    // if (
    //   typeof options.intensity === "number" &&
    //   Number.isFinite(options.intensity) &&
    //   options.intensity >= 0 &&
    //   options.intensity <= 1
    // ) {
    //   intensity = options.intensity;
    // }
    // let speed = 1.0;
    // if (typeof options.speed === "number" && Number.isFinite(options.speed)) {
    //   speed = options.speed;
    // }
    // let sid = 0;
    // if (typeof options.voiceId === "number") {
    //   if (!Number.isInteger(options.voiceId) || !VALID_SIDS.includes(options.voiceId)) {
    //     throw new Error(`Invalid numeric voiceId: ${options.voiceId}`);
    //   }
    //   sid = options.voiceId;
    // } else if (typeof options.voiceId === "string") {
    //   const voiceName = options.voiceId.trim();
    //   if (!voiceName) {
    //     sid = 0;
    //   } else {
    //     const mappedSid = SPEAKER_IDS[voiceName];
    //     if (mappedSid !== undefined) {
    //       sid = mappedSid;
    //     } else {
    //       throw new Error(`Invalid string voiceId: ${voiceName}`);
    //     }
    //   }
    // }
    // const preparedInput = prepareWfloatText(
    //   this.sherpaModule,
    //   {
    //     text,
    //     emotion,
    //     style,
    //     intensity,
    //     pace: 0.5,
    //   },
    //   this.tts.handle,
    // );
    // console.log("prepared input", preparedInput);
    // const textClean = preparedInput.textClean.join(" ");
    // let start = performance.now();
    // let totalStart = performance.now();
    // let totalDuration = 0;
    // const sampleRate = this.tts.sampleRate;
    // let tStart: number | null;
    // const sentencePhonemesList = preparedInput.textPhonemes;
    // const result = this.tts.generateWithProgressCallback(
    //   {
    //     text: textClean,
    //     sid,
    //     speed,
    //   },
    //   (samples, progress) => {
    //     let end = performance.now();
    //     let runtime = end - start;
    //     totalDuration += runtime;
    //     let runtimeSec = runtime / 1000;
    //     let n = preparedInput.textClean.length;
    //     let index = Math.floor(progress * n) - 1;
    //     if (index === 0) {
    //       let phonemesPerSec = preparedInput.textPhonemes[index].length / runtimeSec;
    //       let audioSecPerPhoneme =
    //         samples.length / sampleRate / preparedInput.textPhonemes[index].length;
    //       const preventOverrunConstant = 0.75;
    //       phonemesPerSec *= preventOverrunConstant;
    //       audioSecPerPhoneme *= preventOverrunConstant;
    //       tStart = computeStartTime(sentencePhonemesList, phonemesPerSec, audioSecPerPhoneme);
    //     }
    //     AudioPlayer.addSamples(samples);
    //     if (index + 1 < preparedInput.text.length) {
    //       AudioPlayer.addSilence();
    //     }
    //     if (totalDuration >= tStart!) {
    //       if (this.status === "generating") {
    //         this.status = "playing";
    //         AudioPlayer.play();
    //       }
    //     }
    //     console.log({
    //       progress,
    //       index,
    //       currentText: preparedInput.text[index],
    //       phonemesPerSecond: preparedInput.textPhonemes[index].length / runtimeSec,
    //       "audioPerPhoneme (seconds)":
    //         samples.length / sampleRate / preparedInput.textPhonemes[index].length,
    //     });
    //     start = performance.now();
    //   },
    // );
    // console.log(`Computed totalDuration (sec): ${totalDuration / 1000}`);
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
  }

  // static async free(): Promise<void> {
  //   if (this.tts) {
  //     this.tts.free();
  //     this.tts = null;
  //   }
  //   this.sherpaModule = null;
  // }
}
