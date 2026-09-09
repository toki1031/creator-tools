import test from 'node:test';
import assert from 'node:assert/strict';
import { syncSceneDurationToNarration, syncProjectSceneDurationsToNarration } from '../productionEfficiency.js';

test('syncs scene duration to generated narration duration', () => {
  const scene = { id: 's1', durationSec: 5, narration: { durationSec: 7.2 } };
  const result = syncSceneDurationToNarration(scene, { leadInSec: 0, tailSec: 0.2 });
  assert.equal(result.changed, true);
  assert.equal(result.scene.durationSec, 7.4);
  assert.equal(scene.durationSec, 5);
});

test('leaves scene without generated narration unchanged', () => {
  const scene = { id: 's1', durationSec: 5, narration: {} };
  assert.equal(syncSceneDurationToNarration(scene).changed, false);
});

test('syncs only scenes with narration duration', () => {
  const project = { scenes: [
    { id: 'a', durationSec: 2, narration: { durationSec: 3 } },
    { id: 'b', durationSec: 4 }
  ]};
  const result = syncProjectSceneDurationsToNarration(project, { leadInSec: 0, tailSec: 0 });
  assert.equal(result.changed, 1);
  assert.equal(result.project.scenes[0].durationSec, 3);
  assert.equal(result.project.scenes[1].durationSec, 4);
});
