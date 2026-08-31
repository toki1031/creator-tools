import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../projectFactory.js';
import { appendDecision } from '../decisionLog.js';
import {
  createProjectBackupPayload,
  createRestoredProject,
  normalizeImportedProject
} from '../projectBackup.js';

test('project backup payload keeps normalized DecisionRecords', () => {
  const project = createProject('Dataset QA', 'great-person', 'youtube-shorts');
  appendDecision(project, { decisionType: 'scene-order', sceneId: 's2' }, {
    createId: () => 'decision-1',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  project.learning.decisions.push({ invalid: true });

  const payload = createProjectBackupPayload(project, []);
  assert.equal(payload.learning.decisions.length, 1);
  assert.equal(payload.learning.decisions[0].id, 'decision-1');
  assert.equal(payload.learning.decisions[0].projectId, project.id);
});

test('import normalizes malformed learning data without changing schema version', () => {
  const project = createProject('Dataset QA', 'great-person', 'youtube-shorts');
  project.learning = {
    decisions: [
      null,
      { decisionType: 'scene-order' },
      {
        id: 'decision-valid',
        decisionType: 'scene-order',
        projectId: project.id,
        sceneId: 's1',
        proposal: [{ sceneId: 's1', order: 1, text: 'one' }],
        finalDecision: [{ sceneId: 's1', order: 1, text: 'one' }],
        humanAction: { type: 'reorder', direction: 'up' },
        source: { type: 'system' },
        timestamp: '2026-08-31T00:00:00.000Z'
      }
    ]
  };

  const { project: normalized } = normalizeImportedProject(project, { createId: () => 'generated-id' });
  assert.equal(normalized.schemaVersion, 4);
  assert.equal(normalized.learning.decisions.length, 1);
  assert.equal(normalized.learning.decisions[0].id, 'decision-valid');
});

test('restored project retains historical decisions while receiving a new project id', () => {
  const project = createProject('Dataset QA', 'great-person', 'youtube-shorts');
  appendDecision(project, { decisionType: 'scene-order', sceneId: 's2' }, {
    createId: () => 'decision-1',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  const originalProjectId = project.id;
  const { project: normalized } = normalizeImportedProject(project);
  const restored = createRestoredProject(normalized, {
    createId: () => 'restored-project',
    now: () => '2026-08-31T01:00:00.000Z'
  });

  assert.equal(restored.id, 'restored-project');
  assert.equal(restored.learning.decisions.length, 1);
  assert.equal(restored.learning.decisions[0].projectId, originalProjectId);
  assert.equal(restored.schemaVersion, 4);
});
