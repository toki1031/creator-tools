import type { CreatorProject, Genre, Platform } from "../../types/project";

export function createProject(title: string, genre: Genre, platform: Platform): CreatorProject {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: title.trim() || "無題のプロジェクト",
    genre,
    platform,
    aspectRatio: "9:16",
    targetDurationSec: 60,
    displayScript: "",
    speechScript: "",
    scenes: [],
    narration: { voiceURI: "", rate: 0.92, pitch: 0.94, volume: 1 },
    subtitleStyle: { fontSize: 54, position: "bottom", maxCharsPerLine: 16 },
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1
  };
}
