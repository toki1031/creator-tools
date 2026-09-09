import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_SUGGESTION_CONTEXT_VERSION } from '../productionSuggestionVersion.js';
test('production suggestion context starts at version 1', () => assert.equal(PRODUCTION_SUGGESTION_CONTEXT_VERSION, 1));
