import { runSceneAssetPipeline } from './sceneAssetPipeline.js';
import { createRequestRateLimiter, withRateLimit } from './requestRateLimiter.js';
import { searchLocCandidates } from './locAssetSearch.js';
import { buildAssetRequirement } from './assetRequirements.js';

function clone(value) {
  if (value == null) return value;
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export async function runMultiSceneAssetPipeline(project, {
  searchCandidates = searchLocCandidates,
  fetchImage,
  applyAsset,
  fetchOptions,
  runScene = runSceneAssetPipeline,
  waitForSearchSlot = createRequestRateLimiter(),
  waitForExternalSlot = waitForSearchSlot,
  stopOnRisk = true
} = {}) {
  let currentProject = clone(project);
  if (!currentProject || typeof currentProject !== 'object') {
    return { status: 'blocked', project: currentProject, results: [], processedCount: 0, reason: 'プロジェクトがありません' };
  }
  const scenes = Array.isArray(currentProject.scenes)
    ? [...currentProject.scenes].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    : [];
  const results = [];
  const LOC_SUPPORTED_TYPES = new Set(['historical-source', 'document']);
  let skippedCount = 0;
  let eligibleCount = 0;
  const limitedSearch = typeof searchCandidates === 'function'
    ? withRateLimit(searchCandidates, waitForSearchSlot)
    : searchCandidates;

  for (const originalScene of scenes) {
    const scene = currentProject.scenes.find(item => item?.id === originalScene?.id) || originalScene;
    const requirement = buildAssetRequirement(scene);
    if (!LOC_SUPPORTED_TYPES.has(requirement?.requestedType)) {
      skippedCount += 1;
      results.push({ sceneId: scene?.id || '', order: Number(scene?.order) || 0, status: 'skipped', stage: 'provider-scope', reason: 'Library of Congress試作の対象外素材です' });
      continue;
    }
    eligibleCount += 1;
    const result = await runScene(currentProject, scene, {
      searchCandidates: limitedSearch,
      fetchImage,
      applyAsset,
      fetchOptions,
      enrichmentOptions: { waitForExternalSlot }
    });
    results.push({ sceneId: scene?.id || '', order: Number(scene?.order) || 0, status: result.status, stage: result.stage, reason: result.reason || '' });
    if (result.status === 'applied' && result.project) currentProject = result.project;
    else if (stopOnRisk) {
      return {
        status: result.status,
        project: currentProject,
        results,
        processedCount: results.length,
        eligibleCount,
        skippedCount,
        stoppedSceneId: scene?.id || '',
        reason: result.reason || ''
      };
    }
  }

  return {
    status: eligibleCount === 0 ? 'no-eligible-scenes' : results.filter(result => result.status !== 'skipped').every(result => result.status === 'applied') ? 'complete' : 'partial',
    project: currentProject,
    results,
    processedCount: results.length,
    eligibleCount,
    skippedCount,
    stoppedSceneId: '',
    reason: ''
  };
}
