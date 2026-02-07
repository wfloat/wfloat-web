export interface SherpaModule {
  _malloc(size: number): number;
  _free(ptr: number): void;

  lengthBytesUTF8(str: string): number;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  setValue(ptr: number, value: number, type: "i8*" | "i32" | "float"): void;

  HEAP32: Int32Array;
  HEAPF32: Float32Array;

  // Custom helper in your build (as used in the JS)
  _CopyHeap(srcPtr: number, len: number, dstPtr: number): void;

  _SherpaOnnxCreateOfflineTts(configPtr: number): number;
  _SherpaOnnxDestroyOfflineTts(handle: number): void;
  _SherpaOnnxOfflineTtsSampleRate(handle: number): number;
  _SherpaOnnxOfflineTtsNumSpeakers(handle: number): number;

  _SherpaOnnxOfflineTtsGenerate(
    handle: number,
    textPtr: number,
    sid: number,
    speed: number,
  ): number;

  _SherpaOnnxDestroyOfflineTtsGeneratedAudio(h: number): void;

  _SherpaOnnxWriteWave(
    samplesPtr: number,
    numSamples: number,
    sampleRate: number,
    filenamePtr: number,
  ): void;
}

export interface OfflineTtsVitsModelConfig {
  model?: string;
  lexicon?: string;
  tokens?: string;
  noiseScale?: number;
  noiseScaleW?: number;
  lengthScale?: number;
  dataDir?: string;
}

export interface OfflineTtsMatchaModelConfig {
  acousticModel?: string;
  vocoder?: string;
  lexicon?: string;
  tokens?: string;
  noiseScale?: number;
  lengthScale?: number;
  dataDir?: string;
}

export interface OfflineTtsKokoroModelConfig {
  model?: string;
  voices?: string;
  tokens?: string;
  lengthScale?: number;
  dataDir?: string;
  lexicon?: string;
  lang?: string;
}

export interface OfflineTtsKittenModelConfig {
  model?: string;
  voices?: string;
  tokens?: string;
  dataDir?: string;
  lengthScale?: number;
}

export interface OfflineTtsZipVoiceModelConfig {
  tokens?: string;
  encoder?: string;
  decoder?: string;
  vocoder?: string;
  dataDir?: string;
  lexicon?: string;
  featScale?: number;
  tShift?: number;
  targetRMS?: number;
  guidanceScale?: number;
}

export interface OfflineTtsPocketModelConfig {
  lmFlow?: string;
  lmMain?: string;
  encoder?: string;
  decoder?: string;
  textConditioner?: string;
  vocabJson?: string;
  tokenScoresJson?: string;
}

export interface OfflineTtsModelConfig {
  offlineTtsVitsModelConfig?: OfflineTtsVitsModelConfig;
  offlineTtsMatchaModelConfig?: OfflineTtsMatchaModelConfig;
  offlineTtsKokoroModelConfig?: OfflineTtsKokoroModelConfig;
  offlineTtsKittenModelConfig?: OfflineTtsKittenModelConfig;
  offlineTtsZipVoiceModelConfig?: OfflineTtsZipVoiceModelConfig;
  offlineTtsPocketModelConfig?: OfflineTtsPocketModelConfig;

  numThreads?: number;
  debug?: number;
  provider?: string;
}

export interface OfflineTtsConfig {
  offlineTtsModelConfig?: OfflineTtsModelConfig;

  ruleFsts?: string;
  ruleFars?: string;
  maxNumSentences?: number;
  silenceScale?: number;
}

export interface OfflineTtsGenerateConfig {
  text: string;
  sid: number;
  speed: number;
}

export interface GeneratedAudio {
  samples: Float32Array;
  sampleRate: number;
}

type AllocatedConfig = {
  buffer?: number;
  ptr: number;
  len?: number;
  config?: AllocatedConfig;
  matcha?: AllocatedConfig;
  kokoro?: AllocatedConfig;
  kitten?: AllocatedConfig;
  zipvoice?: AllocatedConfig;
  pocket?: AllocatedConfig;
};

function freeConfig(config: AllocatedConfig, Module: SherpaModule): void {
  if ("buffer" in config && typeof config.buffer === "number") {
    Module._free(config.buffer);
  }

  if ("config" in config && config.config) {
    freeConfig(config.config, Module);
  }

  if ("matcha" in config && config.matcha) {
    freeConfig(config.matcha, Module);
  }

  if ("kokoro" in config && config.kokoro) {
    freeConfig(config.kokoro, Module);
  }

  if ("kitten" in config && config.kitten) {
    freeConfig(config.kitten, Module);
  }

  if ("zipvoice" in config && config.zipvoice) {
    freeConfig(config.zipvoice, Module);
  }

  if ("pocket" in config && config.pocket) {
    freeConfig(config.pocket, Module);
  }

  Module._free(config.ptr);
}

// The user should free the returned pointers
function initSherpaOnnxOfflineTtsVitsModelConfig(
  config: OfflineTtsVitsModelConfig,
  Module: SherpaModule,
): AllocatedConfig {
  const modelStr = config.model ?? "";
  const lexiconStr = config.lexicon ?? "";
  const tokensStr = config.tokens ?? "";
  const dataDirStr = config.dataDir ?? "";
  const dictDir = "";

  const modelLen = Module.lengthBytesUTF8(modelStr) + 1;
  const lexiconLen = Module.lengthBytesUTF8(lexiconStr) + 1;
  const tokensLen = Module.lengthBytesUTF8(tokensStr) + 1;
  const dataDirLen = Module.lengthBytesUTF8(dataDirStr) + 1;
  const dictDirLen = Module.lengthBytesUTF8(dictDir) + 1;

  const n = modelLen + lexiconLen + tokensLen + dataDirLen + dictDirLen;

  const buffer = Module._malloc(n);

  const len = 8 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(modelStr, buffer + offset, modelLen);
  offset += modelLen;

  Module.stringToUTF8(lexiconStr, buffer + offset, lexiconLen);
  offset += lexiconLen;

  Module.stringToUTF8(tokensStr, buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(dataDirStr, buffer + offset, dataDirLen);
  offset += dataDirLen;

  Module.stringToUTF8(dictDir, buffer + offset, dictDirLen);
  offset += dictDirLen;

  offset = 0;
  Module.setValue(ptr, buffer + offset, "i8*");
  offset += modelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += lexiconLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 16, config.noiseScale ?? 0.667, "float");
  Module.setValue(ptr + 20, config.noiseScaleW ?? 0.8, "float");
  Module.setValue(ptr + 24, config.lengthScale ?? 1.0, "float");
  Module.setValue(ptr + 28, buffer + offset, "i8*");
  offset += dictDirLen;

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsMatchaModelConfig(
  config: OfflineTtsMatchaModelConfig,
  Module: SherpaModule,
): AllocatedConfig {
  const acousticModelStr = config.acousticModel ?? "";
  const vocoderStr = config.vocoder ?? "";
  const lexiconStr = config.lexicon ?? "";
  const tokensStr = config.tokens ?? "";
  const dataDirStr = config.dataDir ?? "";
  const dictDir = "";

  const acousticModelLen = Module.lengthBytesUTF8(acousticModelStr) + 1;
  const vocoderLen = Module.lengthBytesUTF8(vocoderStr) + 1;
  const lexiconLen = Module.lengthBytesUTF8(lexiconStr) + 1;
  const tokensLen = Module.lengthBytesUTF8(tokensStr) + 1;
  const dataDirLen = Module.lengthBytesUTF8(dataDirStr) + 1;
  const dictDirLen = Module.lengthBytesUTF8(dictDir) + 1;

  const n = acousticModelLen + vocoderLen + lexiconLen + tokensLen + dataDirLen + dictDirLen;

  const buffer = Module._malloc(n);

  const len = 8 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(acousticModelStr, buffer + offset, acousticModelLen);
  offset += acousticModelLen;

  Module.stringToUTF8(vocoderStr, buffer + offset, vocoderLen);
  offset += vocoderLen;

  Module.stringToUTF8(lexiconStr, buffer + offset, lexiconLen);
  offset += lexiconLen;

  Module.stringToUTF8(tokensStr, buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(dataDirStr, buffer + offset, dataDirLen);
  offset += dataDirLen;

  Module.stringToUTF8(dictDir, buffer + offset, dictDirLen);
  offset += dictDirLen;

  offset = 0;
  Module.setValue(ptr, buffer + offset, "i8*");
  offset += acousticModelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += vocoderLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += lexiconLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 16, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 20, config.noiseScale ?? 0.667, "float");
  Module.setValue(ptr + 24, config.lengthScale ?? 1.0, "float");
  Module.setValue(ptr + 28, buffer + offset, "i8*");
  offset += dictDirLen;

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsKokoroModelConfig(
  config: OfflineTtsKokoroModelConfig,
  Module: SherpaModule,
): AllocatedConfig {
  const modelStr = config.model ?? "";
  const voicesStr = config.voices ?? "";
  const tokensStr = config.tokens ?? "";
  const dataDirStr = config.dataDir ?? "";
  const lexiconStr = config.lexicon ?? "";
  const langStr = config.lang ?? "";
  const dictDir = "";

  const modelLen = Module.lengthBytesUTF8(modelStr) + 1;
  const voicesLen = Module.lengthBytesUTF8(voicesStr) + 1;
  const tokensLen = Module.lengthBytesUTF8(tokensStr) + 1;
  const dataDirLen = Module.lengthBytesUTF8(dataDirStr) + 1;
  const dictDirLen = Module.lengthBytesUTF8(dictDir) + 1;
  const lexiconLen = Module.lengthBytesUTF8(lexiconStr) + 1;
  const langLen = Module.lengthBytesUTF8(langStr) + 1;

  const n = modelLen + voicesLen + tokensLen + dataDirLen + dictDirLen + lexiconLen + langLen;

  const buffer = Module._malloc(n);

  const len = 8 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(modelStr, buffer + offset, modelLen);
  offset += modelLen;

  Module.stringToUTF8(voicesStr, buffer + offset, voicesLen);
  offset += voicesLen;

  Module.stringToUTF8(tokensStr, buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(dataDirStr, buffer + offset, dataDirLen);
  offset += dataDirLen;

  Module.stringToUTF8(dictDir, buffer + offset, dictDirLen);
  offset += dictDirLen;

  Module.stringToUTF8(lexiconStr, buffer + offset, lexiconLen);
  offset += lexiconLen;

  Module.stringToUTF8(langStr, buffer + offset, langLen);
  offset += langLen;

  offset = 0;
  Module.setValue(ptr, buffer + offset, "i8*");
  offset += modelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += voicesLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 16, config.lengthScale ?? 1.0, "float");

  Module.setValue(ptr + 20, buffer + offset, "i8*");
  offset += dictDirLen;

  Module.setValue(ptr + 24, buffer + offset, "i8*");
  offset += lexiconLen;

  Module.setValue(ptr + 28, buffer + offset, "i8*");
  offset += langLen;

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsKittenModelConfig(
  config: OfflineTtsKittenModelConfig,
  Module: SherpaModule,
): AllocatedConfig {
  const modelStr = config.model ?? "";
  const voicesStr = config.voices ?? "";
  const tokensStr = config.tokens ?? "";
  const dataDirStr = config.dataDir ?? "";

  const modelLen = Module.lengthBytesUTF8(modelStr) + 1;
  const voicesLen = Module.lengthBytesUTF8(voicesStr) + 1;
  const tokensLen = Module.lengthBytesUTF8(tokensStr) + 1;
  const dataDirLen = Module.lengthBytesUTF8(dataDirStr) + 1;

  const n = modelLen + voicesLen + tokensLen + dataDirLen;

  const buffer = Module._malloc(n);

  const len = 5 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(modelStr, buffer + offset, modelLen);
  offset += modelLen;

  Module.stringToUTF8(voicesStr, buffer + offset, voicesLen);
  offset += voicesLen;

  Module.stringToUTF8(tokensStr, buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(dataDirStr, buffer + offset, dataDirLen);
  offset += dataDirLen;

  offset = 0;
  Module.setValue(ptr, buffer + offset, "i8*");
  offset += modelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += voicesLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 16, config.lengthScale ?? 1.0, "float");

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsZipVoiceModelConfig(
  config: OfflineTtsZipVoiceModelConfig,
  Module: SherpaModule,
): AllocatedConfig {
  const tokensStr = config.tokens ?? "";
  const encoderStr = config.encoder ?? "";
  const decoderStr = config.decoder ?? "";
  const vocoderStr = config.vocoder ?? "";
  const dataDirStr = config.dataDir ?? "";
  const lexiconStr = config.lexicon ?? "";

  const tokensLen = Module.lengthBytesUTF8(tokensStr) + 1;
  const encoderLen = Module.lengthBytesUTF8(encoderStr) + 1;
  const decoderLen = Module.lengthBytesUTF8(decoderStr) + 1;
  const vocoderLen = Module.lengthBytesUTF8(vocoderStr) + 1;
  const dataDirLen = Module.lengthBytesUTF8(dataDirStr) + 1;
  const lexiconLen = Module.lengthBytesUTF8(lexiconStr) + 1;

  const n = tokensLen + encoderLen + decoderLen + vocoderLen + dataDirLen + lexiconLen;

  const buffer = Module._malloc(n);

  const len = 10 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(tokensStr, buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(encoderStr, buffer + offset, encoderLen);
  offset += encoderLen;

  Module.stringToUTF8(decoderStr, buffer + offset, decoderLen);
  offset += decoderLen;

  Module.stringToUTF8(vocoderStr, buffer + offset, vocoderLen);
  offset += vocoderLen;

  Module.stringToUTF8(dataDirStr, buffer + offset, dataDirLen);
  offset += dataDirLen;

  Module.stringToUTF8(lexiconStr, buffer + offset, lexiconLen);
  offset += lexiconLen;

  offset = 0;
  Module.setValue(ptr, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += encoderLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += decoderLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += vocoderLen;

  Module.setValue(ptr + 16, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 20, buffer + offset, "i8*");
  offset += lexiconLen;

  Module.setValue(ptr + 24, config.featScale ?? 0.1, "float");
  Module.setValue(ptr + 28, config.tShift ?? 0.5, "float");
  Module.setValue(ptr + 32, config.targetRMS ?? 0.1, "float");
  Module.setValue(ptr + 36, config.guidanceScale ?? 1.0, "float");

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsPocketModelConfig(
  config: OfflineTtsPocketModelConfig,
  Module: SherpaModule,
): AllocatedConfig {
  const lmFlowStr = config.lmFlow ?? "";
  const lmMainStr = config.lmMain ?? "";
  const encoderStr = config.encoder ?? "";
  const decoderStr = config.decoder ?? "";
  const textConditionerStr = config.textConditioner ?? "";
  const vocabJsonStr = config.vocabJson ?? "";
  const tokenScoresJsonStr = config.tokenScoresJson ?? "";

  const lmFlowLen = Module.lengthBytesUTF8(lmFlowStr) + 1;
  const lmMainLen = Module.lengthBytesUTF8(lmMainStr) + 1;
  const encoderLen = Module.lengthBytesUTF8(encoderStr) + 1;
  const decoderLen = Module.lengthBytesUTF8(decoderStr) + 1;
  const textConditionerLen = Module.lengthBytesUTF8(textConditionerStr) + 1;
  const vocabJsonLen = Module.lengthBytesUTF8(vocabJsonStr) + 1;
  const tokenScoresJsonLen = Module.lengthBytesUTF8(tokenScoresJsonStr) + 1;

  const n =
    lmFlowLen +
    lmMainLen +
    encoderLen +
    decoderLen +
    textConditionerLen +
    vocabJsonLen +
    tokenScoresJsonLen;

  const buffer = Module._malloc(n);

  const len = 7 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(lmFlowStr, buffer + offset, lmFlowLen);
  offset += lmFlowLen;

  Module.stringToUTF8(lmMainStr, buffer + offset, lmMainLen);
  offset += lmMainLen;

  Module.stringToUTF8(encoderStr, buffer + offset, encoderLen);
  offset += encoderLen;

  Module.stringToUTF8(decoderStr, buffer + offset, decoderLen);
  offset += decoderLen;

  Module.stringToUTF8(textConditionerStr, buffer + offset, textConditionerLen);
  offset += textConditionerLen;

  Module.stringToUTF8(vocabJsonStr, buffer + offset, vocabJsonLen);
  offset += vocabJsonLen;

  Module.stringToUTF8(tokenScoresJsonStr, buffer + offset, tokenScoresJsonLen);
  offset += tokenScoresJsonLen;

  offset = 0;
  Module.setValue(ptr, buffer + offset, "i8*");
  offset += lmFlowLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += lmMainLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += encoderLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += decoderLen;

  Module.setValue(ptr + 16, buffer + offset, "i8*");
  offset += textConditionerLen;

  Module.setValue(ptr + 20, buffer + offset, "i8*");
  offset += vocabJsonLen;

  Module.setValue(ptr + 24, buffer + offset, "i8*");
  offset += tokenScoresJsonLen;

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsModelConfig(
  config: OfflineTtsModelConfig,
  Module: SherpaModule,
): AllocatedConfig {
  if (!("offlineTtsVitsModelConfig" in config)) {
    config.offlineTtsVitsModelConfig = {
      model: "",
      lexicon: "",
      tokens: "",
      noiseScale: 0.667,
      noiseScaleW: 0.8,
      lengthScale: 1.0,
      dataDir: "",
    };
  }

  if (!("offlineTtsMatchaModelConfig" in config)) {
    config.offlineTtsMatchaModelConfig = {
      acousticModel: "",
      vocoder: "",
      lexicon: "",
      tokens: "",
      noiseScale: 0.667,
      lengthScale: 1.0,
      dataDir: "",
    };
  }

  if (!("offlineTtsKokoroModelConfig" in config)) {
    config.offlineTtsKokoroModelConfig = {
      model: "",
      voices: "",
      tokens: "",
      lengthScale: 1.0,
      dataDir: "",
      lexicon: "",
      lang: "",
    };
  }

  if (!("offlineTtsKittenModelConfig" in config)) {
    config.offlineTtsKittenModelConfig = {
      model: "",
      voices: "",
      tokens: "",
      lengthScale: 1.0,
    };
  }

  if (!("offlineTtsZipVoiceModelConfig" in config)) {
    config.offlineTtsZipVoiceModelConfig = {
      tokens: "",
      encoder: "",
      decoder: "",
      vocoder: "",
      dataDir: "",
      lexicon: "",
      featScale: 0.1,
      tShift: 0.5,
      targetRMS: 0.1,
      guidanceScale: 1.0,
    };
  }

  if (!("offlineTtsPocketModelConfig" in config)) {
    config.offlineTtsPocketModelConfig = {
      lmFlow: "",
      lmMain: "",
      encoder: "",
      decoder: "",
      textConditioner: "",
      vocabJson: "",
      tokenScoresJson: "",
    };
  }

  const vitsModelConfig = initSherpaOnnxOfflineTtsVitsModelConfig(
    config.offlineTtsVitsModelConfig!,
    Module,
  );

  const matchaModelConfig = initSherpaOnnxOfflineTtsMatchaModelConfig(
    config.offlineTtsMatchaModelConfig!,
    Module,
  );

  const kokoroModelConfig = initSherpaOnnxOfflineTtsKokoroModelConfig(
    config.offlineTtsKokoroModelConfig!,
    Module,
  );

  const kittenModelConfig = initSherpaOnnxOfflineTtsKittenModelConfig(
    config.offlineTtsKittenModelConfig!,
    Module,
  );

  const zipVoiceModelConfig = initSherpaOnnxOfflineTtsZipVoiceModelConfig(
    config.offlineTtsZipVoiceModelConfig!,
    Module,
  );

  const pocketModelConfig = initSherpaOnnxOfflineTtsPocketModelConfig(
    config.offlineTtsPocketModelConfig!,
    Module,
  );

  const len =
    (vitsModelConfig.len ?? 0) +
    (matchaModelConfig.len ?? 0) +
    (kokoroModelConfig.len ?? 0) +
    (kittenModelConfig.len ?? 0) +
    (zipVoiceModelConfig.len ?? 0) +
    (pocketModelConfig.len ?? 0) +
    3 * 4;

  const ptr = Module._malloc(len);

  let offset = 0;
  Module._CopyHeap(vitsModelConfig.ptr, vitsModelConfig.len ?? 0, ptr + offset);
  offset += vitsModelConfig.len ?? 0;

  Module.setValue(ptr + offset, config.numThreads ?? 1, "i32");
  offset += 4;

  Module.setValue(ptr + offset, config.debug ?? 0, "i32");
  offset += 4;

  const providerStr = config.provider ?? "cpu";
  const providerLen = Module.lengthBytesUTF8(providerStr) + 1;
  const providerBuf = Module._malloc(providerLen);
  Module.stringToUTF8(providerStr, providerBuf, providerLen);
  Module.setValue(ptr + offset, providerBuf, "i8*");
  offset += 4;

  Module._CopyHeap(matchaModelConfig.ptr, matchaModelConfig.len ?? 0, ptr + offset);
  offset += matchaModelConfig.len ?? 0;

  Module._CopyHeap(kokoroModelConfig.ptr, kokoroModelConfig.len ?? 0, ptr + offset);
  offset += kokoroModelConfig.len ?? 0;

  Module._CopyHeap(kittenModelConfig.ptr, kittenModelConfig.len ?? 0, ptr + offset);
  offset += kittenModelConfig.len ?? 0;

  Module._CopyHeap(zipVoiceModelConfig.ptr, zipVoiceModelConfig.len ?? 0, ptr + offset);
  offset += zipVoiceModelConfig.len ?? 0;

  Module._CopyHeap(pocketModelConfig.ptr, pocketModelConfig.len ?? 0, ptr + offset);
  offset += pocketModelConfig.len ?? 0;

  return {
    buffer: providerBuf,
    ptr,
    len,
    config: vitsModelConfig,
    matcha: matchaModelConfig,
    kokoro: kokoroModelConfig,
    kitten: kittenModelConfig,
    zipvoice: zipVoiceModelConfig,
    pocket: pocketModelConfig,
  };
}

function initSherpaOnnxOfflineTtsConfig(
  config: OfflineTtsConfig,
  Module: SherpaModule,
): AllocatedConfig {
  const cfg: OfflineTtsConfig = config ?? {};
  cfg.offlineTtsModelConfig = cfg.offlineTtsModelConfig ?? {};

  const modelConfig = initSherpaOnnxOfflineTtsModelConfig(cfg.offlineTtsModelConfig, Module);

  const len = (modelConfig.len ?? 0) + 4 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module._CopyHeap(modelConfig.ptr, modelConfig.len ?? 0, ptr + offset);
  offset += modelConfig.len ?? 0;

  const ruleFstsStr = cfg.ruleFsts ?? "";
  const ruleFarsStr = cfg.ruleFars ?? "";

  const ruleFstsLen = Module.lengthBytesUTF8(ruleFstsStr) + 1;
  const ruleFarsLen = Module.lengthBytesUTF8(ruleFarsStr) + 1;

  const buffer = Module._malloc(ruleFstsLen + ruleFarsLen);
  Module.stringToUTF8(ruleFstsStr, buffer, ruleFstsLen);
  Module.stringToUTF8(ruleFarsStr, buffer + ruleFstsLen, ruleFarsLen);

  Module.setValue(ptr + offset, buffer, "i8*");
  offset += 4;

  Module.setValue(ptr + offset, cfg.maxNumSentences ?? 1, "i32");
  offset += 4;

  Module.setValue(ptr + offset, buffer + ruleFstsLen, "i8*");
  offset += 4;

  Module.setValue(ptr + offset, cfg.silenceScale ?? 0.2, "float");
  offset += 4;

  return {
    buffer,
    ptr,
    len,
    config: modelConfig,
  };
}

export class OfflineTts {
  public handle: number;
  public sampleRate: number;
  public numSpeakers: number;
  public Module: SherpaModule;

  constructor(configObj: OfflineTtsConfig, Module: SherpaModule) {
    console.log(configObj);
    const config = initSherpaOnnxOfflineTtsConfig(configObj, Module);
    const handle = Module._SherpaOnnxCreateOfflineTts(config.ptr);

    freeConfig(config, Module);

    this.handle = handle;
    this.sampleRate = Module._SherpaOnnxOfflineTtsSampleRate(this.handle);
    this.numSpeakers = Module._SherpaOnnxOfflineTtsNumSpeakers(this.handle);
    this.Module = Module;
  }

  free(): void {
    this.Module._SherpaOnnxDestroyOfflineTts(this.handle);
    this.handle = 0;
  }

  // {
  //   text: "hello",
  //   sid: 1,
  //   speed: 1.0
  // }
  generate(config: OfflineTtsGenerateConfig): GeneratedAudio {
    const textLen = this.Module.lengthBytesUTF8(config.text) + 1;
    const textPtr = this.Module._malloc(textLen);
    this.Module.stringToUTF8(config.text, textPtr, textLen);

    const h = this.Module._SherpaOnnxOfflineTtsGenerate(
      this.handle,
      textPtr,
      config.sid,
      config.speed,
    );

    const numSamples = this.Module.HEAP32[h / 4 + 1];
    const sampleRate = this.Module.HEAP32[h / 4 + 2];

    const samplesPtr = this.Module.HEAP32[h / 4] / 4;
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = this.Module.HEAPF32[samplesPtr + i];
    }

    this.Module._SherpaOnnxDestroyOfflineTtsGeneratedAudio(h);
    // NOTE: original JS did not free textPtr; keeping behavior.
    return { samples, sampleRate };
  }

  save(filename: string, audio: GeneratedAudio): void {
    const samples = audio.samples;
    const sampleRate = audio.sampleRate;

    const ptr = this.Module._malloc(samples.length * 4);
    for (let i = 0; i < samples.length; i++) {
      this.Module.HEAPF32[ptr / 4 + i] = samples[i];
    }

    const filenameLen = this.Module.lengthBytesUTF8(filename) + 1;
    const buffer = this.Module._malloc(filenameLen);
    this.Module.stringToUTF8(filename, buffer, filenameLen);

    this.Module._SherpaOnnxWriteWave(ptr, samples.length, sampleRate, buffer);

    this.Module._free(buffer);
    this.Module._free(ptr);
  }
}

export function createOfflineTts(Module: SherpaModule, myConfig?: OfflineTtsConfig): OfflineTts {
  const vits: OfflineTtsVitsModelConfig = {
    model: "",
    lexicon: "",
    tokens: "",
    dataDir: "",
    noiseScale: 0.667,
    noiseScaleW: 0.8,
    lengthScale: 1.0,
  };

  const matcha: OfflineTtsMatchaModelConfig = {
    acousticModel: "",
    vocoder: "",
    lexicon: "",
    tokens: "",
    dataDir: "",
    noiseScale: 0.667,
    lengthScale: 1.0,
  };

  const offlineTtsKokoroModelConfig: OfflineTtsKokoroModelConfig = {
    model: "",
    voices: "",
    tokens: "",
    dataDir: "",
    lengthScale: 1.0,
    lexicon: "",
    lang: "",
  };

  const offlineTtsKittenModelConfig: OfflineTtsKittenModelConfig = {
    model: "",
    voices: "",
    tokens: "",
    dataDir: "",
    lengthScale: 1.0,
  };

  const offlineTtsPocketModelConfig: OfflineTtsPocketModelConfig = {
    lmFlow: "",
    lmMain: "",
    encoder: "",
    decoder: "",
    textConditioner: "",
    vocabJson: "",
    tokenScoresJson: "",
  };

  let ruleFsts = "";

  let type = 0;
  switch (type) {
    case 0:
      // vits
      vits.model = "./model.onnx";
      vits.tokens = "./tokens.txt";
      vits.dataDir = "./espeak-ng-data";
      break;

    case 1:
      // matcha zh-en
      matcha.acousticModel = "./model-steps-3.onnx";
      matcha.vocoder = "./vocos-16khz-univ.onnx";
      matcha.lexicon = "./lexicon.txt";
      matcha.tokens = "./tokens.txt";
      matcha.dataDir = "./espeak-ng-data";
      ruleFsts = "./phone-zh.fst,./date-zh.fst,./number-zh.fst";
      break;

    case 2:
      // matcha zh
      matcha.acousticModel = "./model-steps-3.onnx";
      matcha.vocoder = "./vocos-22khz-univ.onnx";
      matcha.lexicon = "./lexicon.txt";
      matcha.tokens = "./tokens.txt";
      ruleFsts = "./phone.fst,./date.fst,./number.fst";
      break;

    case 3:
      // matcha en
      matcha.acousticModel = "./model-steps-3.onnx";
      matcha.vocoder = "./vocos-22khz-univ.onnx";
      matcha.tokens = "./tokens.txt";
      matcha.dataDir = "./espeak-ng-data";
      break;
  }

  const offlineTtsModelConfig: OfflineTtsModelConfig = {
    offlineTtsVitsModelConfig: vits,
    offlineTtsMatchaModelConfig: matcha,
    offlineTtsKokoroModelConfig,
    offlineTtsKittenModelConfig,
    offlineTtsPocketModelConfig,
    numThreads: 1,
    debug: 1,
    provider: "cpu",
  };

  let offlineTtsConfig: OfflineTtsConfig = {
    offlineTtsModelConfig,
    ruleFsts,
    ruleFars: "",
    maxNumSentences: 1,
  };

  if (myConfig) {
    offlineTtsConfig = myConfig;
  }

  return new OfflineTts(offlineTtsConfig, Module);
}
