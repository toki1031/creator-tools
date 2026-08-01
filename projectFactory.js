/** @param {string} title @param {import('./project.js').Genre} genre @param {import('./project.js').Platform} platform */
export function createProject(title, genre, platform) {
  const now = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
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
