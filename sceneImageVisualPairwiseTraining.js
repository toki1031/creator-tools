import { createSceneImagePairwiseTrainingSet } from './sceneImagePairwiseTraining.js';

const FEATURE_KEYS = [
  'aspectRatio',
  'aspectBalance',
  'brightness',
  'contrast',
  'saturation',
  'edgeDensity'
];

function safeString(value) {
  const text = String(value ?? '').trim();
  return /^(?:data|blob):/i.test(text) ? '' : text;
}

function directFeatureFor(featureMap, assetId) {
  if (!assetId || !featureMap) return null;
  if (featureMap instanceof Map) return featureMap.get(assetId) ?? null;
  if (typeof featureMap === 'object') return featureMap[assetId] ?? null;
  return null;
}

function featureFor(featureMap, projectId, assetId) {
  if (!featureMap || !assetId) return null;
  if (featureMap?.projectsById && typeof featureMap.projectsById === 'object') {
    const scoped = featureMap.projectsById[projectId];
    return directFeatureFor(scoped, assetId);
  }
  return directFeatureFor(featureMap, assetId);
}

function normalizeVisualFeatures(value) {
  if (!value || typeof value !== 'object') return null;
  const normalized = { visualFeatureVersion: safeString(value.visualFeatureVersion) || '0.61' };
  for (const key of FEATURE_KEYS) {
    const number = Number(value[key]);
    if (!Number.isFinite(number)) return null;
    normalized[key] = number;
  }
  return normalized;
}

export function createSceneImageVisualPairwiseTrainingSet(decisions = [], featureMap = {}) {
  const base = createSceneImagePairwiseTrainingSet(decisions);
  const examples = [];
  let missingChosenFeatures = 0;
  let missingRejectedFeatures = 0;

  for (const example of base.examples) {
    const projectId = safeString(example.projectId);
    const chosenFeatures = normalizeVisualFeatures(featureFor(featureMap, projectId, example.chosenAssetId));
    if (!chosenFeatures) {
      missingChosenFeatures += 1;
      continue;
    }
    const rejectedFeatures = normalizeVisualFeatures(featureFor(featureMap, projectId, example.rejectedAssetId));
    if (!rejectedFeatures) {
      missingRejectedFeatures += 1;
      continue;
    }

    examples.push({
      decisionId: safeString(example.decisionId),
      projectId,
      sceneId: safeString(example.sceneId),
      context: { ...example.context },
      chosenAssetId: safeString(example.chosenAssetId),
      rejectedAssetId: safeString(example.rejectedAssetId),
      chosenFeatures,
      rejectedFeatures
    });
  }

  return {
    trainingSetVersion: '0.62',
    decisionType: 'scene-image-selection',
    featureVersion: '0.61',
    featureScopeVersion: featureMap?.projectsById ? '0.66' : 'flat-legacy',
    summary: {
      inputDecisions: base.summary.inputDecisions,
      pairwiseCandidates: base.examples.length,
      examples: examples.length,
      missingChosenFeatures,
      missingRejectedFeatures
    },
    examples
  };
}
