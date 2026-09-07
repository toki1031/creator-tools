function finiteScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function evaluatePairwiseRanking(examples = [], scorer) {
  const source = Array.isArray(examples) ? examples : [];
  const summary = {
    inputExamples: source.length,
    evaluated: 0,
    correct: 0,
    incorrect: 0,
    ties: 0,
    skipped: 0,
    pairwiseAccuracy: null
  };
  const results = [];

  if (typeof scorer !== 'function') {
    summary.skipped = source.length;
    return { evaluationVersion: '0.37', summary, results };
  }

  source.forEach((example, index) => {
    try {
      const chosenScore = finiteScore(scorer({ ...example, assetId: example?.chosenAssetId, role: 'chosen' }));
      const rejectedScore = finiteScore(scorer({ ...example, assetId: example?.rejectedAssetId, role: 'rejected' }));
      if (chosenScore == null || rejectedScore == null) {
        summary.skipped += 1;
        results.push({ index, status: 'skipped', chosenScore, rejectedScore });
        return;
      }
      summary.evaluated += 1;
      let status;
      if (chosenScore > rejectedScore) {
        summary.correct += 1;
        status = 'correct';
      } else if (chosenScore < rejectedScore) {
        summary.incorrect += 1;
        status = 'incorrect';
      } else {
        summary.ties += 1;
        status = 'tie';
      }
      results.push({ index, status, chosenScore, rejectedScore });
    } catch {
      summary.skipped += 1;
      results.push({ index, status: 'skipped', chosenScore: null, rejectedScore: null });
    }
  });

  summary.pairwiseAccuracy = summary.evaluated ? summary.correct / summary.evaluated : null;
  return { evaluationVersion: '0.37', summary, results };
}

export function evaluateValidationSplit(split, scorer) {
  return evaluatePairwiseRanking(Array.isArray(split?.validation) ? split.validation : [], scorer);
}
