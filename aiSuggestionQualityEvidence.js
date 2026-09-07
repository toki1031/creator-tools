function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeCount(value) {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? Math.floor(number) : 0;
}

function uniqueProjects(outcomes) {
  const ids = new Set();
  for (const outcome of Array.isArray(outcomes) ? outcomes : []) {
    const projectId = typeof outcome?.projectId === 'string' ? outcome.projectId.trim() : '';
    if (projectId) ids.add(projectId);
  }
  return ids.size;
}

export function summarizeAiSuggestionEvidence(evaluation = {}, options = {}) {
  const minEvaluated = Math.max(1, safeCount(options.minEvaluated) || 5);
  const minProjects = Math.max(1, safeCount(options.minProjects) || 3);
  const totalExamples = safeCount(evaluation?.totalExamples);
  const evaluated = safeCount(evaluation?.evaluated);
  const matched = safeCount(evaluation?.matched);
  const changed = safeCount(evaluation?.changed);
  const skipped = safeCount(evaluation?.skipped);
  const accuracy = finiteNumber(evaluation?.accuracy);
  const evaluatedProjects = uniqueProjects(evaluation?.outcomes);

  const internallyConsistent = matched + changed === evaluated;
  const hasEnoughEvidence =
    internallyConsistent &&
    evaluated >= minEvaluated &&
    evaluatedProjects >= minProjects &&
    accuracy !== null &&
    accuracy >= 0 &&
    accuracy <= 1;

  return {
    qualityEvidenceVersion: '0.45',
    decisionType: typeof evaluation?.decisionType === 'string' ? evaluation.decisionType : '',
    status: hasEnoughEvidence ? 'measured' : 'insufficient-evidence',
    thresholds: {
      minEvaluated,
      minProjects
    },
    totalExamples,
    evaluated,
    evaluatedProjects,
    matched,
    changed,
    skipped,
    accuracy,
    internallyConsistent,
    hasEnoughEvidence
  };
}

export function summarizeCreatorAiEvidence(evaluationReport = {}, options = {}) {
  return {
    qualityEvidenceVersion: '0.45',
    motion: summarizeAiSuggestionEvidence(evaluationReport?.motion, options),
    transition: summarizeAiSuggestionEvidence(evaluationReport?.transition, options)
  };
}
