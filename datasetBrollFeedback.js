import { appendDecision } from './decisionLog.js';

const stringOr = value => String(value ?? '').trim();

function feedbackKey(sceneId, suggestion, action) {
  return [
    stringOr(sceneId),
    stringOr(suggestion?.evidenceProjectId),
    stringOr(suggestion?.evidenceSceneId),
    stringOr(suggestion?.assetId),
    action
  ].join('|');
}

export function listDatasetBrollFeedback(project) {
  const decisions = Array.isArray(project?.learning?.decisions) ? project.learning.decisions : [];
  return decisions.filter(item => item?.decisionType === 'dataset-broll-suggestion');
}

export function getDatasetBrollFeedbackState(project, sceneId, suggestion) {
  const records = listDatasetBrollFeedback(project);
  const acceptedKey = feedbackKey(sceneId, suggestion, 'accept');
  const rejectedKey = feedbackKey(sceneId, suggestion, 'reject');
  let state = null;
  for (const record of records) {
    const action = stringOr(record?.humanAction?.type) === 'accept-dataset-broll-suggestion' ? 'accept'
      : stringOr(record?.humanAction?.type) === 'reject-dataset-broll-suggestion' ? 'reject' : '';
    if (!action) continue;
    const key = [
      stringOr(record?.sceneId),
      stringOr(record?.context?.evidenceProjectId),
      stringOr(record?.context?.evidenceSceneId),
      stringOr(record?.proposal?.assetId),
      action
    ].join('|');
    if (key === acceptedKey) state = 'accepted';
    if (key === rejectedKey) state = 'rejected';
  }
  return state;
}

export function recordDatasetBrollFeedback(project, {
  sceneId,
  sceneIndex,
  sceneText,
  suggestion,
  action
}, options = {}) {
  const normalizedAction = action === 'accept' ? 'accept' : action === 'reject' ? 'reject' : '';
  if (!project || !sceneId || !suggestion || !normalizedAction) return null;
  const existingState = getDatasetBrollFeedbackState(project, sceneId, suggestion);
  if ((normalizedAction === 'accept' && existingState === 'accepted') || (normalizedAction === 'reject' && existingState === 'rejected')) return null;

  return appendDecision(project, {
    decisionType: 'dataset-broll-suggestion',
    sceneId: stringOr(sceneId),
    context: {
      screen: 'scene-editor',
      sceneIndex: Number.isInteger(Number(sceneIndex)) ? Number(sceneIndex) : null,
      sceneText: stringOr(sceneText),
      evidenceProjectId: stringOr(suggestion.evidenceProjectId),
      evidenceProjectTitle: stringOr(suggestion.evidenceProjectTitle),
      evidenceSceneId: stringOr(suggestion.evidenceSceneId),
      evidenceSceneText: stringOr(suggestion.evidenceSceneText),
      suggestionScore: Number.isFinite(Number(suggestion.score)) ? Number(suggestion.score) : null,
      suggestionReason: stringOr(suggestion.reason),
      reusableInCurrentProject: Boolean(suggestion.reusableInCurrentProject),
      platform: stringOr(project?.platform),
      aspectRatio: stringOr(project?.aspectRatio)
    },
    proposal: {
      assetId: stringOr(suggestion.assetId),
      assetLabel: stringOr(suggestion.assetLabel),
      assetSource: stringOr(suggestion.assetSource)
    },
    alternatives: [],
    humanAction: {
      type: normalizedAction === 'accept' ? 'accept-dataset-broll-suggestion' : 'reject-dataset-broll-suggestion'
    },
    finalDecision: { accepted: normalizedAction === 'accept' },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'dataset-broll-suggestions', version: '0.2' },
    assetIds: [],
    rights: {}
  }, options);
}

export function feedbackAdjustmentForSuggestion(projects, suggestion) {
  let accepted = 0;
  let rejected = 0;
  for (const project of Array.isArray(projects) ? projects : []) {
    for (const record of listDatasetBrollFeedback(project)) {
      if (stringOr(record?.context?.evidenceProjectId) !== stringOr(suggestion?.evidenceProjectId)) continue;
      if (stringOr(record?.context?.evidenceSceneId) !== stringOr(suggestion?.evidenceSceneId)) continue;
      if (stringOr(record?.proposal?.assetId) !== stringOr(suggestion?.assetId)) continue;
      if (record?.finalDecision?.accepted === true) accepted++;
      if (record?.finalDecision?.accepted === false) rejected++;
    }
  }
  return { accepted, rejected, adjustment: Math.min(15, accepted * 4) - Math.min(12, rejected * 4) };
}
