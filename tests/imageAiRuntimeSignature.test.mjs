import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createImageAiRuntimeSignature,
  createImageFeatureSignature,
  createSceneImageLearningSignature
} from '../imageAiRuntimeSignature.js';

const image = (id, body = 'AAAA') => ({ id, type: 'image', data: `data:image/png;base64,${body}` });
const decision = (id, projectId, chosen, alternatives = []) => ({
  decisionId: id,
  decisionType: 'scene-image-selection',
  projectId,
  sceneId: `scene-${id}`,
  finalDecision: { assetId: chosen },
  alternatives: alternatives.map(assetId => ({ assetId }))
});

test('image feature signature ignores unrelated project edits', () => {
  const a = [{ id: 'p1', updatedAt: 'old', title: 'A', mediaLibrary: [image('a1')] }];
  const b = [{ id: 'p1', updatedAt: 'new', title: 'B', mediaLibrary: [image('a1')] }];
  assert.equal(createImageFeatureSignature(a), createImageFeatureSignature(b));
});

test('image feature signature changes when an image body changes at same asset count', () => {
  const a = [{ id: 'p1', mediaLibrary: [image('a1', 'AAAA')] }];
  const b = [{ id: 'p1', mediaLibrary: [image('a1', 'BBBB')] }];
  assert.notEqual(createImageFeatureSignature(a), createImageFeatureSignature(b));
});

test('learning signature ignores unrelated decisions but tracks image choices', () => {
  const base = [decision('d1', 'p1', 'a1', ['a2'])];
  const unrelated = [...base, { decisionId: 'x', decisionType: 'scene-motion', projectId: 'p1' }];
  const changed = [decision('d1', 'p1', 'a2', ['a1'])];
  assert.equal(createSceneImageLearningSignature(base), createSceneImageLearningSignature(unrelated));
  assert.notEqual(createSceneImageLearningSignature(base), createSceneImageLearningSignature(changed));
});

test('combined runtime signature is deterministic across project/decision order', () => {
  const projectsA = [
    { id: 'p2', mediaLibrary: [image('b1')] },
    { id: 'p1', mediaLibrary: [image('a1')] }
  ];
  const projectsB = [...projectsA].reverse();
  const decisionsA = [decision('d2', 'p2', 'b1', ['b2']), decision('d1', 'p1', 'a1', ['a2'])];
  const decisionsB = [...decisionsA].reverse();
  assert.equal(createImageAiRuntimeSignature(projectsA, decisionsA), createImageAiRuntimeSignature(projectsB, decisionsB));
});
