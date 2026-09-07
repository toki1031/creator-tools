const LABELS = ['fade', 'cut'];
const LABEL_SET = new Set(LABELS);

function cleanText(value) {
  return typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, '') : '';
}

function bucketDuration(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'unknown';
  if (n < 3) return 'short';
  if (n < 7) return 'medium';
  return 'long';
}

function bucketIndex(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 'unknown';
  if (n <= 1) return 'early';
  if (n <= 4) return 'middle';
  return 'late';
}

export function sceneTransitionFeatures(context = {}) {
  const features = [];
  const text = cleanText(context?.sceneText).slice(0, 240);
  const chars = Array.from(text);
  for (const ch of chars) features.push(`u:${ch}`);
  for (let i = 0; i < chars.length - 1; i += 1) features.push(`b:${chars[i]}${chars[i + 1]}`);

  const platform = cleanText(context?.platform) || 'unknown';
  const aspectRatio = cleanText(context?.aspectRatio) || 'unknown';
  features.push(`platform:${platform}`);
  features.push(`aspect:${aspectRatio}`);
  features.push(`duration:${bucketDuration(context?.durationSec)}`);
  features.push(`scene-index:${bucketIndex(context?.sceneIndex)}`);
  return features;
}

export function trainSceneTransitionModel(examples = [], { alpha = 1 } = {}) {
  const smoothing = Number.isFinite(Number(alpha)) && Number(alpha) > 0 ? Number(alpha) : 1;
  const classDocCounts = Object.fromEntries(LABELS.map(label => [label, 0]));
  const classTokenTotals = Object.fromEntries(LABELS.map(label => [label, 0]));
  const tokenCounts = Object.fromEntries(LABELS.map(label => [label, {}]));
  const vocabulary = new Set();
  let totalExamples = 0;

  for (const example of Array.isArray(examples) ? examples : []) {
    const label = typeof example?.label === 'string' ? example.label.trim() : '';
    if (!LABEL_SET.has(label)) continue;
    const tokens = sceneTransitionFeatures(example?.context);
    classDocCounts[label] += 1;
    totalExamples += 1;
    for (const token of tokens) {
      vocabulary.add(token);
      tokenCounts[label][token] = (tokenCounts[label][token] || 0) + 1;
      classTokenTotals[label] += 1;
    }
  }

  return {
    modelVersion: '0.42',
    modelType: 'multinomial-naive-bayes',
    labels: [...LABELS],
    alpha: smoothing,
    totalExamples,
    classDocCounts,
    classTokenTotals,
    tokenCounts,
    vocabulary: [...vocabulary].sort()
  };
}

export function predictSceneTransition(model, context = {}) {
  const labels = Array.isArray(model?.labels) && model.labels.length ? model.labels.filter(label => LABEL_SET.has(label)) : [...LABELS];
  const alpha = Number.isFinite(Number(model?.alpha)) && Number(model.alpha) > 0 ? Number(model.alpha) : 1;
  const totalExamples = Number.isFinite(Number(model?.totalExamples)) ? Number(model.totalExamples) : 0;
  const vocabulary = Array.isArray(model?.vocabulary) ? model.vocabulary : [];
  const vocabSize = Math.max(1, vocabulary.length + 1);
  const features = sceneTransitionFeatures(context);
  const scores = [];

  for (const label of labels) {
    const docCount = Number(model?.classDocCounts?.[label]) || 0;
    const tokenTotal = Number(model?.classTokenTotals?.[label]) || 0;
    const counts = model?.tokenCounts?.[label] && typeof model.tokenCounts[label] === 'object' ? model.tokenCounts[label] : {};
    let score = Math.log((docCount + 1) / (totalExamples + labels.length));
    const denominator = tokenTotal + alpha * vocabSize;
    for (const token of features) {
      const count = Number(counts[token]) || 0;
      score += Math.log((count + alpha) / denominator);
    }
    scores.push({ label, score });
  }

  scores.sort((a, b) => b.score - a.score || labels.indexOf(a.label) - labels.indexOf(b.label));
  return { label: scores[0]?.label || 'fade', scores };
}
