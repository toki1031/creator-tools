import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProductionTiming } from '../productionTimingSummary.js';
test('invalid timing entries are ignored', () => assert.deepEqual(summarizeProductionTiming([{stage:'x',durationMs:-1},{stage:'x',durationMs:'bad'}]), []));
