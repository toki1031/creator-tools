import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePairwiseRanking, evaluateValidationSplit } from '../pairwiseRankingEvaluator.js';

const examples = [
  { chosenAssetId: 'a', rejectedAssetId: 'b' },
  { chosenAssetId: 'c', rejectedAssetId: 'd' },
  { chosenAssetId: 'e', rejectedAssetId: 'f' }
];

test('counts correct, incorrect and ties', () => {
  const scores = { a: 2, b: 1, c: 0, d: 1, e: 3, f: 3 };
  const result = evaluatePairwiseRanking(examples, ({ assetId }) => scores[assetId]);
  assert.equal(result.summary.evaluated, 3);
  assert.equal(result.summary.correct, 1);
  assert.equal(result.summary.incorrect, 1);
  assert.equal(result.summary.ties, 1);
  assert.equal(result.summary.pairwiseAccuracy, 1 / 3);
});

test('skips invalid scores and scorer errors without mutating input', () => {
  const input = structuredClone(examples);
  const before = structuredClone(input);
  const result = evaluatePairwiseRanking(input, ({ assetId }) => {
    if (assetId === 'a') throw new Error('bad');
    if (assetId === 'c') return Number.NaN;
    return 1;
  });
  assert.equal(result.summary.skipped, 2);
  assert.deepEqual(input, before);
});

test('evaluates validation split only', () => {
  const split = { train: [examples[0]], validation: [examples[1]] };
  const result = evaluateValidationSplit(split, ({ role }) => role === 'chosen' ? 2 : 1);
  assert.equal(result.summary.inputExamples, 1);
  assert.equal(result.summary.correct, 1);
});
