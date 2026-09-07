import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../datasetExportUi.js', import.meta.url), 'utf8');

test('Dataset export UI stays isolated from existing export controls', () => {
  assert.match(source, /#exportJson/);
  assert.match(source, /exportDataset/);
  assert.match(source, /学習Datasetを書き出す/);
  assert.doesNotMatch(source, /saveProject\s*\(/);
});
