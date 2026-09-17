import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAssetCandidate, evaluateAssetCandidates } from '../assetCandidateEvaluation.js';

const historicalRequirement = {
  requestedType: 'historical-source',
  status: 'planned',
  prohibitedContent: ['AI fake chart']
};
const readyPlan = {
  requestedType: 'historical-source',
  status: 'ready',
  prohibitedContent: ['invented numbers']
};

test('LoC historical candidate with rights metadata is eligible but never auto adopted', () => {
  const result = evaluateAssetCandidate({
    provider: 'library-of-congress',
    requestedType: 'historical-source',
    title: 'Nightingale statistical diagram',
    sourcePage: 'https://www.loc.gov/item/example/',
    previewUrl: 'https://tile.loc.gov/example.jpg',
    rightsAdvisory: 'Rights advisory from source',
    rightsStatus: 'reviewed-metadata'
  }, historicalRequirement, readyPlan);
  assert.equal(result.status, 'eligible');
  assert.equal(result.autoAdoptable, false);
  assert.deepEqual(result.prohibitedContent, ['AI fake chart', 'invented numbers']);
});

test('rights-unknown candidate remains needs-review', () => {
  const result = evaluateAssetCandidate({
    provider: 'library-of-congress',
    requestedType: 'historical-source',
    sourcePage: 'https://www.loc.gov/item/example/',
    previewUrl: 'https://tile.loc.gov/example.jpg'
  }, historicalRequirement, readyPlan);
  assert.equal(result.status, 'needs-review');
  assert.equal(result.autoAdoptable, false);
  assert.match(result.reasons.join(' '), /権利/);
});

test('generated reconstruction is rejected for requested historical source', () => {
  const result = evaluateAssetCandidate({
    provider: 'generated-reconstruction',
    generated: true,
    sourcePage: 'generated://scene-5',
    previewUrl: 'blob://preview'
  }, historicalRequirement, readyPlan);
  assert.equal(result.status, 'rejected');
  assert.equal(result.autoAdoptable, false);
  assert.match(result.reasons.join(' '), /生成素材/);
});

test('blocked upstream plan rejects candidate', () => {
  const result = evaluateAssetCandidate({
    sourcePage: 'https://www.loc.gov/item/example/',
    previewUrl: 'https://tile.loc.gov/example.jpg',
    rightsAdvisory: 'metadata'
  }, historicalRequirement, { ...readyPlan, status: 'blocked' });
  assert.equal(result.status, 'rejected');
});

test('explicit material type mismatch is rejected', () => {
  const result = evaluateAssetCandidate({
    requestedType: 'modern-visual',
    sourcePage: 'https://example.invalid/item',
    previewUrl: 'https://example.invalid/image.jpg',
    rights: 'metadata'
  }, historicalRequirement, readyPlan);
  assert.equal(result.status, 'rejected');
});

test('batch evaluation is pure and does not mutate inputs', () => {
  const candidates = [{ sourcePage: 'https://www.loc.gov/item/a/', previewUrl: 'https://tile.loc.gov/a.jpg' }];
  const before = JSON.stringify(candidates);
  const results = evaluateAssetCandidates(candidates, historicalRequirement, readyPlan);
  assert.equal(results.length, 1);
  assert.equal(JSON.stringify(candidates), before);
});
