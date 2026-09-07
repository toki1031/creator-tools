import { auditDecisionRecords } from './datasetQualityAudit.js';

const BLOCKED_URL_PREFIX = /^(?:data|blob):/i;

function safeString(value) {
  const text = String(value ?? '').trim();
  return text && !BLOCKED_URL_PREFIX.test(text) ? text : '';
}

function compactContext(record) {
  const source = record?.context && typeof record.context === 'object' ? record.context : {};
  const sceneIndex = Number(source.sceneIndex);
  return {
    sceneText: safeString(source.sceneText),
    sceneIndex: Number.isInteger(sceneIndex) && sceneIndex >= 0 ? sceneIndex : null,
    platform: safeString(source.platform),
    aspectRatio: safeString(source.aspectRatio)
  };
}

export function createSceneImagePairwiseTrainingSet(decisions = []) {
  const source = Array.isArray(decisions) ? decisions : [];
  const audit = auditDecisionRecords(source);
  const examples = [];
  let acceptedDecisions = 0;

  audit.records.forEach((result, index) => {
    const record = source[index];
    if (result.status === 'invalid' || record?.decisionType !== 'scene-image-selection') return;

    const chosenAssetId = safeString(record?.finalDecision?.imageAssetId);
    if (!chosenAssetId) return;

    const rejected = [];
    const proposalId = safeString(record?.proposal?.imageAssetId);
    if (proposalId && proposalId !== chosenAssetId) rejected.push(proposalId);
    if (Array.isArray(record?.alternatives)) {
      for (const item of record.alternatives) {
        const id = safeString(item?.imageAssetId);
        if (id && id !== chosenAssetId) rejected.push(id);
      }
    }

    const uniqueRejected = [...new Set(rejected)];
    if (!uniqueRejected.length) return;
    acceptedDecisions += 1;
    for (const rejectedAssetId of uniqueRejected) {
      examples.push({
        decisionId: safeString(record.id),
        projectId: safeString(record.projectId),
        sceneId: safeString(record.sceneId),
        context: compactContext(record),
        chosenAssetId,
        rejectedAssetId
      });
    }
  });

  return {
    trainingSetVersion: '0.35',
    decisionType: 'scene-image-selection',
    summary: {
      inputDecisions: source.length,
      acceptedDecisions,
      examples: examples.length
    },
    examples
  };
}

export function createSceneImagePairwiseTrainingSetFromExports(exports = []) {
  const source = Array.isArray(exports) ? exports : [];
  const decisions = source.flatMap(entry => Array.isArray(entry?.decisions) ? entry.decisions : []);
  return createSceneImagePairwiseTrainingSet(decisions);
}
