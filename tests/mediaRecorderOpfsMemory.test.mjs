import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer = fs.readFileSync(new URL('../videoRenderer.js', import.meta.url), 'utf8');

test('recording chunks can be streamed to OPFS instead of retained in JS memory', () => {
  assert.match(renderer, /async function createRecordingSink/);
  assert.match(renderer, /navigator\.storage\.getDirectory\(\)/);
  assert.match(renderer, /handle\.createWritable\(\)/);
  assert.match(renderer, /writable\.write\(blob\)/);
  assert.match(renderer, /const recordingSink = await createRecordingSink\(actualMime\)/);
  assert.match(renderer, /recordingSink\.write\(event\.data\)/);
  assert.match(renderer, /blob = await recordingSink\.finish\(\)/);
  assert.doesNotMatch(renderer, /const chunks = \[\]/);
});

test('recording sink falls back safely when OPFS is unavailable', () => {
  assert.match(renderer, /if \(!globalThis\.navigator\?\.storage\?\.getDirectory\) return memorySink\(\)/);
  assert.match(renderer, /using in-memory chunks/);
});
