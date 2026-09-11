import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');

// v1.4 output policy: keep only lightweight preflight, first-frame confirmation, and full generation.
test('output route does not eagerly prepare heavy video media', () => {
  assert.match(source, /let preparedPromise=null/);
  assert.match(source, /const ensurePreparedAssets=\(\)=>/);
  assert.doesNotMatch(source, /let preparedPromise=prepareVideoProject/);
  assert.match(source, /const assets=await ensurePreparedAssets\(\);drawProjectFrame/);
  assert.match(source, /let assets=await ensurePreparedAssets\(\);/);
});

test('output route omits duplicate final-review image grid', () => {
  assert.doesNotMatch(source, /final-review-card/);
  assert.doesNotMatch(source, /approveFinalReview/);
  assert.match(source, /<h2>生成前チェック<\/h2>/);
});

test('output route removes 10 second preview controls and render range', () => {
  assert.doesNotMatch(source, /id=\"previewVideo\"/);
  assert.doesNotMatch(source, /id=\"stopPreview\"/);
  assert.doesNotMatch(source, /id=\"renderRange\"/);
  assert.match(source, /1フレーム確認/);
  assert.match(source, /🎬 動画を生成/);
});

test('output route tells the user that media is prepared only when needed', () => {
  assert.match(source, /操作時に素材を準備します/);
  assert.match(source, /1フレーム確認または動画生成時に素材を読み込みます/);
});
