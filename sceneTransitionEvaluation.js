import { splitPairwiseExamplesByProject } from './pairwiseProjectSplit.js';
import { trainSceneTransitionModel, predictSceneTransition } from './sceneTransitionModel.js';

const LABELS = ['fade', 'cut'];
const LABEL_SET = new Set(LABELS);

function emptyMatrix() {
  return Object.fromEntries(LABELS.map(actual => [actual, Object.fromEntries(LABELS.map(predicted => [predicted, 0]))]));
}

export function evaluateSceneTransitionExamples(examples = [], options = {}) {
  const source = Array.isArray(examples) ? examples : [];
  const split = splitPairwiseExamplesByProject(source, {
    seed: options.seed || 'creator-os-scene-transition-v0.42',
    validationRatio: options.validationRatio ?? 0.2
  });
  const model = trainSceneTransitionModel(split.train, { alpha: options.alpha ?? 1 });
  const confusionMatrix = emptyMatrix();
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  for (const example of split.validation) {
    const actual = typeof example?.label === 'string' ? example.label.trim() : '';
    if (!LABEL_SET.has(actual)) {
      skipped += 1;
      continue;
    }
    const prediction = predictSceneTransition(model, example?.context);
    const predicted = prediction?.label;
    if (!LABEL_SET.has(predicted)) {
      skipped += 1;
      continue;
    }
    confusionMatrix[actual][predicted] += 1;
    if (actual === predicted) correct += 1;
    else incorrect += 1;
  }

  const evaluated = correct + incorrect;
  return {
    evaluationVersion: '0.42',
    split: {
      seed: split.seed,
      validationRatio: split.validationRatio,
      summary: split.summary,
      projectSplits: split.projectSplits
    },
    modelSummary: {
      modelVersion: model.modelVersion,
      modelType: model.modelType,
      totalExamples: model.totalExamples,
      vocabularySize: model.vocabulary.length,
      classDocCounts: model.classDocCounts
    },
    metrics: {
      validationExamples: split.validation.length,
      evaluated,
      correct,
      incorrect,
      skipped,
      accuracy: evaluated ? correct / evaluated : null,
      confusionMatrix
    }
  };
}
