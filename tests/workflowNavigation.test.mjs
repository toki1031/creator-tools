import test from 'node:test';
import assert from 'node:assert/strict';
import { previousWorkflowPage } from '../workflowNavigation.js';

test('workflow back navigation follows the editing sequence', () => {
  assert.equal(previousWorkflowPage('project'), 'studio');
  assert.equal(previousWorkflowPage('scenes'), 'project');
  assert.equal(previousWorkflowPage('bgm'), 'scenes');
  assert.equal(previousWorkflowPage('output'), 'bgm');
  assert.equal(previousWorkflowPage('publish'), 'output');
  assert.equal(previousWorkflowPage('ai'), 'studio');
});

test('unknown workflow page safely falls back to studio', () => {
  assert.equal(previousWorkflowPage('unknown'), 'studio');
});
