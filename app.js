import { SpeechClient } from "./dist/index.js";

async function main() {
    await SpeechClient.loadModel("")
    await SpeechClient.generate("","","")
    // await client.init(voiceId="", text="", options={})
}

main()