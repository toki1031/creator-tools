import { buildAssetRequirement } from './assetRequirements.js';
import { buildAssetSearchPlan } from './assetSearchPlan.js';
import { evaluateAssetCandidates } from './assetCandidateEvaluation.js';
import { buildAssetAdoptionPlan } from './assetAdoptionPlan.js';
import { fetchAssetImage } from './assetImageFetch.js';
import { applyAssetAdoptionPlan } from './assetAdoptionApply.js';

function stop(stage, status, reason, details = {}) {
  return { status, stage, reason: reason || '', project: null, ...details };
}

/**
 * Connects the existing Phase 2 safety stages for exactly one Scene.
 * Search is injected deliberately: provider/rate-limit policy remains outside this orchestrator.
 * Project mutation is isolated to the final apply helper and only after every gate succeeds.
 */
export async function runSceneAssetPipeline(project, scene, {
  searchCandidates,
  fetchImage = fetchAssetImage,
  applyAsset = applyAssetAdoptionPlan,
  fetchOptions = {}
} = {}) {
  const requirement = buildAssetRequirement(scene);
  if (!requirement) return stop('requirement', 'blocked', '素材要件を作成できません');
  if (requirement.status !== 'planned') {
    return stop('requirement', requirement.status, requirement.stopReason, { requirement });
  }

  const searchPlan = buildAssetSearchPlan(requirement);
  if (!searchPlan || searchPlan.status !== 'ready') {
    return stop('search-plan', searchPlan?.status || 'blocked', searchPlan?.blockReason || '検索計画を作成できません', { requirement, searchPlan });
  }
  if (typeof searchCandidates !== 'function') {
    return stop('search', 'blocked', '素材検索アダプタがありません', { requirement, searchPlan });
  }

  let searchResult;
  try {
    searchResult = await searchCandidates(searchPlan);
  } catch (error) {
    return stop('search', 'error', String(error?.message || '素材検索に失敗しました'), { requirement, searchPlan });
  }
  if (searchResult?.status && searchResult.status !== 'ok') {
    return stop('search', searchResult.status, searchResult.reason || searchResult.error || '素材検索を継続できません', { requirement, searchPlan, searchResult });
  }
  const candidates = Array.isArray(searchResult) ? searchResult : (searchResult?.candidates || []);
  if (!candidates.length) {
    return stop('search', 'blocked', '素材候補が見つかりません', { requirement, searchPlan, searchResult });
  }

  const evaluatedCandidates = evaluateAssetCandidates(candidates, requirement, searchPlan);
  const adoptionPlan = buildAssetAdoptionPlan(scene, evaluatedCandidates);
  if (adoptionPlan.status !== 'ready') {
    return stop('adoption', adoptionPlan.status, adoptionPlan.reason, { requirement, searchPlan, evaluatedCandidates, adoptionPlan });
  }

  const fetchResult = await fetchImage(adoptionPlan, fetchOptions);
  if (fetchResult?.status !== 'resolved' || !fetchResult.asset) {
    return stop('fetch', fetchResult?.status || 'error', fetchResult?.reason || '画像を取得できません', { requirement, searchPlan, evaluatedCandidates, adoptionPlan, fetchResult });
  }

  const applied = applyAsset(project, adoptionPlan, fetchResult.asset, { allowApply: true });
  if (!applied?.applied) {
    return stop('apply', 'blocked', applied?.reason || '素材を適用できません', { requirement, searchPlan, evaluatedCandidates, adoptionPlan, fetchResult, applyResult: applied });
  }

  return {
    status: 'applied',
    stage: 'complete',
    reason: '',
    project: applied.project,
    assetId: applied.assetId,
    requirement,
    searchPlan,
    evaluatedCandidates,
    adoptionPlan,
    fetchResult,
    applyResult: applied
  };
}
