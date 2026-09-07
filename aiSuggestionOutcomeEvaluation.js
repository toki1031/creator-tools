import { createSceneMotionTrainingSet } from './sceneMotionTrainingData.js';
import { trainSceneMotionModel, predictSceneMotion } from './sceneMotionModel.js';
import { createSceneTransitionTrainingSet } from './sceneTransitionTrainingData.js';
import { trainSceneTransitionModel, predictSceneTransition } from './sceneTransitionModel.js';

const CONFIG = {
  'scene-motion': {
    createSet: createSceneMotionTrainingSet,
    train: trainSceneMotionModel,
    predict: predictSceneMotion,
    labels: new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'])
  },
  'scene-transition': {
    createSet: createSceneTransitionTrainingSet,
    train: trainSceneTransitionModel,
    predict: predictSceneTransition,
    labels: new Set(['fade', 'cut'])
  }
};

function emptyResult(decisionType, totalExamples = 0) {
  return {
    evaluationVersion: '0.44',
    decisionType,
    totalExamples,
    evaluated: 0,
    matched: 0,
    changed: 0,
    skipped: totalExamples,
    accuracy: null,
    outcomes: []
  };
}

export function evaluateAiSuggestionOutcomes(decisions = [], decisionType) {
  const config = CONFIG[decisionType];
  if (!config) return emptyResult(decisionType || '', 0);

  const examples = config.createSet(decisions).examples;
  if (examples.length < 2) return emptyResult(decisionType, examples.length);

  const outcomes = [];
  let matched = 0;
  let changed = 0;
  let skipped = 0;

  // Leave-one-project-out: an outcome is never predicted from records belonging
  // to the same project. This prevents project-specific leakage.
  for (const example of examples) {
    const trainExamples = examples.filter(candidate => candidate.projectId !== example.projectId);
    const trainLabels = new Set(trainExamples.map(candidate => candidate.label));
    if (trainExamples.length < 2 || trainLabels.size < 2) {
      skipped += 1;
      continue;
    }

    const model = config.train(trainExamples);
    const prediction = config.predict(model, example.context);
    const suggested = prediction?.label;
    if (!config.labels.has(suggested) || !config.labels.has(example.label)) {
      skipped += 1;
      continue;
    }

    const isMatch = suggested === example.label;
    if (isMatch) matched += 1;
    else changed += 1;
    outcomes.push({
      decisionId: example.decisionId,
      projectId: example.projectId,
      sceneId: example.sceneId,
      suggested,
      finalDecision: example.label,
      outcome: isMatch ? 'matched' : 'changed'
    });
  }

  const evaluated = matched + changed;
  return {
    evaluationVersion: '0.44',
    decisionType,
    totalExamples: examples.length,
    evaluated,
    matched,
    changed,
    skipped,
    accuracy: evaluated ? matched / evaluated : null,
    outcomes
  };
}

export function evaluateCreatorAiSuggestions(decisions = []) {
  return {
    evaluationVersion: '0.44',
    motion: evaluateAiSuggestionOutcomes(decisions, 'scene-motion'),
    transition: evaluateAiSuggestionOutcomes(decisions, 'scene-transition')
  };
}
