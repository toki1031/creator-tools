import test from 'node:test';
import assert from 'node:assert/strict';
import { safeAutofillScene, safeAutofillProject } from '../productionSafeAutofill.js';

test('fills only missing derived production fields', () => {
  const source = { text: '本文' };
  const result = safeAutofillScene(source);
  assert.equal(result.scene.speechText, '本文');
  assert.equal(result.scene.subtitleText, '本文');
  assert.equal(result.scene.motion, 'zoom-in');
  assert.equal(result.scene.transition, 'fade');
  assert.equal(source.speechText, undefined);
});

test('never overwrites manual production decisions', () => {
  const source = { text: '本文', speechText: '読み', subtitleText: '字幕', motion: 'pan-left', transition: 'cut' };
  const result = safeAutofillScene(source);
  assert.deepEqual(result.scene, source);
  assert.equal(result.changed.length, 0);
});

test('reports changed scene and field counts', () => {
  const result = safeAutofillProject({ scenes: [{ text: 'A' }, { text: 'B', subtitleText: 'B' }] });
  assert.equal(result.changedScenes, 2);
  assert.ok(result.changedFields >= 4);
});
