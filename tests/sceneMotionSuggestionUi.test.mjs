import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../sceneMotionSuggestionUi.js', import.meta.url), 'utf8');

test('scene motion AI UI stays advisory and uses trained motion data', () => {
  assert.match(source, /createSceneMotionTrainingSet/);
  assert.match(source, /trainSceneMotionModel/);
  assert.match(source, /predictSceneMotion/);
  assert.match(source, /\[data-motion\]/);
  assert.match(source, /scene-motion-ai-suggestion/);
  assert.match(source, /examples\.length\s*>=\s*5/);
  assert.match(source, /labels\.size\s*>=\s*2/);
  assert.match(source, /AI提案：学習中/);
  assert.match(source, /AI提案：現在の設定と一致/);
  assert.doesNotMatch(source, /select\.value\s*=/);
  assert.doesNotMatch(source, /saveProject\s*\(/);
  assert.doesNotMatch(source, /recordSceneMotionChange\s*\(/);
});
