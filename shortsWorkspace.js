const clone = value => {
  try { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  catch { return null; }
};

function findDraft(project, draftId) {
  const drafts = Array.isArray(project?.shortsDrafts) ? project.shortsDrafts : [];
  return drafts.find(item => String(item?.id || '') === String(draftId || '')) || null;
}

export function resolveShortsWorkspace(project, draftId) {
  const draft = findDraft(project, draftId);
  if (!draft) return null;
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const byId = new Map(scenes.map((scene, index) => [String(scene?.id || ''), { scene, sourceIndex:index }]));
  const refs = Array.isArray(draft.sceneIds) ? draft.sceneIds.map(String) : [];
  const resolved = [];
  const missingSceneIds = [];

  for (const sceneId of refs) {
    const hit = byId.get(sceneId);
    if (hit) resolved.push({ sceneId, sourceIndex:hit.sourceIndex, sourceNumber:hit.sourceIndex + 1, scene:clone(hit.scene) || hit.scene });
    else if (sceneId) missingSceneIds.push(sceneId);
  }

  if (!resolved.length && Number.isInteger(Number(draft.startIndex)) && Number.isInteger(Number(draft.endIndex))) {
    const start = Math.max(0, Number(draft.startIndex));
    const end = Math.min(scenes.length - 1, Number(draft.endIndex));
    for (let index = start; index <= end; index++) {
      const scene = scenes[index];
      if (!scene) continue;
      resolved.push({ sceneId:String(scene.id || ''), sourceIndex:index, sourceNumber:index + 1, scene:clone(scene) || scene });
    }
  }

  return {
    draft: clone(draft) || draft,
    scenes: resolved,
    missingSceneIds,
    sourceProjectId: String(project?.id || ''),
    sourceProjectTitle: String(project?.title || ''),
    aspectRatio: '9:16'
  };
}

export function updateShortsDraftSceneOrder(project, draftId, orderedSceneIds, { now = () => new Date().toISOString() } = {}) {
  const draft = findDraft(project, draftId);
  if (!draft) throw new Error('Shorts案が見つかりません。');
  const allowed = new Set((Array.isArray(draft.sceneIds) ? draft.sceneIds : []).map(String));
  const next = Array.isArray(orderedSceneIds) ? orderedSceneIds.map(String) : [];
  if (next.length !== allowed.size || new Set(next).size !== next.length || next.some(id => !allowed.has(id))) {
    throw new Error('Shorts案のScene順が正しくありません。');
  }
  draft.sceneIds = next;
  draft.updatedAt = now();
  return clone(draft) || draft;
}

export function updateShortsDraftSettings(project, draftId, values = {}, { now = () => new Date().toISOString() } = {}) {
  const draft = findDraft(project, draftId);
  if (!draft) throw new Error('Shorts案が見つかりません。');
  if (typeof values.title === 'string' && values.title.trim()) draft.title = values.title.trim();
  draft.aspectRatio = '9:16';
  if (Number.isFinite(Number(values.targetDurationSec))) draft.targetDurationSec = Math.max(15, Math.min(60, Number(values.targetDurationSec)));
  draft.updatedAt = now();
  return clone(draft) || draft;
}
