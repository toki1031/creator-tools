import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('production assistant uses versioned preset storage with legacy compatibility', () => {
  const ui=fs.readFileSync(new URL('../productionAssistantUi.js', import.meta.url),'utf8');
  const store=fs.readFileSync(new URL('../productionPresetStore.js', import.meta.url),'utf8');
  assert.match(ui,/productionPresetStore\.js/);
  assert.match(store,/creator-os-production-presets-v2/);
  assert.match(store,/creator-os-production-preset-v1/);
});
