import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');

test('normal video generation does not copy the completed Blob for SHA-256 verification', () => {
  assert.doesNotMatch(source, /result\.blob\.arrayBuffer\(\)/);
  assert.doesNotMatch(source, /generatedHash/);
});

test('post-save heavy video verification is removed from the normal output flow', () => {
  assert.doesNotMatch(source, /verifySavedVideo/);
  assert.match(source, /id=\"generateVideo\"/);
  assert.match(source, /id=\"showFirstFrame\"/);
});
