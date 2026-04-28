# @wfloat/wfloat-web

`@wfloat/wfloat-web` is the browser package for Wfloat text-to-speech. It downloads the model and runtime assets the first time a user loads a model, caches them in the browser, and runs speech generation locally in the app.

## Install

```bash
npm install @wfloat/wfloat-web
```

```bash
yarn add @wfloat/wfloat-web
```

## Quick start

Your `modelId` is the **Model Credential** shown in your Wfloat account after purchase.

```ts
import { SpeechClient } from "@wfloat/wfloat-web";

const modelId = "your-model-credential";

await SpeechClient.loadModel(modelId, {
  onProgressCallback(event) {
    if (event.status === "downloading") {
      console.log("Downloading", Math.round(event.progress * 100) + "%");
      return;
    }

    if (event.status === "loading") {
      console.log("Initializing runtime");
      return;
    }

    console.log("Model ready");
  },
});

await SpeechClient.generate({
  text: "The signal is clean. Start the recording.",
  voiceId: "narrator_woman",
  emotion: "neutral",
  intensity: 0.5,
  speed: 1,
  silencePaddingSec: 0.1,
  onProgressCallback(event) {
    console.log("progress", event.progress);
    console.log("isPlaying", event.isPlaying);
    console.log("highlight", event.textHighlightStart, event.textHighlightEnd);
    console.log("chunkText", event.text);
  },
  onFinishedPlayingCallback() {
    console.log("Playback finished");
  },
});
```

## API overview

- `SpeechClient.loadModel(modelId, { onProgressCallback })` loads the model onto the device. The first load downloads model and runtime assets for the browser.
- `SpeechClient.generate(options)` generates a single utterance and starts playback.
- `SpeechClient.generateDialogue(options)` generates multi-speaker dialogue from a list of segments.
- `SpeechClient.pause()` and `SpeechClient.play()` control playback for the active request.

## Progress callbacks

`loadModel(...)` emits:

```ts
{ status: "downloading", progress: number }
{ status: "loading" }
{ status: "completed" }
```

`generate(...)` emits:

```ts
{
  progress: number;
  isPlaying: boolean;
  textHighlightStart: number;
  textHighlightEnd: number;
  text: string;
}
```

`generateDialogue(...)` emits the same fields plus `textHighlightSegment`.

## Dialogue example

```ts
await SpeechClient.generateDialogue({
  silenceBetweenSegmentsSec: 0.2,
  onProgressCallback(event) {
    console.log(event.progress);
  },
  onFinishedPlayingCallback() {
    console.log("Dialogue finished");
  },
  segments: [
    {
      text: "The door is locked.",
      voiceId: "narrator_man",
      emotion: "neutral",
    },
    {
      text: "Then we open it the loud way.",
      voiceId: "strong_hero_woman",
      emotion: "joy",
      intensity: 0.65,
    },
  ],
});
```

## Browser note

Start generation from a user gesture such as a button click. Browsers can block audio playback until the page has received user interaction.

## Contributing

Maintainer and local development notes live in [CONTRIBUTING.md](CONTRIBUTING.md).
