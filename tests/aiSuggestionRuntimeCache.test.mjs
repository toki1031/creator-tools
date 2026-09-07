import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiLearningSignature, createAiSuggestionRuntimeCache } from '../aiSuggestionRuntimeCache.js';

test('reuses cached runtime while the relevant learning signature is unchanged', () => {
  const cache = createAiSuggestionRuntimeCache();
  let created = 0;
  const first = cache.get('same', () => ({ id: ++created }));
  const second = cache.get('same', () => ({ id: ++created }));
  assert.strictEqual(second, first);
  assert.equal(created, 1);
});

test('invalidates cache when the signature changes or is cleared', () => {
  const cache = createAiSuggestionRuntimeCache();
  let created = 0;
  const first = cache.get('a', () => ({ id: ++created }));
  const second = cache.get('b', () => ({ id: ++created }));
  assert.notStrictEqual(second, first);
  cache.clear();
  const third = cache.get('b', () => ({ id: ++created }));
  assert.notStrictEqual(third, second);
  assert.equal(created, 3);
});

test('learning signature changes only for selected DecisionRecord types and relevant decision fields', () => {
  const records = [
    { id: 'm1', decisionType: 'scene-motion', projectId: 'p1', sceneId: 's1', timestamp: 't1', finalDecision: { motion: 'zoom-in' }, humanAction: { type: 'selected' } },
    { id: 'x1', decisionType: 'subtitle-content', projectId: 'p1', sceneId: 's1', timestamp: 't2' }
  ];
  const before = structuredClone(records);
  const signature = createAiLearningSignature(records, ['scene-motion', 'scene-motion-ai-feedback']);
  const unrelatedChanged = createAiLearningSignature([{ ...records[0] }, { ...records[1], timestamp: 'changed' }], ['scene-motion', 'scene-motion-ai-feedback']);
  const relevantChanged = createAiLearningSignature([{ ...records[0], finalDecision: { motion: 'pan-left' } }, records[1]], ['scene-motion', 'scene-motion-ai-feedback']);
  assert.equal(signature, unrelatedChanged);
  assert.notEqual(signature, relevantChanged);
  assert.deepEqual(records, before);
});
