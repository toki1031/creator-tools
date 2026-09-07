function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function clampRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return 0.2;
  return Math.min(0.9, Math.max(0, ratio));
}

export function splitPairwiseExamplesByProject(examples = [], options = {}) {
  const source = Array.isArray(examples) ? examples : [];
  const validationRatio = clampRatio(options.validationRatio ?? 0.2);
  const seed = String(options.seed || 'creator-os-v0.36');
  const threshold = Math.floor(validationRatio * 10000);
  const train = [];
  const validation = [];
  const projectSplits = {};

  for (const example of source) {
    const projectId = String(example?.projectId || '').trim();
    if (!projectId) continue;
    if (!projectSplits[projectId]) {
      const bucket = hashString(`${seed}:${projectId}`) % 10000;
      projectSplits[projectId] = bucket < threshold ? 'validation' : 'train';
    }
    if (projectSplits[projectId] === 'validation') validation.push(example);
    else train.push(example);
  }

  return {
    splitVersion: '0.36',
    seed,
    validationRatio,
    summary: {
      inputExamples: source.length,
      acceptedExamples: train.length + validation.length,
      trainExamples: train.length,
      validationExamples: validation.length,
      projects: Object.keys(projectSplits).length,
      trainProjects: Object.values(projectSplits).filter(value => value === 'train').length,
      validationProjects: Object.values(projectSplits).filter(value => value === 'validation').length
    },
    projectSplits,
    train,
    validation
  };
}

export function splitSceneImageTrainingSet(trainingSet, options = {}) {
  const examples = Array.isArray(trainingSet?.examples) ? trainingSet.examples : [];
  return splitPairwiseExamplesByProject(examples, options);
}
