import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../sceneMotionSuggestionUi.js', import.meta.url), 'utf8');

test('scene motion AI UI uses local multi-project evidence and stays advisory', () => {
  assert.match(source, /listProjects/);
  assert.match(source, /createLocalLearningCorpus/);
  assert.match(source, /createSceneMotionTrainingSet\(corpus\.decisions\)/);
  assert.match(source, /evaluateAiSuggestionOutcomes\(corpus\.decisions, 'scene-motion'\)/);
  assert.match(source, /summarizeAiSuggestionEvidence/);
  assert.match(source, /evidence\.hasEnoughEvidence/);
  assert.match(source, /trainSceneMotionModel/);
  assert.match(source, /predictSceneMotion/);
  assert.match(source, /\[data-motion\]/);
  assert.match(source, /scene-motion-ai-suggestion/);
  assert.match(source, /examples\.length\s*>=\s*5/);
  assert.match(source, /labels\.size\s*>=\s*2/);
  assert.match(source, /AI提案：学習中（\$\{examples\.length\}件・\$\{contributingProjects\}プロジェクト）/);
  assert.match(source, /AI提案：現在の設定と一致/);
  assert.doesNotMatch(source, /select\.value\s*=(?!=)/);
  assert.doesNotMatch(source, /saveProject\s*\(/);
  assert.doesNotMatch(source, /recordSceneMotionChange\s*\(/);
});
