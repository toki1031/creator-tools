import { buildImageVisualFeatureMap } from './imageVisualFeatureMap.js';

function projectIdOf(project) {
  return typeof project?.id === 'string' ? project.id.trim() : '';
}

export async function buildProjectImageVisualFeatureIndex(projects = [], decodeImageData, options = {}) {
  const source = Array.isArray(projects) ? projects : [];
  const projectsById = {};
  const seenProjectIds = new Set();
  let eligibleProjects = 0;
  let processedProjects = 0;
  let skippedProjects = 0;
  let processedAssets = 0;
  let failedAssets = 0;

  for (const project of source) {
    const projectId = projectIdOf(project);
    if (!projectId || seenProjectIds.has(projectId)) {
      skippedProjects += 1;
      continue;
    }
    seenProjectIds.add(projectId);
    eligibleProjects += 1;

    const featureMap = await buildImageVisualFeatureMap(project?.mediaLibrary, decodeImageData, options);
    projectsById[projectId] = featureMap.featuresByAssetId;
    processedProjects += 1;
    processedAssets += featureMap.summary.processedAssets;
    failedAssets += featureMap.summary.failedAssets;
  }

  return {
    featureIndexVersion: '0.66',
    summary: {
      inputProjects: source.length,
      eligibleProjects,
      processedProjects,
      skippedProjects,
      processedAssets,
      failedAssets
    },
    projectsById
  };
}

export function resolveProjectImageVisualFeatures(featureIndex, projectId, assetId) {
  const pid = String(projectId ?? '').trim();
  const aid = String(assetId ?? '').trim();
  if (!pid || !aid) return null;
  const scoped = featureIndex?.projectsById?.[pid];
  if (!scoped || typeof scoped !== 'object') return null;
  return scoped[aid] ?? null;
}
