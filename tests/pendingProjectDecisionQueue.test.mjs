import test from 'node:test';
import assert from 'node:assert/strict';
import { applyQueuedProjectDecisions, queueProjectDecision } from '../db.js';

test('queued DecisionRecord is merged into the matching project exactly once', () => {
  const project = { id: 'queue-project-a', learning: { decisions: [] } };
  const record = { id: 'feedback-1', decisionType: 'scene-motion-ai-feedback', projectId: project.id };

  assert.equal(queueProjectDecision(project.id, record), true);
  assert.equal(queueProjectDecision(project.id, record), false);
  assert.deepEqual(applyQueuedProjectDecisions(project), ['feedback-1']);
  assert.equal(project.learning.decisions.length, 1);
  assert.equal(project.learning.decisions[0].id, 'feedback-1');

  applyQueuedProjectDecisions(project);
  assert.equal(project.learning.decisions.length, 1);
});

test('queued DecisionRecord does not leak into another project and invalid inputs are ignored', () => {
  const projectA = { id: 'queue-project-b', learning: { decisions: [] } };
  const projectB = { id: 'queue-project-c', learning: { decisions: [] } };
  const record = { id: 'feedback-2', decisionType: 'scene-motion-ai-feedback', projectId: projectA.id };

  assert.equal(queueProjectDecision('', record), false);
  assert.equal(queueProjectDecision(projectA.id, {}), false);
  assert.equal(queueProjectDecision(projectA.id, record), true);
  assert.deepEqual(applyQueuedProjectDecisions(projectB), []);
  assert.equal(projectB.learning.decisions.length, 0);
  assert.deepEqual(applyQueuedProjectDecisions(projectA), ['feedback-2']);
  assert.equal(projectA.learning.decisions.length, 1);
});
