import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalLearningCorpus } from '../localLearningCorpus.js';

function project(id, decisions) {
  return { id, title: `Project ${id}`, mediaLibrary: [{ imageData: 'data:image/png;base64,abc' }], learning: { decisions } };
}

test('combines DecisionRecords from multiple local projects without media payloads', () => {
  const input = [
    project('p1', [
      { id: 'd1', decisionType: 'scene-motion', sceneId: 's1', finalDecision: { motion: 'zoom-in' }, imageData: 'data:image/png;base64,abc' },
      { id: 'd2', decisionType: 'scene-transition', projectId: 'p1', sceneId: 's2', finalDecision: { transition: 'cut' }, context: { preview: 'blob:https://example.test/1' } }
    ]),
    project('p2', [
      { id: 'd3', decisionType: 'scene-motion', projectId: 'p2', sceneId: 's3', finalDecision: { motion: 'none' } }
    ])
  ];
  const original = structuredClone(input);
  const corpus = createLocalLearningCorpus(input);

  assert.equal(corpus.corpusVersion, '0.46');
  assert.deepEqual(corpus.summary, {
    projects: 2,
    totalDecisions: 3,
    skippedProjects: 0,
    skippedDecisions: 0,
    decisionTypes: { 'scene-motion': 2, 'scene-transition': 1 }
  });
  assert.equal(corpus.decisions[0].projectId, 'p1');
  assert.equal('imageData' in corpus.decisions[0], false);
  assert.equal('preview' in corpus.decisions[1].context, false);
  assert.equal(JSON.stringify(corpus).includes('data:image'), false);
  assert.equal(JSON.stringify(corpus).includes('blob:https'), false);
  assert.deepEqual(input, original);
});

test('skips malformed projects and decisions safely', () => {
  const corpus = createLocalLearningCorpus([
    null,
    { id: '', learning: { decisions: [] } },
    project('p1', [null, 'bad', [], { id: 'd1', decisionType: '', sceneId: 's1' }])
  ]);

  assert.equal(corpus.summary.projects, 1);
  assert.equal(corpus.summary.totalDecisions, 1);
  assert.equal(corpus.summary.skippedProjects, 2);
  assert.equal(corpus.summary.skippedDecisions, 3);
  assert.deepEqual(corpus.summary.decisionTypes, { unknown: 1 });
  assert.equal(corpus.decisions[0].projectId, 'p1');
});

test('handles non-array input as an empty corpus', () => {
  assert.deepEqual(createLocalLearningCorpus(null), {
    corpusVersion: '0.46',
    summary: {
      projects: 0,
      totalDecisions: 0,
      skippedProjects: 0,
      skippedDecisions: 0,
      decisionTypes: {}
    },
    decisions: []
  });
});
