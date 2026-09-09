import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCoverPlacement, normalizeSceneReframe, reframePreset, suggestReframeFromSaliency } from '../smartReframe.js';

test('normalizes reframe values safely', () => {
  assert.deepEqual(normalizeSceneReframe({ focusX: -1, focusY: 2, zoom: 9 }), { focusX: 0, focusY: 1, zoom: 1.5 });
});

test('cover placement stays inside frame while honoring focus', () => {
  const left = calculateCoverPlacement(1600, 900, 1080, 1920, { focusX: 0.2, focusY: 0.5, zoom: 1 });
  const right = calculateCoverPlacement(1600, 900, 1080, 1920, { focusX: 0.8, focusY: 0.5, zoom: 1 });
  assert.ok(left.x > right.x);
  assert.equal(left.y, 0);
  assert.equal(right.y, 0);
  assert.ok(left.drawWidth >= 1080);
  assert.ok(left.drawHeight >= 1920);
});

test('saliency suggestion follows a strong subject region without extreme crop', () => {
  const samples = new Array(16).fill(0.1);
  samples[4] = 10;
  samples[5] = 8;
  const result = suggestReframeFromSaliency(samples, 4, 4);
  assert.ok(result.focusX < 0.5);
  assert.ok(result.focusY < 0.5);
  assert.ok(result.focusX >= 0.2);
  assert.ok(result.focusY >= 0.2);
  assert.ok(result.zoom >= 1 && result.zoom <= 1.12);
  assert.equal(result.source, 'local-saliency-v1');
});

test('invalid saliency falls back to center', () => {
  const result = suggestReframeFromSaliency([], 0, 0);
  assert.deepEqual({ focusX: result.focusX, focusY: result.focusY, zoom: result.zoom }, reframePreset('center'));
  assert.equal(result.confidence, 0);
});
