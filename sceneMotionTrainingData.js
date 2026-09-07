import { auditDecisionRecords } from './datasetQualityAudit.js';

const LABELS = new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']);
const BLOCKED_URL = /^(?:data|blob):/i;

function safeString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return BLOCKED_URL.test(text) ? '' : text;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactContext(record) {
  const source = record?.context && typeof record.context === 'object' ? record.context : {};
  return {
    sceneText: safeString(source.sceneText),
    sceneIndex: finiteOrNull(source.sceneIndex),
    durationSec: finiteOrNull(source.durationSec),
    platform: safeString(source.platform),
    aspectRatio: safeString(source.aspectRatio)
  };
}

export function createSceneMotionTrainingSet(decisions = []) {
  const source = Array.isArray(decisions) ? decisions : [];
  const audit = auditDecisionRecords(source);
  const examples = [];

  source.forEach((record, index) => {
    if (audit.records[index]?.status === 'invalid') return;
    if (record?.decisionType !== 'scene-motion') return;

    const label = safeString(record?.finalDecision?.motion);
    if (!LABELS.has(label)) return;

    const decisionId = safeString(record?.id);
    const projectId = safeString(record?.projectId);
    const sceneId = safeString(record?.sceneId);
    if (!decisionId || !projectId || !sceneId) return;

    examples.push({
      decisionId,
      projectId,
      sceneId,
      context: compactContext(record),
      label
    });
  });

  return {
    trainingSetVersion: '0.38',
    decisionType: 'scene-motion',
    examples
  };
}
