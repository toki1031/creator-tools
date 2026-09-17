export type Genre = "great-person" | "education" | "fortune" | "bgm" | "other";
export type Platform = "youtube-shorts" | "instagram-reels" | "tiktok";

export type ProductionAssetType =
  | "historical-source"
  | "ai-reconstruction"
  | "modern-visual"
  | "document"
  | "other";

export interface ProductionSceneDirective {
  sceneId: string;
  visualDirection: string;
  purpose: string;
  assetType: ProductionAssetType;
  motionGuidance: string;
  rules: string[];
  narrationText?: string;
  subtitleText?: string;
  startSec?: number;
  endSec?: number;
  durationSec?: number;
}

export interface ProductionBrief {
  objective: string;
  tone: string;
  globalRules: string[];
  subtitleGuidance: string[];
  narrationGuidance: string[];
  bgmGuidance: string[];
  seGuidance: string[];
  sceneDirectives: ProductionSceneDirective[];
  qaCriteria: string[];
}

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
  productionBrief?: ProductionBrief;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

export interface Scene {
  id: string;
  order: number;
  text: string;
  speechText: string;
  subtitleText?: string;
  durationSec: number;
  startSec?: number;
  endSec?: number;
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
