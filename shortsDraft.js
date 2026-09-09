const clone = value => {
  try { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  catch { return null; }
};

function makeId(prefix = 'shorts-draft') {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function createShortsDraft(project, candidate, { now = () => new Date().toISOString(), createId = makeId } = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const startIndex = Number(candidate?.startIndex);
  const endIndex = Number(candidate?.endIndex);
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex < startIndex || endIndex >= scenes.length) {
    throw new Error('Shorts候補のScene範囲が正しくありません。');
  }
  const selected = scenes.slice(startIndex, endIndex + 1);
  const timestamp = now();
  return {
    id: createId('shorts-draft'),
    sourceProjectId: String(project?.id || ''),
    sourceProjectUpdatedAt: String(project?.updatedAt || ''),
    title: `Shorts案 ${startIndex + 1}-${endIndex + 1}`,
    startIndex,
    endIndex,
    sceneIds: selected.map(scene => String(scene?.id || '')),
    sceneNumbers: selected.map((_, index) => startIndex + index + 1),
    durationSec: Math.max(0, Number(candidate?.durationSec) || selected.reduce((sum, scene) => sum + (Number(scene?.durationSec) || 0), 0)),
    score: Math.max(0, Math.min(100, Number(candidate?.score) || 0)),
    reasons: Array.isArray(candidate?.reasons) ? candidate.reasons.map(String) : [],
    previewText: String(candidate?.previewText || ''),
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function saveShortsDraft(project, candidate, options = {}) {
  if (!project || typeof project !== 'object') throw new Error('プロジェクトがありません。');
  const draft = createShortsDraft(project, candidate, options);
  const current = Array.isArray(project.shortsDrafts) ? project.shortsDrafts : [];
  const signature = `${draft.startIndex}:${draft.endIndex}`;
  const exists = current.find(item => `${Number(item?.startIndex)}:${Number(item?.endIndex)}` === signature);
  if (exists) return { project, draft: clone(exists) || exists, created: false };
  project.shortsDrafts = [...current, draft];
  return { project, draft: clone(draft) || draft, created: true };
}

export function listShortsDrafts(project) {
  return (Array.isArray(project?.shortsDrafts) ? project.shortsDrafts : [])
    .filter(item => item && typeof item === 'object')
    .map(item => clone(item) || item)
    .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
}
