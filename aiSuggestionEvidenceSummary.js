import { createSceneMotionTrainingSet } from './sceneMotionTrainingData.js';
import { createSceneTransitionTrainingSet } from './sceneTransitionTrainingData.js';

const CONFIG = {
  'scene-motion': createSceneMotionTrainingSet,
  'scene-transition': createSceneTransitionTrainingSet
};

function finiteNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeEvaluation(evaluation = {}) {
  const evaluated = Number.isInteger(evaluation?.evaluated) && evaluation.evaluated >= 0
    ? evaluation.evaluated
    : 0;
  const accuracy = finiteNumber(evaluation?.accuracy);
  const outcomes = Array.isArray(evaluation?.outcomes) ? evaluation.outcomes : [];
  const projectIds = new Set(
    outcomes
      .map(outcome => String(outcome?.projectId || '').trim())
      .filter(Boolean)
  );
  const validAccuracy = accuracy !== null && accuracy >= 0 && accuracy <= 1;
  const measured = evaluated >= 5 && projectIds.size >= 3 && validAccuracy;
  return {
    status: measured ? 'measured' : 'insufficient',
    evaluated,
    evaluatedProjects: projectIds.size,
    accuracy: validAccuracy ? accuracy : null
  };
}

export function createAiSuggestionEvidenceSummary(decisions = [], decisionType, evaluation = {}) {
  const createTrainingSet = CONFIG[decisionType];
  if (!createTrainingSet) {
    return {
      summaryVersion: '0.48',
      decisionType: decisionType || '',
      training: { examples: 0, labels: 0, projects: 0 },
      evaluation: normalizeEvaluation({}),
      status: 'insufficient'
    };
  }

  const examples = createTrainingSet(Array.isArray(decisions) ? decisions : []).examples || [];
  const labels = new Set(examples.map(example => String(example?.label || '').trim()).filter(Boolean));
  const projects = new Set(examples.map(example => String(example?.projectId || '').trim()).filter(Boolean));
  const evaluationSummary = normalizeEvaluation(evaluation);
  const trainingReady = examples.length >= 5 && labels.size >= 2 && projects.size >= 1;
  const status = trainingReady && evaluationSummary.status === 'measured' ? 'measured' : 'insufficient';

  return {
    summaryVersion: '0.48',
    decisionType,
    training: {
      examples: examples.length,
      labels: labels.size,
      projects: projects.size
    },
    evaluation: evaluationSummary,
    status
  };
}

export function createCreatorAiEvidenceSummary(decisions = [], evaluations = {}) {
  return {
    summaryVersion: '0.48',
    motion: createAiSuggestionEvidenceSummary(decisions, 'scene-motion', evaluations?.motion),
    transition: createAiSuggestionEvidenceSummary(decisions, 'scene-transition', evaluations?.transition)
  };
}
