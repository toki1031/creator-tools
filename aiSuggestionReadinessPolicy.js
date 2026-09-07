function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampThreshold(value, fallback = 0.6) {
  const number = finiteNumber(value);
  if (number === null) return fallback;
  return Math.min(1, Math.max(0, number));
}

export function assessAiSuggestionReadiness(evidence = {}, options = {}) {
  const minAccuracy = clampThreshold(options.minAccuracy, 0.6);
  const accuracy = finiteNumber(evidence?.accuracy);
  const evidenceReady = evidence?.hasEnoughEvidence === true && evidence?.status === 'measured';
  const internallyConsistent = evidence?.internallyConsistent !== false;
  const accuracyValid = accuracy !== null && accuracy >= 0 && accuracy <= 1;
  const meetsAccuracy = accuracyValid && accuracy >= minAccuracy;
  const ready = evidenceReady && internallyConsistent && meetsAccuracy;

  let reason = 'ready';
  if (!evidenceReady) reason = 'insufficient-evidence';
  else if (!internallyConsistent) reason = 'inconsistent-evidence';
  else if (!accuracyValid) reason = 'invalid-accuracy';
  else if (!meetsAccuracy) reason = 'accuracy-below-threshold';

  return {
    readinessPolicyVersion: '0.59',
    decisionType: typeof evidence?.decisionType === 'string' ? evidence.decisionType : '',
    ready,
    reason,
    minAccuracy,
    accuracy,
    evaluated: Number.isFinite(Number(evidence?.evaluated)) ? Math.max(0, Math.floor(Number(evidence.evaluated))) : 0,
    evaluatedProjects: Number.isFinite(Number(evidence?.evaluatedProjects)) ? Math.max(0, Math.floor(Number(evidence.evaluatedProjects))) : 0
  };
}

export function assessCreatorAiSuggestionReadiness(evidenceReport = {}, options = {}) {
  return {
    readinessPolicyVersion: '0.59',
    motion: assessAiSuggestionReadiness(evidenceReport?.motion, options),
    transition: assessAiSuggestionReadiness(evidenceReport?.transition, options)
  };
}
