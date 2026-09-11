import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const renderer = fs.readFileSync(new URL('../videoRenderer.js', import.meta.url), 'utf8');

// Guard the v1.4 iPhone Safari policy: Scene narration must not be fully decoded up front.
test('scene narration preparation keeps references instead of encoded buffers', () => {
  assert.match(renderer, /const sceneNarrationSources = scenes\.map/);
  assert.match(renderer, /再生直前に順番に読み込みます/);
  assert.doesNotMatch(renderer, /sceneNarrations\.push\(\{\s*arrayBuffer:/);
});

test('scene narration decode keeps a current plus next window and releases old buffers', () => {
  assert.match(renderer, /const primeSceneWindow = async index/);
  assert.match(renderer, /\[index, index \+ 1\]/);
  assert.match(renderer, /releaseBefore\(Math\.max\(0, index - 1\)\)/);
  assert.match(renderer, /entry\.source\.buffer = null/);
});