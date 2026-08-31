import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../projectFactory.js';
import {
  appendDecision,
  ensureLearningState,
  moveSceneWithDecision,
  normalizeDecisionRecord,
  normalizeLearningState,
  recordSceneDurationChange,
  recordSceneOrderChange,
  snapshotSceneOrder
} from '../decisionLog.js';

test('new project starts with an empty learning decision list', () => {
  const project = createProject('QA', 'great-person', 'youtube-shorts');
  assert.deepEqual(project.learning, { decisions: [] });
});

test('old or malformed learning state is safely normalized', () => {
  const project = { id: 'p1', learning: 'invalid' };
  const learning = ensureLearningState(project);
  assert.deepEqual(learning, { decisions: [] });

  const normalized = normalizeLearningState({ decisions: [null, {}, { decisionType: 'scene-order', projectId: 'p1' }] });
  assert.equal(normalized.decisions.length, 1);
  assert.equal(normalized.decisions[0].decisionType, 'scene-order');
});

test('appendDecision fills stable id, project id and timestamp', () => {
  const project = { id: 'project-1', learning: { decisions: [] } };
  const record = appendDecision(project, { decisionType: 'scene-order' }, {
    createId: () => 'decision-1',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(record.id, 'decision-1');
  assert.equal(record.projectId, 'project-1');
  assert.equal(record.timestamp, '2026-08-31T00:00:00.000Z');
  assert.equal(project.learning.decisions.length, 1);
});

test('snapshotSceneOrder preserves scene ids, order and text', () => {
  const snapshot = snapshotSceneOrder({ scenes: [
    { id: 's1', text: 'first' },
    { id: 's2', text: 'second' }
  ] });
  assert.deepEqual(snapshot, [
    { sceneId: 's1', order: 1, text: 'first' },
    { sceneId: 's2', order: 2, text: 'second' }
  ]);
});

test('recordSceneOrderChange stores before and after order only when order changes', () => {
  const project = { id: 'p1', scenes: [], learning: { decisions: [] } };
  const before = [
    { sceneId: 's1', order: 1, text: 'one' },
    { sceneId: 's2', order: 2, text: 'two' }
  ];
  const unchanged = recordSceneOrderChange(project, { sceneId: 's2', direction: 'up', before, after: before }, {
    createId: () => 'ignored',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(unchanged, null);
  assert.equal(project.learning.decisions.length, 0);

  const after = [
    { sceneId: 's2', order: 1, text: 'two' },
    { sceneId: 's1', order: 2, text: 'one' }
  ];
  const record = recordSceneOrderChange(project, { sceneId: 's2', direction: 'up', before, after }, {
    createId: () => 'decision-reorder',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(record.id, 'decision-reorder');
  assert.equal(record.decisionType, 'scene-order');
  assert.equal(record.sceneId, 's2');
  assert.equal(record.humanAction.direction, 'up');
  assert.deepEqual(record.proposal.map(item => item.sceneId), ['s1', 's2']);
  assert.deepEqual(record.finalDecision.map(item => item.sceneId), ['s2', 's1']);
  assert.equal(project.learning.decisions.length, 1);
});

test('moveSceneWithDecision reorders one scene and stores exactly one decision', () => {
  const project = {
    id: 'p1',
    learning: { decisions: [] },
    scenes: [
      { id: 's1', text: 'one', imageAssetId: 'a1', subtitleText: 'sub1', narration: { audioData: 'data:audio/wav;base64,AA==' } },
      { id: 's2', text: 'two', imageAssetId: 'a2', subtitleText: 'sub2', narration: { audioData: 'data:audio/wav;base64,BB==' } }
    ]
  };
  const record = moveSceneWithDecision(project, 1, 'up', {
    createId: () => 'decision-up',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(record.id, 'decision-up');
  assert.equal(record.sceneId, 's2');
  assert.equal(record.humanAction.direction, 'up');
  assert.deepEqual(project.scenes.map(scene => scene.id), ['s2', 's1']);
  assert.equal(project.scenes[0].imageAssetId, 'a2');
  assert.equal(project.scenes[0].subtitleText, 'sub2');
  assert.equal(project.scenes[0].narration.audioData, 'data:audio/wav;base64,BB==');
  assert.equal(project.learning.decisions.length, 1);
});

test('moveSceneWithDecision ignores invalid or non-moving operations', () => {
  const project = { id: 'p1', scenes: [{ id: 's1', text: 'one' }, { id: 's2', text: 'two' }] };
  assert.equal(moveSceneWithDecision(project, 0, 'up'), null);
  assert.equal(moveSceneWithDecision(project, 1, 'down'), null);
  assert.equal(moveSceneWithDecision(project, 0, 'sideways'), null);
  assert.deepEqual(project.scenes.map(scene => scene.id), ['s1', 's2']);
  assert.equal(project.learning.decisions.length, 0);
});

test('normalizeDecisionRecord rejects records without type or project id', () => {
  assert.equal(normalizeDecisionRecord({ projectId: 'p1' }), null);
  assert.equal(normalizeDecisionRecord({ decisionType: 'scene-order' }), null);
  assert.equal(normalizeDecisionRecord(null), null);
});


test('scene-duration stores one committed duration decision with editing context', () => {
  const project = {
    id: 'p-duration',
    targetDurationSec: 60,
    learning: { decisions: [] },
    scenes: [
      { id: 's1', text: 'intro', durationSec: 8, imageAssetId: 'asset-1', subtitleText: 'subtitle', narration: { audioData: 'audio' } },
      { id: 's2', text: 'next', durationSec: 5 }
    ]
  };
  const record = recordSceneDurationChange(project, {
    sceneId: 's1',
    beforeDurationSec: 5,
    afterDurationSec: 8,
    sceneIndex: 0,
    totalDurationBefore: 10
  }, {
    createId: () => 'decision-duration',
    now: () => '2026-08-31T13:30:00.000Z'
  });

  assert.equal(record.id, 'decision-duration');
  assert.equal(record.decisionType, 'scene-duration');
  assert.equal(record.sceneId, 's1');
  assert.deepEqual(record.proposal, { durationSec: 5 });
  assert.deepEqual(record.finalDecision, { durationSec: 8 });
  assert.equal(record.humanAction.type, 'set-duration');
  assert.equal(record.context.sceneIndex, 0);
  assert.equal(record.context.sceneNumber, 1);
  assert.equal(record.context.sceneText, 'intro');
  assert.equal(record.context.targetDurationSec, 60);
  assert.equal(record.context.projectTotalDurationSecBefore, 10);
  assert.equal(record.source.version, '0.2');
  assert.equal(project.learning.decisions.length, 1);
  assert.equal(project.scenes[0].imageAssetId, 'asset-1');
  assert.equal(project.scenes[0].subtitleText, 'subtitle');
  assert.equal(project.scenes[0].narration.audioData, 'audio');
});

test('scene-duration ignores same or invalid values and does not create noise', () => {
  const project = { id: 'p-duration', targetDurationSec: 60, learning: { decisions: [] }, scenes: [{ id: 's1', text: 'intro', durationSec: 5 }] };
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 5, afterDurationSec: 5, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 0, afterDurationSec: 5, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 5, afterDurationSec: Number.NaN, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: '', beforeDurationSec: 5, afterDurationSec: 8, sceneIndex: 0 }), null);
  assert.equal(project.learning.decisions.length, 0);
});
