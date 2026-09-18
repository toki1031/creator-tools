import { buildAssetRequirement } from './assetRequirements.js';
import { buildAssetSearchPlan } from './assetSearchPlan.js';
import { enrichAssetCandidates } from './assetCandidateEnrichment.js';
import { evaluateAssetCandidates } from './assetCandidateEvaluation.js';
import { buildAssetAdoptionPlan } from './assetAdoptionPlan.js';
import { fetchAssetImage } from './assetImageFetch.js';
import { applyAssetAdoptionPlan } from './assetAdoptionApply.js';

function stop(stage, status, reason, details = {}) {
  return { status, stage, reason: reason || '', project: null, ...details };
}

export async function runSceneAssetPipeline(project, scene, {
  searchCandidates,
  enrichCandidates = enrichAssetCandidates,
  enrichmentOptions = {},
  fetchImage = fetchAssetImage,
  applyAsset = applyAssetAdoptionPlan,
  fetchOptions = {}
} = {}) {
  const requirement = buildAssetRequirement(scene);
  if (!requirement) return stop('requirement', 'blocked', '素材要件を作成できません');
  if (requirement.status !== 'planned') return stop('requirement', requirement.status, requirement.stopReason, { requirement });

  const searchPlan = buildAssetSearchPlan(requirement);
  if (!searchPlan || searchPlan.status !== 'ready') return stop('search-plan', searchPlan?.status || 'blocked', searchPlan?.blockReason || '検索計画を作成できません', { requirement, searchPlan });
  if (typeof searchCandidates !== 'function') return stop('search', 'blocked', '素材検索アダプタがありません', { requirement, searchPlan });

  let searchResult;
  try { searchResult = await searchCandidates(searchPlan); }
  catch (error) { return stop('search', 'error', String(error?.message || '素材検索に失敗しました'), { requirement, searchPlan }); }
  if (searchResult?.status && searchResult.status !== 'ok') return stop('search', searchResult.status, searchResult.reason || searchResult.error || '素材検索を継続できません', { requirement, searchPlan, searchResult });

  const candidates = Array.isArray(searchResult) ? searchResult : (searchResult?.candidates || []);
  if (!candidates.length) return stop('search', 'blocked', '素材候補が見つかりません', { requirement, searchPlan, searchResult });

  let enrichedCandidates;
  try { enrichedCandidates = typeof enrichCandidates === 'function' ? await enrichCandidates(candidates, enrichmentOptions) : candidates; }
  catch (error) { return stop('enrichment', 'error', String(error?.message || '素材の権利情報を確認できません'), { requirement, searchPlan, candidates }); }

  const evaluatedCandidates = evaluateAssetCandidates(enrichedCandidates, requirement, searchPlan);
  const adoptionPlan = buildAssetAdoptionPlan(scene, evaluatedCandidates);
  if (adoptionPlan.status !== 'ready') return stop('adoption', adoptionPlan.status, adoptionPlan.reason, { requirement, searchPlan, enrichedCandidates, evaluatedCandidates, adoptionPlan });
  if (adoptionPlan.autoApply !== true) return stop('adoption', 'needs-review', '素材の自動採用条件を満たしていません', { requirement, searchPlan, enrichedCandidates, evaluatedCandidates, adoptionPlan });

  const fetchResult = await fetchImage(adoptionPlan, fetchOptions);
  if (fetchResult?.status !== 'resolved' || !fetchResult.asset) return stop('fetch', fetchResult?.status || 'error', fetchResult?.reason || '画像を取得できません', { requirement, searchPlan, enrichedCandidates, evaluatedCandidates, adoptionPlan, fetchResult });

  const applied = applyAsset(project, adoptionPlan, fetchResult.asset, { allowApply: true });
  if (!applied?.applied) return stop('apply', 'blocked', applied?.reason || '素材を適用できません', { requirement, searchPlan, enrichedCandidates, evaluatedCandidates, adoptionPlan, fetchResult, applyResult: applied });

  return { status: 'applied', stage: 'complete', reason: '', project: applied.project, assetId: applied.assetId, requirement, searchPlan, enrichedCandidates, evaluatedCandidates, adoptionPlan, fetchResult, applyResult: applied };
}
