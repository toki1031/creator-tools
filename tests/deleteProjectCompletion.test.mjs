import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../db.js', import.meta.url), 'utf8');

test('deleteProject resolves after transaction completion', () => {
  assert.match(source, /export async function deleteProject/);
  assert.match(source, /tx\.oncomplete\s*=\s*\(\)\s*=>\s*\{\s*db\.close\(\);\s*resolve\(\);\s*\}/s);
});
