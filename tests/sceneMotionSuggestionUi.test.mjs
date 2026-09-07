import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../sceneMotionSuggestionUi.js', import.meta.url), 'utf8');

test('scene motion AI UI uses enhanced local multi-project training and stays advisory', () => {
  assert.match(source, /listProjects/);
  assert.match(source, /createLocalLearningCorpus/);
  assert.match(source, /createAiEnhancedTrainingSet\(corpus\.decisions, 'scene-motion'\)/);
  assert.match(source, /evaluateAiSuggestionOutcomes\(corpus\.decisions, 'scene-motion'\)/);
  assert.match(source, /summarizeAiSuggestionEvidence/);
  assert.match(source, /evidence\.hasEnoughEvidence/);
  assert.match(source, /trainSceneMotionModel/);
  assert.match(source, /predictSceneMotion/);
  assert.match(source, /createAiLearningSignature/);
  assert.match(source, /createAiSuggestionRuntimeCache/);
  assert.match(source, /learningCache\.get\(signature/);
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

test('scene motion feedback is queued only from an explicit human change', () => {
  assert.match(source, /createSceneMotionAiFeedbackRecord/);
  assert.match(source, /queueProjectDecision/);
  assert.match(source, /humanConfirmed:\s*true/);
  assert.match(source, /finalMotion:\s*select\.value/);
  assert.match(source, /aiSuggestedMotion/);
  assert.match(source, /aiFeedbackConsumed/);
  assert.match(source, /document\.addEventListener\('change',\s*captureHumanMotionFeedback,\s*true\)/);
  assert.doesNotMatch(source, /dispatchEvent/);
});
