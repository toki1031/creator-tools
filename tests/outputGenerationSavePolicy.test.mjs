import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');

test('video generation applies output settings without forcing a full project save first', () => {
  assert.match(source, /const applySettings=\(\)=>/);
  assert.match(source, /#generateVideo'[\s\S]*?applySettings\(\);/);
  assert.doesNotMatch(source, /#generateVideo'[\s\S]{0,240}?await persistSettings\(\)/);
});

test('output settings still persist through the normal save controller', () => {
  assert.match(source, /const persistSettings=async\(\)=>\{applySettings\(\);project\.updatedAt=/);
  assert.match(source, /createSaveController\(\{delay:350,persist:async\(\)=>\{await persistSettings\(\)/);
  assert.match(source, /applySettings[\s\S]*?canvas\.width=w;canvas\.height=h/);
});
