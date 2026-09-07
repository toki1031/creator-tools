import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../sceneTransitionSuggestionUi.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const loader = await readFile(new URL('../optionalAiModuleLoader.js', import.meta.url), 'utf8');

test('scene transition AI UI uses enhanced local multi-project training and stays advisory', () => {
  assert.match(source, /listProjects/);
  assert.match(source, /createLocalLearningCorpus/);
  assert.match(source, /createAiEnhancedTrainingSet\(corpus\.decisions, 'scene-transition'\)/);
  assert.match(source, /evaluateAiSuggestionOutcomes\(corpus\.decisions, 'scene-transition'\)/);
  assert.match(source, /summarizeAiSuggestionEvidence/);
  assert.match(source, /evidence\.hasEnoughEvidence/);
  assert.match(source, /trainSceneTransitionModel/);
  assert.match(source, /predictSceneTransition/);
  assert.match(source, /\[data-transition\]/);
  assert.match(source, /scene-transition-ai-suggestion/);
  assert.match(source, /examples\.length\s*>=\s*5/);
  assert.match(source, /labels\.size\s*>=\s*2/);
  assert.match(source, /AI提案：学習中（\$\{examples\.length\}件・\$\{contributingProjects\}プロジェクト）/);
  assert.match(source, /AI提案：現在の設定と一致/);
  assert.doesNotMatch(source, /select\.value\s*=(?!=)/);
  assert.doesNotMatch(source, /saveProject\s*\(/);
  assert.doesNotMatch(source, /recordSceneTransitionChange\s*\(/);
  assert.match(index, /optionalAiModuleLoader\.js/);
  assert.match(loader, /sceneTransitionSuggestionUi\.js/);
  assert.match(loader, /\.catch\(/);
});

test('scene transition feedback is queued only from an explicit human change', () => {
  assert.match(source, /createSceneTransitionAiFeedbackRecord/);
  assert.match(source, /queueProjectDecision/);
  assert.match(source, /humanConfirmed:\s*true/);
  assert.match(source, /finalTransition:\s*select\.value/);
  assert.match(source, /aiSuggestedTransition/);
  assert.match(source, /aiFeedbackConsumed/);
  assert.match(source, /document\.addEventListener\('change',\s*captureHumanTransitionFeedback,\s*true\)/);
  assert.doesNotMatch(source, /dispatchEvent/);
});
