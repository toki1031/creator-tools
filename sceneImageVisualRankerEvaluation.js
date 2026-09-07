import { trainSceneImageVisualRanker, scoreSceneImageVisualCandidate } from './sceneImageVisualRanker.js';
import { evaluatePairwiseRanking } from './pairwiseRankingEvaluator.js';

function projectIdOf(example) {
  return String(example?.projectId || '').trim();
}

function roleFeatures(example) {
  return example?.role === 'chosen' ? example?.chosenFeatures : example?.rejectedFeatures;
}

export function evaluateSceneImageVisualRanker(examples = []) {
  const source = Array.isArray(examples) ? examples : [];
  const accepted = source.filter(example => projectIdOf(example));
  const projectIds = [...new Set(accepted.map(projectIdOf))].sort();
  const projects = [];
  const summary = {
    inputExamples: source.length,
    acceptedExamples: accepted.length,
    projects: projectIds.length,
    evaluatedProjects: 0,
    evaluated: 0,
    correct: 0,
    incorrect: 0,
    ties: 0,
    skipped: 0,
    pairwiseAccuracy: null
  };

  for (const projectId of projectIds) {
    const train = accepted.filter(example => projectIdOf(example) !== projectId);
    const validation = accepted.filter(example => projectIdOf(example) === projectId);
    if (!train.length || !validation.length) {
      summary.skipped += validation.length;
      projects.push({
        projectId,
        trainingExamples: train.length,
        validationExamples: validation.length,
        evaluated: 0,
        correct: 0,
        incorrect: 0,
        ties: 0,
        skipped: validation.length,
        pairwiseAccuracy: null
      });
      continue;
    }

    const model = trainSceneImageVisualRanker(train);
    const evaluation = evaluatePairwiseRanking(validation, example => {
      return scoreSceneImageVisualCandidate(model, roleFeatures(example));
    });
    const item = {
      projectId,
      trainingExamples: train.length,
      validationExamples: validation.length,
      ...evaluation.summary
    };
    projects.push(item);
    summary.evaluatedProjects += 1;
    summary.evaluated += item.evaluated;
    summary.correct += item.correct;
    summary.incorrect += item.incorrect;
    summary.ties += item.ties;
    summary.skipped += item.skipped;
  }

  summary.pairwiseAccuracy = summary.evaluated ? summary.correct / summary.evaluated : null;
  return {
    evaluationVersion: '0.64',
    method: 'leave-one-project-out',
    summary,
    projects
  };
}
