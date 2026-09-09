const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const ALLOWED = ['platform', 'aspectRatio', 'subtitleStyle', 'bgm'];

export function createProductionPreset(project, name = '制作プリセット') {
  const settings = {};
  for (const key of ALLOWED) if (project?.[key] !== undefined) settings[key] = clone(project[key]);
  if (settings.bgm) {
    delete settings.bgm.audioData;
    delete settings.bgm.dataUrl;
  }
  return { version: 1, name: String(name || '制作プリセット').trim(), settings };
}

export function applyProductionPreset(project, preset) {
  if (!project || typeof project !== 'object' || !preset?.settings) return project;
  const next = { ...project };
  for (const key of ALLOWED) if (preset.settings[key] !== undefined) next[key] = clone(preset.settings[key]);
  return next;
}
