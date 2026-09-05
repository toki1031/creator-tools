import { consumePromotedLegacyAssetId, isImageDataUrl } from './mediaLibrary.js';
import { normalizeSubtitleOffset } from './subtitlePosition.js';
import { normalizeAudioAssetId } from './audioAssetIdentity.js';

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


export function recordSceneDurationChange(project, {
  sceneId,
  beforeDurationSec,
  afterDurationSec,
  sceneIndex,
  totalDurationBefore
}, options = {}) {
  const before = Number(beforeDurationSec);
  const after = Number(afterDurationSec);
  if (!sceneId || !Number.isFinite(before) || !Number.isFinite(after) || before < 1 || after < 1) return null;
  if (Math.abs(before - after) < 0.001) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : scenes.find(item => String(item?.id || '') === String(sceneId));
  const targetDuration = Number(project?.targetDurationSec);
  const suppliedTotalBefore = Number(totalDurationBefore);
  const currentTotal = scenes.reduce((sum, item) => sum + (Number(item?.durationSec) || 0), 0);
  const inferredTotalBefore = Number.isFinite(currentTotal) ? currentTotal - after + before : before;

  return appendDecision(project, {
    decisionType: 'scene-duration',
    sceneId: String(sceneId),
    context: {
      screen: 'scene-editor',
      sceneIndex: resolvedIndex,
      sceneNumber: resolvedIndex >= 0 ? resolvedIndex + 1 : null,
      sceneText: stringOr(scene?.text),
      targetDurationSec: Number.isFinite(targetDuration) ? targetDuration : null,
      projectTotalDurationSecBefore: Number.isFinite(suppliedTotalBefore) ? suppliedTotalBefore : inferredTotalBefore
    },
    proposal: { durationSec: before },
    alternatives: [],
    humanAction: { type: 'set-duration' },
    finalDecision: { durationSec: after },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'system', feature: 'scene-editor', version: '0.2' },
    assetIds: [],
    rights: {}
  }, options);
}

function normalizeSubtitleDecisionText(value = '') {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

function summarizeSubtitleDecisionText(value = '') {
  const text = normalizeSubtitleDecisionText(value);
  const trimmed = text.trim();
  const cards = trimmed
    ? trimmed.split(/\n\s*\n+/).map(card => card.trim()).filter(Boolean)
    : [];
  const forcedLineBreakCount = cards.reduce((sum, card) => sum + Math.max(0, card.split('\n').length - 1), 0);
  return { text, cardCount: cards.length, forcedLineBreakCount, cards };
}

function subtitleContentSignature(value = '') {
  return normalizeSubtitleDecisionText(value).replace(/\s+/g, '');
}

function subtitleBreakLayout(value = '') {
  const raw = normalizeSubtitleDecisionText(value).trim();
  if (!raw) return { forced: [], cards: [] };
  const blocks = raw.split(/\n\s*\n+/);
  const forced = [];
  const cards = [];
  let offset = 0;
  blocks.forEach((block, blockIndex) => {
    const lines = block.split('\n');
    lines.forEach((line, lineIndex) => {
      offset += Array.from(line.replace(/\s+/g, '')).length;
      if (lineIndex < lines.length - 1) forced.push(offset);
    });
    if (blockIndex < blocks.length - 1) cards.push(offset);
  });
  return { forced, cards };
}

export function recordSubtitleContentChange(project, {
  sceneId,
  beforeText,
  afterText,
  sceneIndex,
  maxCharsPerLine,
  maxLines
}, options = {}) {
  if (!sceneId) return null;
  const before = summarizeSubtitleDecisionText(beforeText);
  const after = summarizeSubtitleDecisionText(afterText);
  if (before.text === after.text) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : scenes.find(item => String(item?.id || '') === String(sceneId));
  const beforeLayout = subtitleBreakLayout(before.text);
  const afterLayout = subtitleBreakLayout(after.text);
  const changeKinds = [];
  if (subtitleContentSignature(before.text) !== subtitleContentSignature(after.text)) changeKinds.push('text');
  if (JSON.stringify(beforeLayout.forced) !== JSON.stringify(afterLayout.forced)) changeKinds.push('forced-line-break');
  if (JSON.stringify(beforeLayout.cards) !== JSON.stringify(afterLayout.cards)) changeKinds.push('card-split');
  if (!changeKinds.length) return null;

  const charsPerLine = Number(maxCharsPerLine);
  const lineLimit = Number(maxLines);
  return appendDecision(project, {
    decisionType: 'subtitle-content',
    sceneId: String(sceneId),
    context: {
      screen: 'subtitle-editor',
      sceneIndex: resolvedIndex,
      sceneNumber: resolvedIndex >= 0 ? resolvedIndex + 1 : null,
      sceneText: stringOr(scene?.text),
      durationSec: Number.isFinite(Number(scene?.durationSec)) ? Number(scene.durationSec) : null,
      maxCharsPerLine: Number.isFinite(charsPerLine) ? charsPerLine : null,
      maxLines: Number.isFinite(lineLimit) ? lineLimit : null
    },
    proposal: before,
    alternatives: [],
    humanAction: { type: 'edit-subtitle', changeKinds },
    finalDecision: after,
    reasonCode: '',
    reasonNote: '',
    source: { type: 'system', feature: 'subtitle-editor', version: '0.3' },
    assetIds: [],
    rights: {}
  }, options);
}

function validImageAssetMap(project) {
  const assets = Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [];
  return new Map(assets.flatMap(asset => {
    const id = stringOr(asset?.id).trim();
    return id && asset?.type === 'image' && isImageDataUrl(asset?.data) ? [[id, asset]] : [];
  }));
}

function imageAssetRights(asset) {
  if (!isRecord(asset)) return {};
  const rights = isRecord(asset.rights) ? cloneSafe(asset.rights) : {};
  for (const key of [
    'license', 'licenseUrl', 'source', 'sourceName', 'commercialUse',
    'monetizationAllowed', 'attributionRequired', 'attributionText'
  ]) {
    if (asset[key] !== undefined) rights[key] = cloneSafe(asset[key]);
  }
  return rights;
}

export function recordSceneImageSelection(project, {
  sceneId,
  beforeAssetId,
  afterAssetId,
  sceneIndex,
  candidateAssetIds
}, options = {}) {
  const explicitBefore = stringOr(beforeAssetId).trim() || null;
  const after = stringOr(afterAssetId).trim() || null;
  if (!sceneId) return null;

  const assets = validImageAssetMap(project);
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    && String(scenes[requestedIndex]?.id || '') === String(sceneId)
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : null;
  if (!scene) return null;

  const promotedBefore = consumePromotedLegacyAssetId(scene);
  const before = explicitBefore || (promotedBefore && assets.has(promotedBefore) ? promotedBefore : null);
  if (before === after) return null;
  if (after && !assets.has(after)) return null;

  const candidates = Array.isArray(candidateAssetIds)
    ? [...new Set(candidateAssetIds.map(id => stringOr(id).trim()).filter(id => id && assets.has(id)))]
    : [];
  const alternatives = candidates.filter(id => id !== after).map(imageAssetId => ({ imageAssetId }));
  const assetIds = [...new Set([before, after, ...candidates].filter(id => id && assets.has(id)))];
  const rights = after ? imageAssetRights(assets.get(after)) : {};

  return appendDecision(project, {
    decisionType: 'scene-image-selection',
    sceneId: String(sceneId),
    context: {
      sceneText: stringOr(scene.text),
      sceneIndex: resolvedIndex,
      platform: stringOr(project?.platform),
      aspectRatio: stringOr(project?.aspectRatio)
    },
    proposal: { imageAssetId: before },
    alternatives,
    humanAction: { type: 'select-image-asset' },
    finalDecision: { imageAssetId: after },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'scene-editor', version: '0.4' },
    assetIds,
    rights
  }, options);
}

const SCENE_MOTIONS = new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']);

export function recordSceneMotionChange(project, {
  sceneId,
  beforeMotion,
  afterMotion,
  sceneIndex
}, options = {}) {
  const before = stringOr(beforeMotion).trim();
  const after = stringOr(afterMotion).trim();
  if (!sceneId || !SCENE_MOTIONS.has(before) || !SCENE_MOTIONS.has(after) || before === after) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    && String(scenes[requestedIndex]?.id || '') === String(sceneId)
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : null;
  if (!scene) return null;

  const assets = validImageAssetMap(project);
  const imageAssetId = stringOr(scene.imageAssetId).trim();
  const imageAsset = assets.get(imageAssetId);
  const context = {
    sceneText: stringOr(scene.text),
    sceneIndex: resolvedIndex,
    durationSec: Number.isFinite(Number(scene.durationSec)) ? Number(scene.durationSec) : null,
    platform: stringOr(project?.platform),
    aspectRatio: stringOr(project?.aspectRatio)
  };
  if (imageAsset) context.imageAssetId = imageAssetId;

  return appendDecision(project, {
    decisionType: 'scene-motion',
    sceneId: String(sceneId),
    context,
    proposal: { motion: before },
    alternatives: [],
    humanAction: { type: 'select-scene-motion' },
    finalDecision: { motion: after },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'scene-editor', version: '0.5' },
    assetIds: imageAsset ? [imageAssetId] : [],
    rights: imageAsset ? imageAssetRights(imageAsset) : {}
  }, options);
}

const SCENE_TRANSITIONS = new Set(['fade', 'cut']);

export function recordSceneTransitionChange(project, {
  sceneId,
  beforeTransition,
  afterTransition,
  sceneIndex
}, options = {}) {
  const before = stringOr(beforeTransition).trim();
  const after = stringOr(afterTransition).trim();
  if (!sceneId || !SCENE_TRANSITIONS.has(before) || !SCENE_TRANSITIONS.has(after) || before === after) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    && String(scenes[requestedIndex]?.id || '') === String(sceneId)
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : null;
  if (!scene) return null;

  const assets = validImageAssetMap(project);
  const imageAssetId = stringOr(scene.imageAssetId).trim();
  const imageAsset = assets.get(imageAssetId);
  const context = {
    sceneText: stringOr(scene.text),
    sceneIndex: resolvedIndex,
    durationSec: Number.isFinite(Number(scene.durationSec)) ? Number(scene.durationSec) : null,
    platform: stringOr(project?.platform),
    aspectRatio: stringOr(project?.aspectRatio)
  };
  if (imageAsset) context.imageAssetId = imageAssetId;

  return appendDecision(project, {
    decisionType: 'scene-transition',
    sceneId: String(sceneId),
    context,
    proposal: { transition: before },
    alternatives: [],
    humanAction: { type: 'select-scene-transition' },
    finalDecision: { transition: after },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'scene-editor', version: '0.6' },
    assetIds: imageAsset ? [imageAssetId] : [],
    rights: imageAsset ? imageAssetRights(imageAsset) : {}
  }, options);
}

const SCENE_SUBTITLE_POSITIONS = new Set(['top', 'center', 'bottom']);

export function snapshotSceneSubtitlePosition(scene) {
  const position = stringOr(scene?.subtitlePosition).trim();
  if (!position) return { mode: 'inherit', position: null, offsetPercent: null };
  if (!SCENE_SUBTITLE_POSITIONS.has(position)) return null;
  return {
    mode: 'override',
    position,
    offsetPercent: normalizeSubtitleOffset(scene?.subtitlePositionOffsetPercent)
  };
}

function normalizeSceneSubtitlePositionState(value) {
  if (!isRecord(value)) return null;
  const mode = stringOr(value.mode).trim();
  if (mode === 'inherit') return { mode: 'inherit', position: null, offsetPercent: null };
  const position = stringOr(value.position).trim();
  if (mode !== 'override' || !SCENE_SUBTITLE_POSITIONS.has(position)) return null;
  return { mode: 'override', position, offsetPercent: normalizeSubtitleOffset(value.offsetPercent) };
}

export function recordSceneSubtitlePositionChange(project, {
  sceneId,
  beforeState,
  afterState,
  sceneIndex
}, options = {}) {
  if (!sceneId) return null;
  const before = normalizeSceneSubtitlePositionState(beforeState);
  const after = normalizeSceneSubtitlePositionState(afterState);
  if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    && String(scenes[requestedIndex]?.id || '') === String(sceneId)
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : null;
  if (!scene) return null;

  const globalStyle = isRecord(project?.subtitleStyle) ? project.subtitleStyle : {};
  const globalStylePosition = stringOr(globalStyle.position).trim();
  const outputPosition = stringOr(project?.output?.subtitlePosition).trim();
  const globalSubtitlePosition = SCENE_SUBTITLE_POSITIONS.has(globalStylePosition)
    ? globalStylePosition
    : SCENE_SUBTITLE_POSITIONS.has(outputPosition) ? outputPosition : 'bottom';

  const assets = validImageAssetMap(project);
  const imageAssetId = stringOr(scene.imageAssetId).trim();
  const imageAsset = assets.get(imageAssetId);
  const context = {
    sceneText: stringOr(scene.text),
    sceneIndex: resolvedIndex,
    durationSec: Number.isFinite(Number(scene.durationSec)) ? Number(scene.durationSec) : null,
    platform: stringOr(project?.platform),
    aspectRatio: stringOr(project?.aspectRatio),
    globalSubtitlePosition,
    globalSubtitleOffsetPercent: normalizeSubtitleOffset(globalStyle.positionOffsetPercent)
  };
  if (imageAsset) context.imageAssetId = imageAssetId;

  return appendDecision(project, {
    decisionType: 'scene-subtitle-position',
    sceneId: String(sceneId),
    context,
    proposal: before,
    alternatives: [],
    humanAction: { type: 'set-scene-subtitle-position' },
    finalDecision: after,
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'subtitle-editor', version: '0.7' },
    assetIds: imageAsset ? [imageAssetId] : [],
    rights: imageAsset ? imageAssetRights(imageAsset) : {}
  }, options);
}

export function snapshotGlobalSubtitlePosition(project) {
  const style = isRecord(project?.subtitleStyle) ? project.subtitleStyle : {};
  const position = stringOr(style.position).trim();
  if (!SCENE_SUBTITLE_POSITIONS.has(position)) return null;
  return { position, offsetPercent: normalizeSubtitleOffset(style.positionOffsetPercent) };
}

function normalizeGlobalSubtitlePositionState(value) {
  if (!isRecord(value)) return null;
  const position = stringOr(value.position).trim();
  if (!SCENE_SUBTITLE_POSITIONS.has(position)) return null;
  return { position, offsetPercent: normalizeSubtitleOffset(value.offsetPercent) };
}

export function recordGlobalSubtitlePositionChange(project, {
  beforeState,
  afterState
}, options = {}) {
  const before = normalizeGlobalSubtitlePositionState(beforeState);
  const after = normalizeGlobalSubtitlePositionState(afterState);
  if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) return null;

  const style = isRecord(project?.subtitleStyle) ? project.subtitleStyle : {};
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const sceneOverrideCount = scenes.filter(scene =>
    SCENE_SUBTITLE_POSITIONS.has(stringOr(scene?.subtitlePosition).trim())
  ).length;

  return appendDecision(project, {
    decisionType: 'global-subtitle-position',
    sceneId: '',
    context: {
      platform: stringOr(project?.platform),
      aspectRatio: stringOr(project?.aspectRatio),
      subtitlePreset: stringOr(style.preset),
      subtitleEnabled: style.enabled !== false,
      sceneCount: scenes.length,
      sceneOverrideCount,
      inheritedSceneCount: scenes.length - sceneOverrideCount
    },
    proposal: before,
    alternatives: [],
    humanAction: { type: 'set-global-subtitle-position' },
    finalDecision: after,
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'subtitle-editor', version: '0.8' },
    assetIds: [],
    rights: {}
  }, options);
}

export function recordSubtitleSceneSyncDecision(project, {
  sceneId,
  sceneIndex,
  sceneTextBefore,
  subtitleTextAfter,
  sceneTextCandidate,
  syncToScene,
  speechTextFollowsScene,
  hadNarration
}, options = {}) {
  if (!sceneId || typeof syncToScene !== 'boolean') return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    && String(scenes[requestedIndex]?.id || '') === String(sceneId)
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : null;
  if (!scene) return null;

  return appendDecision(project, {
    decisionType: 'subtitle-scene-sync',
    sceneId: String(sceneId),
    context: {
      sceneIndex: resolvedIndex,
      sceneTextBefore: stringOr(sceneTextBefore),
      subtitleTextAfter: stringOr(subtitleTextAfter),
      sceneTextCandidate: stringOr(sceneTextCandidate),
      durationSec: Number.isFinite(Number(scene.durationSec)) ? Number(scene.durationSec) : null,
      platform: stringOr(project?.platform),
      aspectRatio: stringOr(project?.aspectRatio),
      speechTextFollowsScene: Boolean(speechTextFollowsScene),
      hadNarration: Boolean(hadNarration)
    },
    proposal: { syncToScene: false },
    alternatives: [{ syncToScene: true }],
    humanAction: { type: 'choose-subtitle-scene-sync' },
    finalDecision: { syncToScene },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'subtitle-editor', version: '0.9' },
    assetIds: [],
    rights: {}
  }, options);
}

export function normalizeBgmVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const clamped = Math.min(0.5, Math.max(0, number));
  return Math.round((clamped + Number.EPSILON) * 100) / 100;
}

export function recordBgmVolumeChange(project, {
  beforeVolume,
  afterVolume,
  bgmSource,
  bgmCategory,
  ducking,
  loop
}, options = {}) {
  const before = normalizeBgmVolume(beforeVolume);
  const after = normalizeBgmVolume(afterVolume);
  if (before === null || after === null || before === after) return null;

  const bgm = isRecord(project?.bgm) ? project.bgm : {};
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const currentSource = typeof bgmSource === 'string' ? bgmSource.trim() : stringOr(bgm.source).trim();
  const currentCategory = typeof bgmCategory === 'string' ? bgmCategory.trim() : stringOr(bgm.category).trim();
  const currentDucking = typeof ducking === 'boolean' ? ducking : Boolean(bgm.ducking);
  const currentLoop = typeof loop === 'boolean' ? loop : Boolean(bgm.loop);
  const hasNarration = Boolean(project?.narration?.audioData) || scenes.some(scene => Boolean(scene?.narration?.audioData));

  return appendDecision(project, {
    decisionType: 'bgm-volume',
    sceneId: '',
    context: {
      platform: stringOr(project?.platform),
      aspectRatio: stringOr(project?.aspectRatio),
      bgmSource: currentSource,
      bgmCategory: currentCategory,
      hasBgmAudio: Boolean(bgm.audioData),
      ducking: currentDucking,
      loop: currentLoop,
      sceneCount: scenes.length,
      hasNarration
    },
    proposal: { volume: before },
    alternatives: [],
    humanAction: { type: 'set-bgm-volume' },
    finalDecision: { volume: after },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'bgm-editor', version: '0.10' },
    assetIds: [],
    rights: {}
  }, options);
}

const SUBTITLE_PRESET_IDS = ['standard', 'large', 'minimal', 'boxed'];
const SUBTITLE_PRESET_SET = new Set(SUBTITLE_PRESET_IDS);
const SUBTITLE_POSITIONS = new Set(['top', 'center', 'bottom']);

function subtitlePresetNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSubtitlePresetState(value, { fallbackPreset = false } = {}) {
  if (!isRecord(value)) return null;
  const rawPreset = stringOr(value.preset).trim();
  const preset = SUBTITLE_PRESET_SET.has(rawPreset) ? rawPreset : (fallbackPreset ? 'standard' : '');
  if (!preset) return null;
  const style = isRecord(value.style) ? value.style : {};
  const rawPosition = stringOr(style.position).trim();
  return {
    preset,
    style: {
      fontSize: subtitlePresetNumber(style.fontSize),
      position: SUBTITLE_POSITIONS.has(rawPosition) ? rawPosition : null,
      maxCharsPerLine: subtitlePresetNumber(style.maxCharsPerLine),
      maxLines: subtitlePresetNumber(style.maxLines),
      outlineWidth: subtitlePresetNumber(style.outlineWidth),
      backgroundEnabled: Boolean(style.backgroundEnabled),
      backgroundOpacity: subtitlePresetNumber(style.backgroundOpacity)
    }
  };
}

export function snapshotSubtitlePresetState(style) {
  const source = isRecord(style) ? style : {};
  return normalizeSubtitlePresetState({
    preset: source.preset,
    style: {
      fontSize: source.fontSize,
      position: source.position,
      maxCharsPerLine: source.maxCharsPerLine,
      maxLines: source.maxLines,
      outlineWidth: source.outlineWidth,
      backgroundEnabled: source.backgroundEnabled,
      backgroundOpacity: source.backgroundOpacity
    }
  }, { fallbackPreset: true });
}

export function recordSubtitlePresetChange(project, { beforeState, afterState }, options = {}) {
  const before = normalizeSubtitlePresetState(beforeState, { fallbackPreset: true });
  const after = normalizeSubtitlePresetState(afterState);
  if (!before || !after || before.preset === after.preset) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const overridePositions = new Set(['top', 'center', 'bottom']);
  const subtitleSceneCount = scenes.filter(scene => stringOr(scene?.subtitleText).trim()).length;
  const sceneOverrideCount = scenes.filter(scene => overridePositions.has(stringOr(scene?.subtitlePosition).trim())).length;

  return appendDecision(project, {
    decisionType: 'subtitle-preset',
    sceneId: '',
    context: {
      platform: stringOr(project?.platform),
      aspectRatio: stringOr(project?.aspectRatio),
      subtitleEnabled: Boolean(project?.subtitleStyle?.enabled),
      sceneCount: scenes.length,
      subtitleSceneCount,
      sceneOverrideCount
    },
    proposal: before,
    alternatives: SUBTITLE_PRESET_IDS.filter(preset => preset !== after.preset).map(preset => ({ preset })),
    humanAction: { type: 'select-subtitle-preset' },
    finalDecision: after,
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'subtitle-editor', version: '0.13' },
    assetIds: [],
    rights: {}
  }, options);
}

export function recordBgmSelectionChange(project, {
  beforeAudioAssetId,
  afterAudioAssetId,
  selectionMethod = 'upload',
  hadBgmBefore,
  bgmCategory,
  ducking,
  loop
}, options = {}) {
  const before = normalizeAudioAssetId(beforeAudioAssetId) || null;
  const after = normalizeAudioAssetId(afterAudioAssetId) || null;
  if (!after || before === after) return null;
  if (selectionMethod !== 'upload') return null;
  const bgm = isRecord(project?.bgm) ? project.bgm : {};
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const currentCategory = typeof bgmCategory === 'string' ? bgmCategory.trim() : stringOr(bgm.category).trim();
  const currentDucking = typeof ducking === 'boolean' ? ducking : Boolean(bgm.ducking);
  const currentLoop = typeof loop === 'boolean' ? loop : Boolean(bgm.loop);
  const hasNarration = Boolean(project?.narration?.audioData) || scenes.some(scene => Boolean(scene?.narration?.audioData));
  const priorBgm = typeof hadBgmBefore === 'boolean' ? hadBgmBefore : Boolean(before);
  return appendDecision(project, {
    decisionType: 'bgm-selection', sceneId: '',
    context: { platform:stringOr(project?.platform), aspectRatio:stringOr(project?.aspectRatio), selectionMethod:'upload', bgmCategory:currentCategory, hadBgmBefore:priorBgm, ducking:currentDucking, loop:currentLoop, sceneCount:scenes.length, hasNarration },
    proposal: { audioAssetId: before }, alternatives: [],
    humanAction: { type:'select-bgm-audio', selectionMethod:'upload' },
    finalDecision: { audioAssetId: after }, reasonCode:'', reasonNote:'',
    source: { type:'human', feature:'bgm-editor', version:'0.12' },
    assetIds: [...new Set([before,after].filter(Boolean))], rights: {}
  }, options);
}

const KOKORO_NARRATION_VOICES = [
  'jf_alpha',
  'jf_gongitsune',
  'jf_nezumi',
  'jf_tebukuro',
  'jm_kumo'
];
const KOKORO_NARRATION_VOICE_SET = new Set(KOKORO_NARRATION_VOICES);

export function normalizeNarrationVoiceId(value) {
  const voiceId = stringOr(value).trim();
  return KOKORO_NARRATION_VOICE_SET.has(voiceId) ? voiceId : null;
}

export function recordNarrationVoiceDecision(project, {
  beforeVoiceId,
  afterVoiceId,
  generationMode,
  hadProjectNarration,
  sceneNarrationCountBefore
}, options = {}) {
  const after = normalizeNarrationVoiceId(afterVoiceId);
  if (!after) return null;
  const before = normalizeNarrationVoiceId(beforeVoiceId);
  if (before === after) return null;
  const mode = generationMode === 'full' || generationMode === 'scenes' ? generationMode : '';
  if (!mode) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const suppliedSceneNarrationCount = Number(sceneNarrationCountBefore);
  const priorSceneNarrationCount = Number.isInteger(suppliedSceneNarrationCount) && suppliedSceneNarrationCount >= 0
    ? suppliedSceneNarrationCount
    : scenes.filter(scene => Boolean(scene?.narration?.audioData)).length;
  const priorProjectNarration = typeof hadProjectNarration === 'boolean'
    ? hadProjectNarration
    : Boolean(project?.narration?.audioData);

  return appendDecision(project, {
    decisionType: 'narration-voice',
    sceneId: '',
    context: {
      platform: stringOr(project?.platform),
      aspectRatio: stringOr(project?.aspectRatio),
      engine: 'kokoro-js-jp',
      generationMode: mode,
      sceneCount: scenes.length,
      hadProjectNarration: priorProjectNarration,
      sceneNarrationCountBefore: priorSceneNarrationCount
    },
    proposal: { voiceId: before },
    alternatives: KOKORO_NARRATION_VOICES.filter(voiceId => voiceId !== after).map(voiceId => ({ voiceId })),
    humanAction: { type: 'choose-narration-voice', generationMode: mode },
    finalDecision: { voiceId: after },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'voice-lab', version: '0.11' },
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
