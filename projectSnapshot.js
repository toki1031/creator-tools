const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const SNAPSHOT_FIELDS = ['script', 'speechScript', 'displayScript', 'platform', 'aspectRatio', 'genre', 'targetDurationSec', 'subtitleStyle', 'publish'];
const SCENE_FIELDS = ['id', 'text', 'speechText', 'subtitleText', 'durationSec', 'imageAssetId', 'motion', 'transition', 'subtitlePosition'];
const BGM_FIELDS = ['enabled', 'volume', 'loop', 'ducking', 'fadeInSec', 'fadeOutSec', 'title', 'fileName', 'category', 'sourceUrl', 'license', 'commercialUse', 'credit', 'audioAssetId'];

function pick(source, fields) {
  const out = {};
  for (const field of fields) if (source?.[field] !== undefined) out[field] = clone(source[field]);
  return out;
}

export function createProjectSnapshot(project, { label = '復元点', now = () => new Date().toISOString() } = {}) {
  if (!project?.id) throw new Error('プロジェクトがありません。');
  const state = pick(project, SNAPSHOT_FIELDS);
  state.scenes = (Array.isArray(project.scenes) ? project.scenes : []).map(scene => pick(scene, SCENE_FIELDS));
  if (project.bgm) state.bgm = pick(project.bgm, BGM_FIELDS);
  return {
    version: 1,
    projectId: String(project.id),
    label: String(label || '復元点').trim() || '復元点',
    createdAt: now(),
    state
  };
}

export function restoreProjectSnapshot(project, snapshot) {
  if (!project?.id || snapshot?.version !== 1 || String(snapshot.projectId) !== String(project.id) || !snapshot?.state) {
    throw new Error('このプロジェクトへ復元できる復元点ではありません。');
  }
  const next = clone(project);
  for (const field of SNAPSHOT_FIELDS) {
    if (snapshot.state[field] !== undefined) next[field] = clone(snapshot.state[field]);
  }

  const currentById = new Map((Array.isArray(project.scenes) ? project.scenes : []).map(scene => [String(scene?.id || ''), scene]));
  next.scenes = (Array.isArray(snapshot.state.scenes) ? snapshot.state.scenes : []).map(savedScene => {
    const current = currentById.get(String(savedScene?.id || '')) || {};
    return { ...clone(current), ...clone(savedScene) };
  });

  if (snapshot.state.bgm !== undefined) {
    const currentBgm = clone(project.bgm || {});
    next.bgm = { ...currentBgm, ...clone(snapshot.state.bgm) };
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function estimateProjectSnapshotSize(snapshot) {
  try { return new TextEncoder().encode(JSON.stringify(snapshot)).length; }
  catch { return 0; }
}
