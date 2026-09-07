function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundedRatio(value, fallback) {
  const number = finiteNumber(value);
  if (number === null) return fallback;
  return Math.min(1, Math.max(0, number));
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

export function assessSceneImageSuggestionReadiness(evaluationReport = {}, options = {}) {
  const summary = evaluationReport?.summary || {};
  const minEvaluated = nonNegativeInteger(options.minEvaluated, 5);
  const minProjects = nonNegativeInteger(options.minProjects, 3);
  const minAccuracy = boundedRatio(options.minAccuracy, 0.6);

  const evaluated = nonNegativeInteger(summary.evaluated, 0);
  const evaluatedProjects = nonNegativeInteger(summary.evaluatedProjects, 0);
  const correct = nonNegativeInteger(summary.correct, 0);
  const incorrect = nonNegativeInteger(summary.incorrect, 0);
  const ties = nonNegativeInteger(summary.ties, 0);
  const accuracy = finiteNumber(summary.pairwiseAccuracy);
  const accuracyValid = accuracy !== null && accuracy >= 0 && accuracy <= 1;
  const internallyConsistent = evaluated === correct + incorrect + ties
    && (!evaluated || (accuracyValid && Math.abs(accuracy - correct / evaluated) < 1e-12));
  const enoughEvidence = evaluated >= minEvaluated && evaluatedProjects >= minProjects;
  const meetsAccuracy = accuracyValid && accuracy >= minAccuracy;
  const ready = internallyConsistent && enoughEvidence && meetsAccuracy;

  let reason = 'ready';
  if (!internallyConsistent) reason = 'inconsistent-evaluation';
  else if (!enoughEvidence) reason = 'insufficient-evidence';
  else if (!accuracyValid) reason = 'invalid-accuracy';
  else if (!meetsAccuracy) reason = 'accuracy-below-threshold';

  return {
    readinessPolicyVersion: '0.68',
    ready,
    reason,
    thresholds: { minEvaluated, minProjects, minAccuracy },
    evidence: { evaluated, evaluatedProjects, correct, incorrect, ties, pairwiseAccuracy: accuracy },
    internallyConsistent,
    enoughEvidence,
    meetsAccuracy
  };
}
