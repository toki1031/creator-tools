import test from 'node:test';
import assert from 'node:assert/strict';
import { productionStageLabel } from '../productionTimingStages.js';

test('uses user-facing Japanese production stage labels', () => {
  assert.equal(productionStageLabel('scenes'), 'Scene・素材');
  assert.equal(productionStageLabel('output'), '動画出力');
});
