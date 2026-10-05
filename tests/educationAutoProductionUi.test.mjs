import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production-request UI is enabled for Great Person and Education Studios',async()=>{
  const source=await readFile(new URL('../autoProductionUi.js',import.meta.url),'utf8');
  assert.match(source,/education:\s*\{\s*genre:'education'/);
  assert.match(source,/AUTO_PRODUCTION_STUDIOS\[route\.studio\]/);
  assert.match(source,/genre:\s*studio\.genre/);
  assert.match(source,/platform:\s*studio\.platform/);
});
