import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../videoRenderer.js', import.meta.url), 'utf8');
test('iPhone export uses a 720-class safe profile', () => {
  assert.match(source, /export function resolveExportProfile/);
  assert.match(source, /const maxPixels = 720 \* 1280/);
  assert.match(source, /iPhone\|iPad\|iPod/);
  assert.match(source, /exportProfile\.iosSafeMode \? 30 : 60/);
  assert.match(source, /if \(iosSafeMode\) return 3_000_000/);
});
