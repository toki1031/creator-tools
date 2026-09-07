import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../sceneTransitionSuggestionUi.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('scene transition AI UI stays advisory and uses trained transition data', () => {
  assert.match(source, /createSceneTransitionTrainingSet/);
  assert.match(source, /trainSceneTransitionModel/);
  assert.match(source, /predictSceneTransition/);
  assert.match(source, /\[data-transition\]/);
  assert.match(source, /scene-transition-ai-suggestion/);
  assert.match(source, /examples\.length\s*>=\s*5/);
  assert.match(source, /labels\.size\s*>=\s*2/);
  assert.match(source, /AI提案：学習中/);
  assert.match(source, /AI提案：現在の設定と一致/);
  assert.doesNotMatch(source, /select\.value\s*=(?!=)/);
  assert.doesNotMatch(source, /saveProject\s*\(/);
  assert.doesNotMatch(source, /recordSceneTransitionChange\s*\(/);
  assert.match(index, /sceneTransitionSuggestionUi\.js/);
});
