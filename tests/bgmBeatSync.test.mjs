import test from 'node:test';
import assert from 'node:assert/strict';
import { detectEnergyPeaks, sceneBoundaries, proposeBeatSnappedDurations, applyBeatSnappedDurations } from '../bgmBeatSync.js';

test('detects isolated energy peaks from mono samples', () => {
  const sampleRate = 1000;
  const samples = new Float32Array(4000);
  for (const center of [500, 1500, 2500]) for (let i = center; i < center + 80; i++) samples[i] = 1;
  const peaks = detectEnergyPeaks(samples, sampleRate, { windowMs: 80, minIntervalSec: 0.2, threshold: 1.2 });
  assert.ok(peaks.length >= 3);
});

test('scene boundaries are cumulative and exclude the final edge', () => {
  assert.deepEqual(sceneBoundaries([{durationSec:2},{durationSec:3},{durationSec:4}]), [2,5]);
});

test('snaps only nearby scene boundaries and preserves total duration', () => {
  const scenes = [{durationSec:2},{durationSec:2},{durationSec:2}];
  const proposal = proposeBeatSnappedDurations(scenes, [2.2,4.1], { toleranceSec:0.45 });
  assert.equal(proposal.changed, 2);
  assert.equal(proposal.durations.reduce((a,b)=>a+b,0), 6);
  assert.deepEqual(proposal.durations, [2.2,1.9,1.9]);
});

test('does not change project until proposal is explicitly applied', () => {
  const project = { scenes:[{durationSec:2,text:'a'},{durationSec:2,text:'b'}] };
  const before = JSON.stringify(project);
  const proposal = proposeBeatSnappedDurations(project.scenes, [2.2]);
  assert.equal(JSON.stringify(project), before);
  const next = applyBeatSnappedDurations(project, proposal);
  assert.notEqual(next.scenes[0].durationSec, project.scenes[0].durationSec);
  assert.equal(JSON.stringify(project), before);
});
