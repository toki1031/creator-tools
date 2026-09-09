import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('production assistant uses a versioned local preset key', () => { const source=fs.readFileSync(new URL('../productionAssistantUi.js', import.meta.url),'utf8'); assert.match(source,/creator-os-production-preset-v1/); });
