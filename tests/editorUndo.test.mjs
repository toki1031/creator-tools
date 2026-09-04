import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextEditHistory, isUndoableTextTarget } from '../editorUndo.js';

test('text edit history undoes and redoes one committed edit', () => {
  const history = createTextEditHistory();
  const target = { id: 'subtitle' };
  assert.equal(history.push({ target, before: '元の文章', after: '消しすぎた文章' }), true);
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);

  const undone = history.undo();
  assert.equal(undone.before, '元の文章');
  assert.equal(undone.after, '消しすぎた文章');
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), true);

  const redone = history.redo();
  assert.equal(redone.target, target);
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);
});

test('new edit after undo clears redo history', () => {
  const history = createTextEditHistory();
  const target = { id: 'script' };
  history.push({ target, before: 'A', after: 'AB' });
  history.undo();
  assert.equal(history.canRedo(), true);

  history.push({ target, before: 'A', after: 'AC' });
  assert.equal(history.canRedo(), false);
  assert.equal(history.undo().before, 'A');
});

test('unchanged values are not added to history', () => {
  const history = createTextEditHistory();
  assert.equal(history.push({ target: {}, before: '同じ', after: '同じ' }), false);
  assert.equal(history.canUndo(), false);
});

test('history keeps only the configured number of edits', () => {
  const history = createTextEditHistory(2);
  const target = {};
  history.push({ target, before: '0', after: '1' });
  history.push({ target, before: '1', after: '2' });
  history.push({ target, before: '2', after: '3' });
  assert.equal(history.undo().before, '2');
  assert.equal(history.undo().before, '1');
  assert.equal(history.undo(), null);
});

test('only editable text inputs and textareas are tracked', () => {
  assert.equal(isUndoableTextTarget({ tagName: 'TEXTAREA', disabled: false, readOnly: false }), true);
  assert.equal(isUndoableTextTarget({ tagName: 'INPUT', type: 'text', disabled: false, readOnly: false }), true);
  assert.equal(isUndoableTextTarget({ tagName: 'INPUT', type: 'search', disabled: false, readOnly: false }), true);
  assert.equal(isUndoableTextTarget({ tagName: 'INPUT', type: 'number', disabled: false, readOnly: false }), false);
  assert.equal(isUndoableTextTarget({ tagName: 'INPUT', type: 'file', disabled: false, readOnly: false }), false);
  assert.equal(isUndoableTextTarget({ tagName: 'TEXTAREA', disabled: true, readOnly: false }), false);
  assert.equal(isUndoableTextTarget({ tagName: 'TEXTAREA', disabled: false, readOnly: true }), false);
});
