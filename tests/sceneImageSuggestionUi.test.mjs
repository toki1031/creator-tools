import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../sceneImageSuggestionUi.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../optionalAiModuleLoader.js', import.meta.url), 'utf8');

test('image suggestion UI is optional and advisory-only', () => {
  assert.match(loader, /sceneImageSuggestionUi\.js/);
  assert.match(source, /AI画像提案：学習中/);
  assert.match(source, /assessSceneImageSuggestionReadiness/);
  assert.match(source, /rankSceneImageVisualCandidates/);
  assert.match(source, /rankProjectAssetsForScene/);
  assert.match(source, /素材候補：/);
  assert.match(source, /ローカル照合/);
  assert.doesNotMatch(source, /scene\.imageAssetId\s*=/);
  assert.doesNotMatch(source, /saveProject\s*\(/);
  assert.doesNotMatch(source, /recordSceneImageSelection\s*\(/);
  assert.doesNotMatch(source, /fetch\s*\(/);
});

test('expensive decode is gated by base evidence and cached', () => {
  const gate = source.indexOf('evidence.pairs < MIN_BASE_PAIRS');
  const build = source.indexOf('buildRuntime(projects, corpus.decisions)');
  assert.ok(gate >= 0 && build > gate);
  assert.match(source, /let cachedPromise = null/);
  assert.match(source, /key !== lastSignature/);
  assert.match(source, /maxDimension: 128/);
});
