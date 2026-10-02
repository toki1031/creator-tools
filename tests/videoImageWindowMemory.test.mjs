import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../videoRenderer.js', import.meta.url), 'utf8');

// iPhone Safari regression guard: decoded scene images must stay bounded during long-form export.
test('video preparation keeps decoded images to a current plus next scene window', () => {
  assert.match(source, /export async function ensurePreparedImageWindow/);
  assert.match(source, /new Set\(\[current, current \+ 1\]/);
  assert.match(source, /if \(!keep\.has\(i\)\) \{[\s\S]*prepared\.images\[i\] = null/);
  assert.doesNotMatch(source, /for \(let index = 0; index < scenes\.length; index\+\+\) \{\n    const imageSource = resolveSceneImageSource/);
});

test('video export primes the first image window and releases decoded images after recording', () => {
  assert.match(source, /await ensurePreparedImageWindow\(project, prepared, 0, \{ onStatus \}\)/);
  assert.match(source, /releasePreparedImages\(prepared\)/);
  assert.match(source, /releasePreparedImageSourceAt\(prepared, i\)/);
});

test('frame drawing advances image window without blocking every animation frame', () => {
  assert.match(source, /prepared\.imageWindowIndex !== item\.index\) void ensurePreparedImageWindow/);
});


test('MediaRef blobs are resolved before render while object URLs stay window-scoped',()=>{
  assert.match(source,/prepareVideoImageSources/);
  assert.match(source,/imageBlobs/);
  assert.match(source,/createObjectUrl/);
  assert.match(source,/imageObjectUrls/);
  assert.match(source,/revokeObjectUrl/);
});
