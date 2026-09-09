import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../productionAssistantUi.js', import.meta.url), 'utf8');
const boot = fs.readFileSync(new URL('../bootLoader.js', import.meta.url), 'utf8');

test('production assistant is isolated as optional module', () => {
  assert.match(boot, /productionAssistantUi\.js/);
  assert.match(source, /inspectSmartFinish/);
  assert.match(source, /firstSmartFinishAction/);
  assert.match(source, /data-repair/);
  assert.match(source, /syncProjectSceneDurationsToNarration/);
});

test('preset storage never uses project audio as a separate library payload', () => {
  assert.match(source, /createProductionPreset/);
  assert.doesNotMatch(source, /audioData\s*:/);
});

test('production assistant exposes explicit lightweight restore points', () => {
  assert.match(source, /createProjectSnapshot/);
  assert.match(source, /restoreProjectSnapshot/);
  assert.match(source, /readProjectSnapshots/);
  assert.match(source, /data-save-snapshot/);
  assert.match(source, /data-restore-snapshot/);
  assert.match(source, /data-delete-snapshot/);
  assert.match(source, /画像・音声ファイル本体は複製しません/);
  assert.match(source, /confirm\(/);
});
