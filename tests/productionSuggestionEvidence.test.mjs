import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionSuggestion } from '../productionSuggestion.js';
test('normalizes malformed evidence safely', () => { const s=createProductionSuggestion('scene-motion',{}, {decisionCount:-2,projectCount:'bad'}); assert.equal(s.evidence.decisionCount,0); assert.equal(s.evidence.projectCount,0); });
