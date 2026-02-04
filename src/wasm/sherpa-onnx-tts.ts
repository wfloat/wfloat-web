export type EmscriptenModule = {
  // memory + helpers
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  HEAPF32: Float32Array;

  _malloc(n: number): number;
  _free(ptr: number): void;

  lengthBytesUTF8(s: string): number;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  UTF8ToString(ptr: number): string;

  setValue(ptr: number, value: number, type: "i8*" | "i32" | "float"): void;

  // optional helper in your build; if absent we fallback to HEAPU8 copy
  _CopyHeap?: (src: number, len: number, dst: number) => void;

  // sherpa onnx exports
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

  _SherpaOnnxDestroyOfflineTtsGeneratedAudio(ptr: number): void;

  _SherpaOnnxWriteWave(
    samplesPtr: number,
    numSamples: number,
    sampleRate: number,
    filenamePtr: number,
  ): void;

  _SherpaOnnxGetVersionStr(): number;
};

type AnyConfigNode = {
  ptr: number;
  len?: number;
  buffer?: number;
  config?: AnyConfigNode;
  matcha?: AnyConfigNode;
  kokoro?: AnyConfigNode;
  kitten?: AnyConfigNode;
};

function copyHeap(Module: EmscriptenModule, src: number, len: number, dst: number) {
  if (typeof Module._CopyHeap === "function") {
    Module._CopyHeap(src, len, dst);
    return;
  }
  // Fallback: memcpy via HEAPU8
  Module.HEAPU8.set(Module.HEAPU8.subarray(src, src + len), dst);
}

function mallocUtf8(Module: EmscriptenModule, s: string): { ptr: number; len: number } {
  const len = Module.lengthBytesUTF8(s) + 1;
  const ptr = Module._malloc(len);
  Module.stringToUTF8(s, ptr, len);
  return { ptr, len };
}

function freeConfig(node: AnyConfigNode, Module: EmscriptenModule) {
  if (node.buffer) Module._free(node.buffer);
  if (node.config) freeConfig(node.config, Module);
  if (node.matcha) freeConfig(node.matcha, Module);
  if (node.kokoro) freeConfig(node.kokoro, Module);
  if (node.kitten) freeConfig(node.kitten, Module);
  Module._free(node.ptr);
}

// ---------- Config types ----------
export interface OfflineTtsVitsModelConfig {
  model?: string;
  lexicon?: string;
  tokens?: string;
  dataDir?: string;
  dictDir?: string;
  noiseScale?: number; // default 0.667
  noiseScaleW?: number; // default 0.8
  lengthScale?: number; // default 1.0
}

export interface OfflineTtsMatchaModelConfig {
  acousticModel?: string;
  vocoder?: string;
  lexicon?: string;
  tokens?: string;
  dataDir?: string;
  dictDir?: string;
  noiseScale?: number; // default 0.667
  lengthScale?: number; // default 1.0
}

export interface OfflineTtsKokoroModelConfig {
  model?: string;
  voices?: string;
  tokens?: string;
  dataDir?: string;
  dictDir?: string;
  lexicon?: string;
  lang?: string;
  lengthScale?: number; // default 1.0
}

export interface OfflineTtsKittenModelConfig {
  model?: string;
  voices?: string;
  tokens?: string;
  dataDir?: string;
  lengthScale?: number; // default 1.0
}

export interface OfflineTtsModelConfig {
  offlineTtsVitsModelConfig?: OfflineTtsVitsModelConfig;
  offlineTtsMatchaModelConfig?: OfflineTtsMatchaModelConfig;
  offlineTtsKokoroModelConfig?: OfflineTtsKokoroModelConfig;
  offlineTtsKittenModelConfig?: OfflineTtsKittenModelConfig;

  numThreads?: number; // default 1
  debug?: number; // default 0
  provider?: string; // default "cpu"
}

export interface OfflineTtsConfig {
  offlineTtsModelConfig: OfflineTtsModelConfig;
  ruleFsts?: string;
  ruleFars?: string;
  maxNumSentences?: number; // default 1
  silenceScale?: number; // default 0.2
}

export interface GenerateConfig {
  text: string;
  sid: number;
  speed: number;
}

export interface GeneratedAudio {
  samples: Float32Array;
  sampleRate: number;
}

// ---------- Low-level struct builders (same layout as your JS) ----------
function initSherpaOnnxOfflineTtsVitsModelConfig(
  config: OfflineTtsVitsModelConfig,
  Module: EmscriptenModule,
) {
  const modelLen = Module.lengthBytesUTF8(config.model ?? "") + 1;
  const lexiconLen = Module.lengthBytesUTF8(config.lexicon ?? "") + 1;
  const tokensLen = Module.lengthBytesUTF8(config.tokens ?? "") + 1;
  const dataDirLen = Module.lengthBytesUTF8(config.dataDir ?? "") + 1;
  const dictDirLen = Module.lengthBytesUTF8(config.dictDir ?? "") + 1;

  const n = modelLen + lexiconLen + tokensLen + dataDirLen + dictDirLen;
  const buffer = Module._malloc(n);

  // 8 * 4 bytes = 32 bytes
  const len = 8 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(config.model ?? "", buffer + offset, modelLen);
  offset += modelLen;

  Module.stringToUTF8(config.lexicon ?? "", buffer + offset, lexiconLen);
  offset += lexiconLen;

  Module.stringToUTF8(config.tokens ?? "", buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(config.dataDir ?? "", buffer + offset, dataDirLen);
  offset += dataDirLen;

  Module.stringToUTF8(config.dictDir ?? "", buffer + offset, dictDirLen);
  offset += dictDirLen;

  offset = 0;
  Module.setValue(ptr + 0, buffer + offset, "i8*");
  offset += modelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += lexiconLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 16, (config.noiseScale ?? 0.667) as number, "float");
  Module.setValue(ptr + 20, (config.noiseScaleW ?? 0.8) as number, "float");
  Module.setValue(ptr + 24, (config.lengthScale ?? 1.0) as number, "float");

  Module.setValue(ptr + 28, buffer + offset, "i8*");
  offset += dictDirLen;

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsMatchaModelConfig(
  config: OfflineTtsMatchaModelConfig,
  Module: EmscriptenModule,
) {
  const acousticModelLen = Module.lengthBytesUTF8(config.acousticModel ?? "") + 1;
  const vocoderLen = Module.lengthBytesUTF8(config.vocoder ?? "") + 1;
  const lexiconLen = Module.lengthBytesUTF8(config.lexicon ?? "") + 1;
  const tokensLen = Module.lengthBytesUTF8(config.tokens ?? "") + 1;
  const dataDirLen = Module.lengthBytesUTF8(config.dataDir ?? "") + 1;
  const dictDirLen = Module.lengthBytesUTF8(config.dictDir ?? "") + 1;

  const n = acousticModelLen + vocoderLen + lexiconLen + tokensLen + dataDirLen + dictDirLen;
  const buffer = Module._malloc(n);

  const len = 8 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(config.acousticModel ?? "", buffer + offset, acousticModelLen);
  offset += acousticModelLen;

  Module.stringToUTF8(config.vocoder ?? "", buffer + offset, vocoderLen);
  offset += vocoderLen;

  Module.stringToUTF8(config.lexicon ?? "", buffer + offset, lexiconLen);
  offset += lexiconLen;

  Module.stringToUTF8(config.tokens ?? "", buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(config.dataDir ?? "", buffer + offset, dataDirLen);
  offset += dataDirLen;

  Module.stringToUTF8(config.dictDir ?? "", buffer + offset, dictDirLen);
  offset += dictDirLen;

  offset = 0;
  Module.setValue(ptr + 0, buffer + offset, "i8*");
  offset += acousticModelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += vocoderLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += lexiconLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 16, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 20, (config.noiseScale ?? 0.667) as number, "float");
  Module.setValue(ptr + 24, (config.lengthScale ?? 1.0) as number, "float");

  Module.setValue(ptr + 28, buffer + offset, "i8*");
  offset += dictDirLen;

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsKokoroModelConfig(
  config: OfflineTtsKokoroModelConfig,
  Module: EmscriptenModule,
) {
  const modelLen = Module.lengthBytesUTF8(config.model ?? "") + 1;
  const voicesLen = Module.lengthBytesUTF8(config.voices ?? "") + 1;
  const tokensLen = Module.lengthBytesUTF8(config.tokens ?? "") + 1;
  const dataDirLen = Module.lengthBytesUTF8(config.dataDir ?? "") + 1;
  const dictDirLen = Module.lengthBytesUTF8(config.dictDir ?? "") + 1;
  const lexiconLen = Module.lengthBytesUTF8(config.lexicon ?? "") + 1;
  const langLen = Module.lengthBytesUTF8(config.lang ?? "") + 1;

  const n = modelLen + voicesLen + tokensLen + dataDirLen + dictDirLen + lexiconLen + langLen;
  const buffer = Module._malloc(n);

  const len = 8 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(config.model ?? "", buffer + offset, modelLen);
  offset += modelLen;

  Module.stringToUTF8(config.voices ?? "", buffer + offset, voicesLen);
  offset += voicesLen;

  Module.stringToUTF8(config.tokens ?? "", buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(config.dataDir ?? "", buffer + offset, dataDirLen);
  offset += dataDirLen;

  Module.stringToUTF8(config.dictDir ?? "", buffer + offset, dictDirLen);
  offset += dictDirLen;

  Module.stringToUTF8(config.lexicon ?? "", buffer + offset, lexiconLen);
  offset += lexiconLen;

  Module.stringToUTF8(config.lang ?? "", buffer + offset, langLen);
  offset += langLen;

  offset = 0;
  Module.setValue(ptr + 0, buffer + offset, "i8*");
  offset += modelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += voicesLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 16, (config.lengthScale ?? 1.0) as number, "float");

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
  Module: EmscriptenModule,
) {
  const modelLen = Module.lengthBytesUTF8(config.model ?? "") + 1;
  const voicesLen = Module.lengthBytesUTF8(config.voices ?? "") + 1;
  const tokensLen = Module.lengthBytesUTF8(config.tokens ?? "") + 1;
  const dataDirLen = Module.lengthBytesUTF8(config.dataDir ?? "") + 1;

  const n = modelLen + voicesLen + tokensLen + dataDirLen;
  const buffer = Module._malloc(n);

  // 5 * 4 bytes = 20 bytes
  const len = 5 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  Module.stringToUTF8(config.model ?? "", buffer + offset, modelLen);
  offset += modelLen;

  Module.stringToUTF8(config.voices ?? "", buffer + offset, voicesLen);
  offset += voicesLen;

  Module.stringToUTF8(config.tokens ?? "", buffer + offset, tokensLen);
  offset += tokensLen;

  Module.stringToUTF8(config.dataDir ?? "", buffer + offset, dataDirLen);
  offset += dataDirLen;

  offset = 0;
  Module.setValue(ptr + 0, buffer + offset, "i8*");
  offset += modelLen;

  Module.setValue(ptr + 4, buffer + offset, "i8*");
  offset += voicesLen;

  Module.setValue(ptr + 8, buffer + offset, "i8*");
  offset += tokensLen;

  Module.setValue(ptr + 12, buffer + offset, "i8*");
  offset += dataDirLen;

  Module.setValue(ptr + 16, (config.lengthScale ?? 1.0) as number, "float");

  return { buffer, ptr, len };
}

function initSherpaOnnxOfflineTtsModelConfig(
  config: OfflineTtsModelConfig,
  Module: EmscriptenModule,
) {
  const vitsCfg: OfflineTtsVitsModelConfig = config.offlineTtsVitsModelConfig ?? {
    model: "",
    lexicon: "",
    tokens: "",
    noiseScale: 0.667,
    noiseScaleW: 0.8,
    lengthScale: 1.0,
    dataDir: "",
    dictDir: "",
  };

  const matchaCfg: OfflineTtsMatchaModelConfig = config.offlineTtsMatchaModelConfig ?? {
    acousticModel: "",
    vocoder: "",
    lexicon: "",
    tokens: "",
    noiseScale: 0.667,
    lengthScale: 1.0,
    dataDir: "",
    dictDir: "",
  };

  const kokoroCfg: OfflineTtsKokoroModelConfig = config.offlineTtsKokoroModelConfig ?? {
    model: "",
    voices: "",
    tokens: "",
    lengthScale: 1.0,
    dataDir: "",
    dictDir: "",
    lexicon: "",
    lang: "",
  };

  const kittenCfg: OfflineTtsKittenModelConfig = config.offlineTtsKittenModelConfig ?? {
    model: "",
    voices: "",
    tokens: "",
    lengthScale: 1.0,
    dataDir: "",
  };

  const vitsModelConfig = initSherpaOnnxOfflineTtsVitsModelConfig(vitsCfg, Module);
  const matchaModelConfig = initSherpaOnnxOfflineTtsMatchaModelConfig(matchaCfg, Module);
  const kokoroModelConfig = initSherpaOnnxOfflineTtsKokoroModelConfig(kokoroCfg, Module);
  const kittenModelConfig = initSherpaOnnxOfflineTtsKittenModelConfig(kittenCfg, Module);

  const provider = config.provider ?? "cpu";
  const providerBuf = mallocUtf8(Module, provider);

  // total struct size:
  // [vits(32)] [numThreads(4)] [debug(4)] [providerPtr(4)] [matcha(32)] [kokoro(32)] [kitten(20)]
  const len =
    vitsModelConfig.len +
    matchaModelConfig.len +
    kokoroModelConfig.len +
    kittenModelConfig.len +
    3 * 4;

  const ptr = Module._malloc(len);

  let offset = 0;
  copyHeap(Module, vitsModelConfig.ptr, vitsModelConfig.len, ptr + offset);
  offset += vitsModelConfig.len;

  Module.setValue(ptr + offset, (config.numThreads ?? 1) | 0, "i32");
  offset += 4;

  Module.setValue(ptr + offset, (config.debug ?? 0) | 0, "i32");
  offset += 4;

  Module.setValue(ptr + offset, providerBuf.ptr, "i8*");
  offset += 4;

  copyHeap(Module, matchaModelConfig.ptr, matchaModelConfig.len, ptr + offset);
  offset += matchaModelConfig.len;

  copyHeap(Module, kokoroModelConfig.ptr, kokoroModelConfig.len, ptr + offset);
  offset += kokoroModelConfig.len;

  copyHeap(Module, kittenModelConfig.ptr, kittenModelConfig.len, ptr + offset);
  offset += kittenModelConfig.len;

  return {
    buffer: providerBuf.ptr,
    ptr,
    len,
    config: vitsModelConfig,
    matcha: matchaModelConfig,
    kokoro: kokoroModelConfig,
    kitten: kittenModelConfig,
  } satisfies AnyConfigNode;
}

function initSherpaOnnxOfflineTtsConfig(config: OfflineTtsConfig, Module: EmscriptenModule) {
  const modelConfig = initSherpaOnnxOfflineTtsModelConfig(config.offlineTtsModelConfig, Module);

  // modelConfig + ruleFstsPtr + maxNumSentences + ruleFarsPtr + silenceScale
  const len = (modelConfig.len ?? 0) + 4 * 4;
  const ptr = Module._malloc(len);

  let offset = 0;
  copyHeap(Module, modelConfig.ptr, modelConfig.len ?? 0, ptr + offset);
  offset += modelConfig.len ?? 0;

  const ruleFsts = config.ruleFsts ?? "";
  const ruleFars = config.ruleFars ?? "";

  const ruleFstsLen = Module.lengthBytesUTF8(ruleFsts) + 1;
  const ruleFarsLen = Module.lengthBytesUTF8(ruleFars) + 1;

  const buffer = Module._malloc(ruleFstsLen + ruleFarsLen);
  Module.stringToUTF8(ruleFsts, buffer, ruleFstsLen);
  Module.stringToUTF8(ruleFars, buffer + ruleFstsLen, ruleFarsLen);

  Module.setValue(ptr + offset, buffer, "i8*");
  offset += 4;

  Module.setValue(ptr + offset, (config.maxNumSentences ?? 1) | 0, "i32");
  offset += 4;

  Module.setValue(ptr + offset, buffer + ruleFstsLen, "i8*");
  offset += 4;

  Module.setValue(ptr + offset, (config.silenceScale ?? 0.2) as number, "float");
  offset += 4;

  return {
    buffer,
    ptr,
    len,
    config: modelConfig,
  } satisfies AnyConfigNode;
}

// ---------- High-level API ----------
export class OfflineTts {
  readonly handle: number;
  readonly sampleRate: number;
  readonly numSpeakers: number;
  private readonly Module: EmscriptenModule;

  constructor(configObj: OfflineTtsConfig, Module: EmscriptenModule) {
    const cfg = initSherpaOnnxOfflineTtsConfig(configObj, Module);
    const handle = Module._SherpaOnnxCreateOfflineTts(cfg.ptr);

    // free temporary config allocations
    freeConfig(cfg, Module);

    this.handle = handle;
    this.sampleRate = Module._SherpaOnnxOfflineTtsSampleRate(handle);
    this.numSpeakers = Module._SherpaOnnxOfflineTtsNumSpeakers(handle);
    this.Module = Module;
  }

  free() {
    this.Module._SherpaOnnxDestroyOfflineTts(this.handle);
    // (handle becomes invalid; you can track state if you want)
  }

  generate(config: GenerateConfig): GeneratedAudio {
    const { ptr: textPtr } = mallocUtf8(this.Module, config.text);

    try {
      const h = this.Module._SherpaOnnxOfflineTtsGenerate(
        this.handle,
        textPtr,
        config.sid | 0,
        +config.speed,
      );

      const numSamples = this.Module.HEAP32[h / 4 + 1];
      const sampleRate = this.Module.HEAP32[h / 4 + 2];

      const samplesPtrWords = this.Module.HEAP32[h / 4] / 4;
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = this.Module.HEAPF32[samplesPtrWords + i];
      }

      this.Module._SherpaOnnxDestroyOfflineTtsGeneratedAudio(h);
      return { samples, sampleRate };
    } finally {
      // Fixes leak in original JS
      this.Module._free(textPtr);
    }
  }

  save(filename: string, audio: GeneratedAudio) {
    const { samples, sampleRate } = audio;

    const samplesPtr = this.Module._malloc(samples.length * 4);
    for (let i = 0; i < samples.length; i++) {
      this.Module.HEAPF32[samplesPtr / 4 + i] = samples[i];
    }

    const { ptr: filenamePtr } = mallocUtf8(this.Module, filename);

    try {
      this.Module._SherpaOnnxWriteWave(samplesPtr, samples.length, sampleRate, filenamePtr);
    } finally {
      this.Module._free(filenamePtr);
      this.Module._free(samplesPtr);
    }
  }
}

export function createOfflineTts(Module: EmscriptenModule, myConfig?: OfflineTtsConfig) {
  // Same defaults as your original JS
  const offlineTtsVitsModelConfig: OfflineTtsVitsModelConfig = {
    model: "./model.onnx",
    lexicon: "",
    tokens: "./tokens.txt",
    dataDir: "./espeak-ng-data",
    dictDir: "",
    noiseScale: 0.667,
    noiseScaleW: 0.8,
    lengthScale: 1.0,
  };

  const offlineTtsMatchaModelConfig: OfflineTtsMatchaModelConfig = {
    acousticModel: "",
    vocoder: "",
    lexicon: "",
    tokens: "",
    dataDir: "",
    dictDir: "",
    noiseScale: 0.667,
    lengthScale: 1.0,
  };

  const offlineTtsKokoroModelConfig: OfflineTtsKokoroModelConfig = {
    model: "",
    voices: "",
    tokens: "",
    dataDir: "",
    lengthScale: 1.0,
    dictDir: "",
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

  const offlineTtsModelConfig: OfflineTtsModelConfig = {
    offlineTtsVitsModelConfig,
    offlineTtsMatchaModelConfig,
    offlineTtsKokoroModelConfig,
    offlineTtsKittenModelConfig,
    numThreads: 1,
    debug: 1,
    provider: "cpu",
  };

  const defaultConfig: OfflineTtsConfig = {
    offlineTtsModelConfig,
    ruleFsts: "",
    ruleFars: "",
    maxNumSentences: 1,
  };

  return new OfflineTts(myConfig ?? defaultConfig, Module);
}

export function getSherpaOnnxVersion(Module: EmscriptenModule) {
  const ptr = Module._SherpaOnnxGetVersionStr();
  return Module.UTF8ToString(ptr);
}
