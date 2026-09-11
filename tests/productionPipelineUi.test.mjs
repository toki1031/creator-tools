import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../productionPipelineUi.js', import.meta.url), 'utf8');
const boot = fs.readFileSync(new URL('../bootLoader.js', import.meta.url), 'utf8');

test('semi-auto production UI is retained but not auto-loaded on boot', () => {
  assert.doesNotMatch(boot, /['"]\.\/productionPipelineUi\.js['"]/);
  assert.match(ui, /data-run-pipeline/);
});

test('semi-auto production remains user-triggered and preserves existing scenes', () => {
  assert.match(ui, /data-run-pipeline/);
  assert.match(ui, /hadScenes/);
  assert.match(ui, /saveProject/);
  assert.doesNotMatch(ui, /window\.location\.reload/);
});
