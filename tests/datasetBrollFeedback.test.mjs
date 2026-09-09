import assert from 'node:assert/strict';
import test from 'node:test';
import { feedbackAdjustmentForSuggestion, getDatasetBrollFeedbackState, recordDatasetBrollFeedback } from '../datasetBrollFeedback.js';
import { suggestBrollFromDataset } from '../datasetBrollSuggestions.js';

function project() {
  return {
    id: 'p-current',
    title: 'Current',
    platform: 'youtube',
    aspectRatio: '9:16',
    scenes: [{ id: 's-current', text: '北斎が波を描き続けた場面' }],
    mediaLibrary: [],
    learning: { decisions: [] }
  };
}

const suggestion = {
  score: 60,
  evidenceProjectId: 'p-old',
  evidenceProjectTitle: 'Old',
  evidenceSceneId: 's-old',
  evidenceSceneText: '北斎が波を描いた場面',
  assetId: 'a-old',
  assetLabel: '波の浮世絵',
  assetSource: 'archive',
  reusableInCurrentProject: false,
  reason: '似たSceneで過去に採用'
};

test('records Dataset B-roll accept/reject without mutating scene content', () => {
  const p = project();
  const before = JSON.stringify(p.scenes);
  const accepted = recordDatasetBrollFeedback(p, { sceneId: 's-current', sceneIndex: 0, sceneText: p.scenes[0].text, suggestion, action: 'accept' }, { createId: () => 'd1', now: () => '2026-09-10T00:00:00Z' });
  assert.equal(accepted.decisionType, 'dataset-broll-suggestion');
  assert.equal(accepted.finalDecision.accepted, true);
  assert.equal(getDatasetBrollFeedbackState(p, 's-current', suggestion), 'accepted');
  assert.equal(JSON.stringify(p.scenes), before);

  const duplicate = recordDatasetBrollFeedback(p, { sceneId: 's-current', sceneIndex: 0, sceneText: p.scenes[0].text, suggestion, action: 'accept' });
  assert.equal(duplicate, null);

  const rejected = recordDatasetBrollFeedback(p, { sceneId: 's-current', sceneIndex: 0, sceneText: p.scenes[0].text, suggestion, action: 'reject' }, { createId: () => 'd2', now: () => '2026-09-10T00:01:00Z' });
  assert.equal(rejected.finalDecision.accepted, false);
  assert.equal(getDatasetBrollFeedbackState(p, 's-current', suggestion), 'rejected');
});

test('feedback changes future Dataset suggestion score', () => {
  const current = project();
  const old = {
    id: 'p-old', title: 'Old', platform: 'youtube', aspectRatio: '9:16',
    mediaLibrary: [{ id: 'a-old', type: 'image', data: 'data:image/png;base64,AA==', title: '波の浮世絵' }],
    learning: { decisions: [{
      id: 'select1', decisionType: 'scene-image-selection', projectId: 'p-old', sceneId: 's-old',
      context: { sceneText: '北斎が波を描いた場面', platform: 'youtube', aspectRatio: '9:16' },
      proposal: { imageAssetId: null }, alternatives: [], humanAction: { type: 'select-image-asset' },
      finalDecision: { imageAssetId: 'a-old' }, reasonCode: '', reasonNote: '', source: {}, assetIds: ['a-old'], rights: {}, timestamp: '2026-09-01T00:00:00Z'
    }] }
  };
  const before = suggestBrollFromDataset(current, current.scenes[0], [current, old], { limit: 5 })[0];
  assert.ok(before);
  recordDatasetBrollFeedback(current, { sceneId: 's-current', sceneIndex: 0, sceneText: current.scenes[0].text, suggestion: before, action: 'accept' }, { createId: () => 'f1' });
  const adjustment = feedbackAdjustmentForSuggestion([current, old], before);
  assert.equal(adjustment.accepted, 1);
  assert.equal(adjustment.adjustment, 4);
  const after = suggestBrollFromDataset(current, current.scenes[0], [current, old], { limit: 5 })[0];
  assert.equal(after.score, before.score + 4);
});
