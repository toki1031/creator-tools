import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../smartReframeRendererBridge.js', import.meta.url), 'utf8');

test('iPhone uses the v1-compatible renderer path without Smart Reframe bridge', () => {
  assert.match(source, /export function shouldUseSmartReframeRendererBridge/);
  assert.match(source, /iPhone\|iPad\|iPod/);
  assert.match(source, /if \(shouldUseSmartReframeRendererBridge\(\)\)/);
  assert.match(source, /void refreshSourceMap\(\)/);
});
