const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const stringOr = (value, fallback = '') => typeof value === 'string' ? value : fallback;

function cloneSafe(value, depth = 0) {
  if (depth > 20) return undefined;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(item => cloneSafe(item, depth + 1)).filter(item => item !== undefined);
  if (!isRecord(value)) return undefined;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    const cloned = cloneSafe(item, depth + 1);
    if (cloned !== undefined) result[key] = cloned;
  }
  return result;
}

function newId(createId) {
  return String(createId?.() || globalThis.crypto?.randomUUID?.() || `decision-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export function normalizeSceneOrderSnapshot(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index) => ({
    sceneId: stringOr(item.sceneId).trim(),
    order: Number.isFinite(Number(item.order)) ? Math.max(1, Math.round(Number(item.order))) : index + 1,
    text: stringOr(item.text)
  })).filter(item => item.sceneId);
}

export function normalizeDecisionRecord(value) {
  if (!isRecord(value)) return null;
  const decisionType = stringOr(value.decisionType).trim();
  const projectId = stringOr(value.projectId).trim();
  if (!decisionType || !projectId) return null;
  const record = {
    id: stringOr(value.id).trim(),
    decisionType,
    projectId,
    sceneId: stringOr(value.sceneId).trim(),
    context: isRecord(value.context) ? cloneSafe(value.context) : {},
    proposal: cloneSafe(value.proposal) ?? null,
    alternatives: Array.isArray(value.alternatives) ? cloneSafe(value.alternatives) : [],
    humanAction: isRecord(value.humanAction) ? cloneSafe(value.humanAction) : {},
    finalDecision: cloneSafe(value.finalDecision) ?? null,
    reasonCode: stringOr(value.reasonCode).trim(),
    reasonNote: stringOr(value.reasonNote),
    source: isRecord(value.source) ? cloneSafe(value.source) : {},
    assetIds: Array.isArray(value.assetIds) ? value.assetIds.map(item => stringOr(item).trim()).filter(Boolean) : [],
    rights: isRecord(value.rights) ? cloneSafe(value.rights) : {},
    timestamp: stringOr(value.timestamp).trim()
  };
  return record;
}

export function normalizeLearningState(value) {
  const source = isRecord(value) ? value : {};
  const decisions = Array.isArray(source.decisions)
    ? source.decisions.map(normalizeDecisionRecord).filter(Boolean)
    : [];
  return { decisions };
}

export function ensureLearningState(project) {
  if (!isRecord(project)) throw new Error('projectがありません。');
  project.learning = normalizeLearningState(project.learning);
  return project.learning;
}

export function snapshotSceneOrder(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  return scenes.map((scene, index) => ({
    sceneId: stringOr(scene?.id).trim(),
    order: index + 1,
    text: stringOr(scene?.text)
  })).filter(item => item.sceneId);
}

export function appendDecision(project, input, { createId, now = () => new Date().toISOString() } = {}) {
  const learning = ensureLearningState(project);
  const candidate = {
    ...cloneSafe(input),
    id: stringOr(input?.id).trim() || newId(createId),
    projectId: stringOr(input?.projectId).trim() || stringOr(project.id).trim(),
    timestamp: stringOr(input?.timestamp).trim() || now()
  };
  const record = normalizeDecisionRecord(candidate);
  if (!record) throw new Error('DecisionRecordにdecisionTypeまたはprojectIdがありません。');
  learning.decisions.push(record);
  return record;
}

export function recordSceneOrderChange(project, { sceneId, direction, before, after }, options = {}) {
  const normalizedBefore = normalizeSceneOrderSnapshot(before);
  const normalizedAfter = normalizeSceneOrderSnapshot(after);
  if (!sceneId || !normalizedBefore.length || !normalizedAfter.length) return null;
  const beforeIds = normalizedBefore.map(item => item.sceneId).join('|');
  const afterIds = normalizedAfter.map(item => item.sceneId).join('|');
  if (beforeIds === afterIds) return null;
  return appendDecision(project, {
    decisionType: 'scene-order',
    sceneId: String(sceneId),
    context: { screen: 'scene-editor', before: normalizedBefore },
    proposal: normalizedBefore,
    alternatives: [],
    humanAction: { type: 'reorder', direction: direction === 'up' ? 'up' : 'down' },
    finalDecision: normalizedAfter,
    reasonCode: '',
    reasonNote: '',
    source: { type: 'system', feature: 'scene-editor', version: '0.1' },
    assetIds: [],
    rights: {}
  }, options);
}

export function moveSceneWithDecision(project, index, direction, options = {}) {
  ensureLearningState(project);
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const from = Number(index);
  const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  const to = from + delta;
  if (!Number.isInteger(from) || !delta || from < 0 || from >= scenes.length || to < 0 || to >= scenes.length) return null;
  const movedScene = scenes[from];
  if (!movedScene?.id) return null;
  const before = snapshotSceneOrder(project);
  [scenes[from], scenes[to]] = [scenes[to], scenes[from]];
  const after = snapshotSceneOrder(project);
  return recordSceneOrderChange(project, { sceneId: movedScene.id, direction, before, after }, options);
}
