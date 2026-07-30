export type Genre = "great-person" | "education" | "fortune" | "bgm" | "other";
export type Platform = "youtube-shorts" | "instagram-reels" | "tiktok";

export interface CreatorProject {
  id: string;
  title: string;
  genre: Genre;
  platform: Platform;
  aspectRatio: "9:16";
  targetDurationSec: number;
  displayScript: string;
  speechScript: string;
  scenes: Scene[];
  narration: NarrationSettings;
  subtitleStyle: SubtitleStyle;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

export interface Scene {
  id: string;
  order: number;
  text: string;
  speechText: string;
  startSec: number;
  endSec: number;
  motion: "none" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right";
  transition: "cut" | "fade";
}

export interface NarrationSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface SubtitleStyle {
  fontSize: number;
  position: "top" | "center" | "bottom";
  maxCharsPerLine: number;
}
