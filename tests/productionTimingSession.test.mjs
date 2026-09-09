import test from 'node:test';
import assert from 'node:assert/strict';
import { routeStageFromHash, transitionTimingSession } from '../productionTimingSession.js';

function storage() {
  const data = new Map();
  return { getItem:k => data.has(k) ? data.get(k) : null, setItem:(k,v) => data.set(k,String(v)), removeItem:k => data.delete(k) };
}

test('maps production routes to stable stages', () => {
  assert.equal(routeStageFromHash('#/project/p/scenes'), 'scenes');
  assert.equal(routeStageFromHash('#/project/p/bgm'), 'subtitles-bgm');
  assert.equal(routeStageFromHash('#/project/p/output'), 'output');
});

test('finishes previous stage when route stage changes', () => {
  const s = storage();
  transitionTimingSession('#/project/p/scenes', 1000, s);
  const result = transitionTimingSession('#/project/p/bgm', 2500, s);
  assert.equal(result.finished.stage, 'scenes');
  assert.equal(result.finished.durationMs, 1500);
  assert.equal(result.activeStage, 'subtitles-bgm');
});
