const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const ALLOWED = ['platform', 'aspectRatio', 'subtitleStyle', 'bgm'];
const PROJECT_SPECIFIC_BGM_KEYS = [
  'audioData', 'dataUrl', 'audioAssetId', 'assetId', 'fileName', 'fileHandle', 'blob', 'objectUrl'
];

function reusableBgmSettings(bgm) {
  if (!bgm || typeof bgm !== 'object') return bgm;
  const safe = clone(bgm);
  for (const key of PROJECT_SPECIFIC_BGM_KEYS) delete safe[key];
  return safe;
}

export function createProductionPreset(project, name = '制作プリセット') {
  const settings = {};
  for (const key of ALLOWED) if (project?.[key] !== undefined) settings[key] = clone(project[key]);
  if (settings.bgm) settings.bgm = reusableBgmSettings(settings.bgm);
  return { version: 2, name: String(name || '制作プリセット').trim(), settings };
}

export function applyProductionPreset(project, preset) {
  if (!project || typeof project !== 'object' || !preset?.settings) return project;
  const next = { ...project };
  for (const key of ALLOWED) {
    if (preset.settings[key] === undefined) continue;
    if (key === 'bgm') {
      const current = project.bgm && typeof project.bgm === 'object' ? clone(project.bgm) : {};
      next.bgm = { ...current, ...reusableBgmSettings(preset.settings.bgm) };
      continue;
    }
    next[key] = clone(preset.settings[key]);
  }
  return next;
}
