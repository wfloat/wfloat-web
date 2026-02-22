export type SpeechEmotion =
  | "neutral"
  | "joy"
  | "sadness"
  | "anger"
  | "fear"
  | "surprise"
  | "dismissive"
  | "confusion";

export type SpeechClientStatus = "playing" | "paused" | "generating" | "loading-model";

export type SpeechStyle = "default" | "sarcastic" | "playful" | "calm" | "dramatic" | "serious";

export type SpeechOnProgressEvent = {
  progress?: number;
  textHighlightStart?: number;
  textHighlightEnd?: number;
};

export type SpeechClientGenerateOptions = {
  voiceId?: string | number;
  text: string;
  emotion?: SpeechEmotion | string;
  style?: SpeechStyle | string;
  intensity?: number;
  speed?: number;
  onProgressCallback?: (event: SpeechOnProgressEvent) => void;
};

export const VALID_EMOTIONS: SpeechEmotion[] = [
  "neutral",
  "joy",
  "sadness",
  "anger",
  "fear",
  "surprise",
  "dismissive",
  "confusion",
];

export const VALID_STYLES: SpeechStyle[] = [
  "default",
  "sarcastic",
  "playful",
  "calm",
  "dramatic",
  "serious",
];

export const SPEAKER_IDS: Record<string, number> = {
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

export const VALID_SIDS = Object.values(SPEAKER_IDS);
