import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionPlan, nextProductionAction } from '../productionPipeline.js';

test('builds scenes from script without mutating source project', () => {
  const project = { id: 'p1', script: '最初の一歩。\n\nしかし、ここから景色が変わる。', targetDurationSec: 20 };
  const before = JSON.stringify(project);
  const plan = buildProductionPlan(project);
  assert.ok(plan.project.scenes.length >= 1);
  assert.equal(JSON.stringify(project), before);
  assert.equal(plan.steps[0].id, 'scenes');
});

test('keeps existing scenes and identifies the next production bottleneck', () => {
  const project = { id: 'p2', scenes: [{ id: 's1', text: '本文', durationSec: 3 }] };
  const plan = buildProductionPlan(project);
  assert.equal(plan.steps[0].status, 'kept');
  assert.equal(nextProductionAction(plan).id, 'images');
});

test('uses generated narration duration as a proposed scene duration', () => {
  const project = { id: 'p3', scenes: [{ id: 's1', text: '本文', durationSec: 8, imageAssetId: 'a1', narration: { audioData: 'data:audio/wav;base64,AA==', durationSec: 3 } }] };
  const plan = buildProductionPlan(project);
  assert.ok(plan.project.scenes[0].durationSec < 8);
  assert.equal(plan.steps.find(step => step.id === 'duration').status, 'prepared');
});
