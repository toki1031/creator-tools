import { appendDecision } from './decisionLog.js';

function normalizeCandidate(candidate) {
  const startIndex = Number(candidate?.startIndex);
  const endIndex = Number(candidate?.endIndex);
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex < startIndex) return null;
  return {
    startIndex,
    endIndex,
    sceneNumbers: Array.isArray(candidate?.sceneNumbers) ? candidate.sceneNumbers.map(Number).filter(Number.isFinite) : [],
    durationSec: Math.max(0, Number(candidate?.durationSec) || 0),
    score: Math.max(0, Math.min(100, Number(candidate?.score) || 0)),
    reasons: Array.isArray(candidate?.reasons) ? candidate.reasons.map(String) : [],
    previewText: String(candidate?.previewText || '')
  };
}

function sceneIdsForCandidate(project, candidate) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  return scenes.slice(candidate.startIndex, candidate.endIndex + 1).map(scene => String(scene?.id || '')).filter(Boolean);
}

function signature(action, candidate) {
  return `${action}:${candidate.startIndex}:${candidate.endIndex}`;
}

export function hasShortsHighlightDecision(project, candidate, action) {
  const normalized = normalizeCandidate(candidate);
  if (!normalized || !['adopt', 'reject'].includes(action)) return false;
  const decisions = Array.isArray(project?.learning?.decisions) ? project.learning.decisions : [];
  const wanted = signature(action, normalized);
  return decisions.some(record => {
    if (record?.decisionType !== 'shorts-highlight-selection') return false;
    const context = record?.context || {};
    return signature(String(record?.humanAction?.type || ''), {
      startIndex: Number(context.startIndex),
      endIndex: Number(context.endIndex)
    }) === wanted;
  });
}

export function recordShortsHighlightDecision(project, candidate, {
  action,
  rank = null,
  reasonCode = '',
  reasonNote = ''
} = {}, options = {}) {
  const normalized = normalizeCandidate(candidate);
  if (!normalized) throw new Error('Shorts候補が正しくありません。');
  if (!['adopt', 'reject'].includes(action)) throw new Error('Shorts候補の判断種別が正しくありません。');
  if (hasShortsHighlightDecision(project, normalized, action)) return null;

  const sceneIds = sceneIdsForCandidate(project, normalized);
  return appendDecision(project, {
    decisionType: 'shorts-highlight-selection',
    sceneId: sceneIds[0] || '',
    context: {
      screen: 'shorts-highlight',
      startIndex: normalized.startIndex,
      endIndex: normalized.endIndex,
      sceneNumbers: normalized.sceneNumbers,
      sceneIds,
      rank: Number.isFinite(Number(rank)) ? Number(rank) : null,
      durationSec: normalized.durationSec,
      previewText: normalized.previewText
    },
    proposal: {
      score: normalized.score,
      reasons: normalized.reasons,
      durationSec: normalized.durationSec,
      sceneIds
    },
    alternatives: [],
    humanAction: { type: action },
    finalDecision: action === 'adopt'
      ? { selected: true, sceneIds }
      : { selected: false, sceneIds },
    reasonCode: String(reasonCode || ''),
    reasonNote: String(reasonNote || ''),
    source: { type: 'system', feature: 'shorts-highlight', version: '1.4' },
    assetIds: [],
    rights: {}
  }, options);
}
