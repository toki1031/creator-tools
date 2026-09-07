const FEATURE_KEYS = [
  'aspectRatio',
  'aspectBalance',
  'brightness',
  'contrast',
  'saturation',
  'edgeDensity'
];

function finiteFeatureVector(value) {
  if (!value || typeof value !== 'object') return null;
  const vector = {};
  for (const key of FEATURE_KEYS) {
    const number = Number(value[key]);
    if (!Number.isFinite(number)) return null;
    vector[key] = number;
  }
  return vector;
}

function round(value, digits = 8) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function trainSceneImageVisualRanker(examples = []) {
  const source = Array.isArray(examples) ? examples : [];
  const sums = Object.fromEntries(FEATURE_KEYS.map(key => [key, 0]));
  let trainedPairs = 0;

  for (const example of source) {
    const chosen = finiteFeatureVector(example?.chosenFeatures);
    const rejected = finiteFeatureVector(example?.rejectedFeatures);
    if (!chosen || !rejected) continue;
    trainedPairs += 1;
    for (const key of FEATURE_KEYS) sums[key] += chosen[key] - rejected[key];
  }

  const weights = {};
  for (const key of FEATURE_KEYS) {
    weights[key] = trainedPairs ? round(sums[key] / trainedPairs) : 0;
  }

  const norm = Math.sqrt(FEATURE_KEYS.reduce((total, key) => total + weights[key] ** 2, 0));
  if (norm > 0) {
    for (const key of FEATURE_KEYS) weights[key] = round(weights[key] / norm);
  }

  return {
    modelVersion: '0.63',
    modelType: 'linear-visual-pairwise-ranker',
    featureVersion: '0.61',
    trainedPairs,
    featureKeys: [...FEATURE_KEYS],
    weights
  };
}

export function scoreSceneImageVisualCandidate(model, visualFeatures) {
  const vector = finiteFeatureVector(visualFeatures);
  if (!vector || !model || typeof model !== 'object') return null;
  const weights = model.weights;
  if (!weights || typeof weights !== 'object') return null;

  let score = 0;
  for (const key of FEATURE_KEYS) {
    const weight = Number(weights[key]);
    if (!Number.isFinite(weight)) return null;
    score += weight * vector[key];
  }
  return round(score);
}

export function rankSceneImageVisualCandidates(model, candidates = []) {
  const source = Array.isArray(candidates) ? candidates : [];
  return source
    .map((candidate, index) => ({
      index,
      assetId: String(candidate?.assetId ?? ''),
      score: scoreSceneImageVisualCandidate(model, candidate?.visualFeatures)
    }))
    .filter(item => item.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
