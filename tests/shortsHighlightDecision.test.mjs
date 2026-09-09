import test from 'node:test';
import assert from 'node:assert/strict';
import { hasShortsHighlightDecision, recordShortsHighlightDecision } from '../shortsHighlightDecision.js';

const candidate = {
  startIndex: 0,
  endIndex: 1,
  sceneNumbers: [1, 2],
  durationSec: 42,
  score: 87,
  reasons: ['問いがある', '尺が適切'],
  previewText: 'なぜ北斎は晩年まで描き続けたのか？'
};

function project() {
  return {
    id: 'project-1',
    scenes: [
      { id:'scene-a', text:'A', durationSec:20 },
      { id:'scene-b', text:'B', durationSec:22 },
      { id:'scene-c', text:'C', durationSec:18 }
    ]
  };
}

test('records adopted Shorts highlight as a DecisionRecord', () => {
  const value = project();
  const record = recordShortsHighlightDecision(value, candidate, { action:'adopt', rank:1 }, {
    createId: () => 'decision-1',
    now: () => '2026-09-10T00:00:00.000Z'
  });

  assert.equal(record.decisionType, 'shorts-highlight-selection');
  assert.equal(record.humanAction.type, 'adopt');
  assert.deepEqual(record.context.sceneIds, ['scene-a', 'scene-b']);
  assert.equal(record.context.rank, 1);
  assert.equal(record.proposal.score, 87);
  assert.deepEqual(record.finalDecision, { selected:true, sceneIds:['scene-a', 'scene-b'] });
  assert.equal(value.learning.decisions.length, 1);
  assert.equal(hasShortsHighlightDecision(value, candidate, 'adopt'), true);
});

test('records rejected candidate without changing source scenes', () => {
  const value = project();
  const before = structuredClone(value.scenes);
  const record = recordShortsHighlightDecision(value, candidate, { action:'reject', rank:2 });

  assert.equal(record.humanAction.type, 'reject');
  assert.equal(record.finalDecision.selected, false);
  assert.deepEqual(value.scenes, before);
});

test('does not duplicate the same action for the same candidate', () => {
  const value = project();
  recordShortsHighlightDecision(value, candidate, { action:'reject' });
  const duplicate = recordShortsHighlightDecision(value, candidate, { action:'reject' });
  assert.equal(duplicate, null);
  assert.equal(value.learning.decisions.length, 1);
});

test('can preserve a later change of mind as a separate decision', () => {
  const value = project();
  recordShortsHighlightDecision(value, candidate, { action:'reject' });
  recordShortsHighlightDecision(value, candidate, { action:'adopt' });
  assert.equal(value.learning.decisions.length, 2);
  assert.equal(hasShortsHighlightDecision(value, candidate, 'reject'), true);
  assert.equal(hasShortsHighlightDecision(value, candidate, 'adopt'), true);
});
