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
    mediaLibrary: [],
    narration: { voiceURI: "", rate: 0.92, pitch: 0.94, volume: 1, source:"browser", audioData:"", fileName:"", mimeType:"" },
    subtitleStyle: { enabled:true, preset:"standard", fontSize:54, position:"bottom", positionOffsetPercent:0, maxCharsPerLine:16, maxLines:2, textColor:"#ffffff", outlineColor:"#000000", outlineWidth:4, backgroundEnabled:false, backgroundColor:"#000000", backgroundOpacity:0.45, align:"center" },
    createdAt: now,
    updatedAt: now,
    schemaVersion: 4
  };
}
