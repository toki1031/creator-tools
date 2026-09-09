import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../bgmBeatSyncUi.js', import.meta.url), 'utf8');
const boot = fs.readFileSync(new URL('../bootLoader.js', import.meta.url), 'utf8');

test('BGM Beat Sync is optional and user-triggered', () => {
  assert.match(boot, /bgmBeatSyncUi\.js/);
  assert.match(source, /data-analyze-beats/);
  assert.match(source, /data-apply-beats/);
  assert.match(source, /解析だけではScene尺を変更しません/);
});

test('Beat Sync only saves after explicit apply', () => {
  const analyzeIndex = source.indexOf("[data-analyze-beats]");
  const applyIndex = source.indexOf('applyButton.onclick');
  const saveIndex = source.indexOf('await saveProject(next)');
  assert.ok(analyzeIndex >= 0 && applyIndex > analyzeIndex && saveIndex > applyIndex);
});
