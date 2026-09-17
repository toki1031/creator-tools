import { runSceneAssetPipeline } from './sceneAssetPipeline.js';
import { createRequestRateLimiter, withRateLimit } from './requestRateLimiter.js';

function clone(value) {
  if (value == null) return value;
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export async function runMultiSceneAssetPipeline(project, {
  searchCandidates,
  fetchImage,
  applyAsset,
  fetchOptions,
  runScene = runSceneAssetPipeline,
  waitForSearchSlot = createRequestRateLimiter(),
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
  const limitedSearch = typeof searchCandidates === 'function'
    ? withRateLimit(searchCandidates, waitForSearchSlot)
    : searchCandidates;

  for (const originalScene of scenes) {
    const scene = currentProject.scenes.find(item => item?.id === originalScene?.id) || originalScene;
    const result = await runScene(currentProject, scene, {
      searchCandidates: limitedSearch,
      fetchImage,
      applyAsset,
      fetchOptions
    });
    results.push({ sceneId: scene?.id || '', order: Number(scene?.order) || 0, status: result.status, stage: result.stage, reason: result.reason || '' });
    if (result.status === 'applied' && result.project) currentProject = result.project;
    else if (stopOnRisk) {
      return {
        status: result.status,
        project: currentProject,
        results,
        processedCount: results.length,
        stoppedSceneId: scene?.id || '',
        reason: result.reason || ''
      };
    }
  }

  return {
    status: results.every(result => result.status === 'applied') ? 'complete' : 'partial',
    project: currentProject,
    results,
    processedCount: results.length,
    stoppedSceneId: '',
    reason: ''
  };
}
