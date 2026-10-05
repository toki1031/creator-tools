import { runSceneAssetPipeline } from './sceneAssetPipeline.js';
import { createRequestRateLimiter, withRateLimit } from './requestRateLimiter.js';
import { searchArchiveCandidates } from './archiveAssetSearch.js';
import { buildAssetRequirement } from './assetRequirements.js';
import { requestFreeGeneratedImage } from './freeImageGenerationProvider.js';
import { storeAndApplyAutoImage } from './autoImageMediaStorage.js';
import { normalizeLegacyAutoProductionProject } from './autoProductionCompatibility.js';

function clone(value) {
  if (value == null) return value;
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export async function runMultiSceneAssetPipeline(project, {
  searchCandidates = searchArchiveCandidates,
  fetchImage,
  applyAsset,
  fetchOptions,
  runScene = runSceneAssetPipeline,
  waitForSearchSlot = createRequestRateLimiter(),
  waitForExternalSlot = waitForSearchSlot,
  stopOnRisk = true,
  generateImage = requestFreeGeneratedImage,
  storeGeneratedImage = storeAndApplyAutoImage
} = {}) {
  let currentProject = clone(project);
  if (!currentProject || typeof currentProject !== 'object') {
    return { status: 'blocked', project: currentProject, results: [], processedCount: 0, reason: 'プロジェクトがありません' };
  }
  currentProject = normalizeLegacyAutoProductionProject(currentProject).project;
  const scenes = Array.isArray(currentProject.scenes)
    ? [...currentProject.scenes].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    : [];
  const results = [];
  const autoProductionEnabled = currentProject.autoProduction?.mode === 'production-request';
  const ARCHIVE_SUPPORTED_TYPES = new Set(['historical-source', 'document']);
  let skippedCount = 0;
  let eligibleCount = 0;
  const limitedSearch = typeof searchCandidates === 'function'
    ? withRateLimit(searchCandidates, waitForSearchSlot)
    : searchCandidates;

  for (const originalScene of scenes) {
    const scene = currentProject.scenes.find(item => item?.id === originalScene?.id) || originalScene;
    const requirement = buildAssetRequirement(scene);
    if (!ARCHIVE_SUPPORTED_TYPES.has(requirement?.requestedType)) {
      if (autoProductionEnabled && (requirement?.requestedType === 'ai-reconstruction' || requirement?.requestedType === 'modern-visual')) {
        eligibleCount += 1;
        const generated = await generateImage(requirement);
        if (generated?.status === 'resolved' && generated.asset) {
          const plan = { status:'ready', sceneId:scene?.id || '', order:Number(scene?.order)||0, candidate:{ title:`Scene ${Number(scene?.order)||0} generated image`, provider:'cloudflare-workers-ai' } };
          const applied = await storeGeneratedImage(currentProject, plan, generated.asset);
          results.push({ sceneId:scene?.id || '', order:Number(scene?.order)||0, status:applied.status, stage:'generated-image', reason:applied.reason || '' });
          if (applied.status === 'applied' && applied.project) { currentProject = applied.project; continue; }
          if (stopOnRisk) return { status:applied.status, project:currentProject, results, processedCount:results.length, eligibleCount, skippedCount, stoppedSceneId:scene?.id || '', reason:applied.reason || '' };
          continue;
        }
        results.push({ sceneId:scene?.id || '', order:Number(scene?.order)||0, status:generated?.status || 'error', stage:'generated-image', reason:generated?.reason || '無料画像生成に失敗しました' });
        if (stopOnRisk) return { status:generated?.status || 'error', project:currentProject, results, processedCount:results.length, eligibleCount, skippedCount, stoppedSceneId:scene?.id || '', reason:generated?.reason || '無料画像生成に失敗しました' };
        continue;
      }
      skippedCount += 1;
      results.push({ sceneId: scene?.id || '', order: Number(scene?.order) || 0, status: 'skipped', stage: 'provider-scope', reason: '対応する自動素材プロバイダーがありません' });
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
    results.push({ sceneId: scene?.id || '', order: Number(scene?.order) || 0, status: result.status, stage: result.stage, reason: result.reason || '', candidates: Array.isArray(result.candidates) ? result.candidates : [] });
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
        reason: result.reason || '',
        candidates: Array.isArray(result.candidates) ? result.candidates : []
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
