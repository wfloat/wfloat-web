import { SpeechClient } from "./dist/index.js";

async function main() {
    const client = new SpeechClient()
    await client.init()
    // await client.init(voiceId="", text="", options={})
}

main()