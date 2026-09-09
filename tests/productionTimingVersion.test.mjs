import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_TIMING_VERSION } from '../productionTimingVersion.js';
test('production timing contract starts at version 1', () => assert.equal(PRODUCTION_TIMING_VERSION, 1));
