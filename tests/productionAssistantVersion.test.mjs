import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_ASSISTANT_UI_VERSION } from '../productionAssistantVersion.js';
test('production assistant UI starts at version 1', () => assert.equal(PRODUCTION_ASSISTANT_UI_VERSION, 1));
