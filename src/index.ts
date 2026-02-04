// console.log("hello");

// // @ts-ignore
// import sherpaOnnx from "../wasm/index.js";

// export function getSherpaOnnxVersion(): string {
//   return sherpaOnnx.version;
// }

import { getModule } from "./wasm/module.js";
import { getSherpaOnnxVersion } from "./wasm/sherpa-onnx-tts.js";

async function main() {
  const Module = await getModule();

  console.log(getSherpaOnnxVersion(Module));
}

main();
