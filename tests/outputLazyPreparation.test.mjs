import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');

test('output route does not eagerly prepare heavy video media', () => {
  assert.match(source, /let preparedPromise=null/);
  assert.match(source, /const ensurePreparedAssets=\(\)=>/);
  assert.doesNotMatch(source, /let preparedPromise=prepareVideoProject/);
  assert.match(source, /const assets=await ensurePreparedAssets\(\);drawProjectFrame/);
  assert.match(source, /const assets=await ensurePreparedAssets\(\);await runVisualPreview/);
  assert.match(source, /let assets=await ensurePreparedAssets\(\);/);
});

test('final review images ask the browser to decode offscreen thumbnails lazily', () => {
  assert.match(source, /loading="lazy" decoding="async" alt="シーン\$\{index\+1\}素材"/);
});

test('output route tells the user that media is prepared only when needed', () => {
  assert.match(source, /操作時に素材を準備します/);
  assert.match(source, /プレビューまたは動画生成時に素材を読み込みます/);
});
