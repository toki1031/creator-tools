import { evaluateAutoAdoptionRights } from './assetAutoAdoptionPolicy.js';

function clean(value = '') {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function includesGeneratedMarker(candidate) {
  if (candidate?.generated === true) return true;
  const haystack = [candidate?.sourceType, candidate?.provider, candidate?.title]
    .map(clean)
    .join(' ')
    .toLowerCase();
  return /\b(ai[- ]?generated|generated[- ]?reconstruction|generated[- ]?visual)\b/.test(haystack);
}

function hasRightsEvidence(candidate) {
  return Boolean(
    list(candidate?.rightsStatements).length ||
    clean(candidate?.rights) ||
    clean(candidate?.rightsAdvisory) ||
    clean(candidate?.rightsUrl) ||
    clean(candidate?.license) ||
    clean(candidate?.licenseUrl)
  );
}

export function evaluateAssetCandidate(candidate, requirement, searchPlan) {
  const reasons = [];
  const requestedType = clean(requirement?.requestedType || searchPlan?.requestedType || 'other');
  const upstreamBlocked = searchPlan?.status === 'blocked' || requirement?.status === 'needs-review';
  const generated = includesGeneratedMarker(candidate);
  const sourcePage = clean(candidate?.sourceUrl || candidate?.sourcePage || candidate?.pageUrl);
  const previewUrl = clean(candidate?.previewUrl || candidate?.imageUrl || candidate?.thumbnailUrl);
  const prohibitedContent = [
    ...list(requirement?.prohibitedContent),
    ...list(searchPlan?.prohibitedContent)
  ];

  if (!candidate || typeof candidate !== 'object') {
    return { status: 'rejected', autoAdoptable: false, reasons: ['素材候補がありません'] };
  }

  if (upstreamBlocked) reasons.push('上流の素材要件または検索計画がblockedです');
  if (!sourcePage) reasons.push('出典ページを確認できません');
  if (!previewUrl) reasons.push('画像プレビューを確認できません');

  const historicalOnly = requestedType === 'historical-source' || requestedType === 'document';
  if (historicalOnly && generated) reasons.push('実物史料の要求に生成素材を使用できません');

  const explicitMismatch = clean(candidate.requestedType) && clean(candidate.requestedType) !== requestedType;
  if (explicitMismatch) reasons.push('Sceneの素材種別と候補の素材種別が一致しません');

  const hardReject = upstreamBlocked || (historicalOnly && generated) || explicitMismatch;
  if (hardReject) {
    return {
      status: 'rejected',
      autoAdoptable: false,
      requestedType,
      generated,
      prohibitedContent,
      reasons
    };
  }

  const rightsKnown = hasRightsEvidence(candidate);
  const rightsStatus = clean(candidate.rightsStatus);
  if (!rightsKnown || rightsStatus === 'needs-review' || rightsStatus === 'unknown') {
    if (!rightsKnown) reasons.push('権利情報を確認できません');
    else reasons.push('権利情報の追加確認が必要です');
  }
  if (!sourcePage || !previewUrl) {
    return {
      status: 'needs-review',
      autoAdoptable: false,
      requestedType,
      generated,
      prohibitedContent,
      reasons
    };
  }

  // Rights evidence means only that review material exists. It is not permission.
  const status = (!rightsKnown || rightsStatus === 'needs-review' || rightsStatus === 'unknown')
    ? 'needs-review'
    : 'eligible';

  const autoAdoption = status === 'eligible' ? evaluateAutoAdoptionRights(candidate) : { allowed: false, policy: 'review-required', reason: '権利確認が必要です' };

  return {
    status,
    autoAdoptable: autoAdoption.allowed,
    autoAdoptionPolicy: autoAdoption.policy,
    requestedType,
    generated,
    prohibitedContent,
    reasons
  };
}

export function evaluateAssetCandidates(candidates, requirement, searchPlan) {
  if (!Array.isArray(candidates)) return [];
  return candidates.map((candidate) => ({
    candidate,
    evaluation: evaluateAssetCandidate(candidate, requirement, searchPlan)
  }));
}
