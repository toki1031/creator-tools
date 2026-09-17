function clean(value = '') { return String(value ?? '').trim(); }
function list(value) { return Array.isArray(value) ? value.map(clean).filter(Boolean) : []; }

const TYPE_POLICIES = {
  'historical-source': {
    preferredSources: ['official-archive', 'library', 'museum', 'government'],
    rightsChecks: ['verify-source-page', 'verify-license-or-public-domain', 'record-attribution'],
    acceptanceChecks: ['matches-requested-historical-source', 'not-ai-generated', 'historical-context-verifiable'],
    allowGeneratedFallback: false
  },
  document: {
    preferredSources: ['official-archive', 'library', 'museum'],
    rightsChecks: ['verify-source-page', 'verify-license-or-public-domain', 'record-attribution'],
    acceptanceChecks: ['document-identity-verifiable', 'not-presented-beyond-source-evidence'],
    allowGeneratedFallback: false
  },
  'ai-reconstruction': {
    preferredSources: ['generated-reconstruction'],
    rightsChecks: ['commercial-use-safe-generation'],
    acceptanceChecks: ['historical-constraints-respected', 'not-presented-as-archival-material', 'generated-content-disclosed'],
    allowGeneratedFallback: true
  },
  'modern-visual': {
    preferredSources: ['commercial-use-safe-stock', 'generated-modern-visual'],
    rightsChecks: ['commercial-use-rights-verified', 'record-source-or-generation'],
    acceptanceChecks: ['matches-modern-visual-intent', 'does-not-add-unsupported-historical-claims'],
    allowGeneratedFallback: true
  }
};

const BLOCKED_POLICY = {
  preferredSources: [], rightsChecks: [], acceptanceChecks: [], allowGeneratedFallback: false
};

/** Pure planning only. It never searches, downloads, generates, or mutates media. */
export function buildAssetSearchPlan(requirement) {
  if (!requirement || typeof requirement !== 'object') return null;
  const queryHint = clean(requirement.queryHint);
  const requestedType = clean(requirement.requestedType) || 'other';
  const upstreamBlocked = requirement.status === 'needs-review';
  const unsupportedType = !TYPE_POLICIES[requestedType];
  const missingQuery = !queryHint;
  const blocked = upstreamBlocked || unsupportedType || missingQuery;
  const policy = blocked ? BLOCKED_POLICY : TYPE_POLICIES[requestedType];
  const reasons = [];
  if (upstreamBlocked) reasons.push(clean(requirement.stopReason) || '素材要件の確認が必要です');
  if (unsupportedType) reasons.push('検索方針を安全に決定できない素材種別です');
  if (missingQuery) reasons.push('検索意図がありません');

  return {
    sceneId: clean(requirement.sceneId),
    order: Number(requirement.order) || 0,
    requestedType,
    queries: queryHint ? [queryHint] : [],
    preferredSources: [...policy.preferredSources],
    rightsChecks: [...policy.rightsChecks],
    acceptanceChecks: [...policy.acceptanceChecks],
    prohibitedContent: list(requirement.prohibitedContent),
    allowGeneratedFallback: policy.allowGeneratedFallback,
    status: blocked ? 'blocked' : 'ready',
    blockReason: reasons.filter(Boolean).join(' / ')
  };
}

export function buildAssetSearchPlans(requirements) {
  if (!Array.isArray(requirements)) return [];
  return requirements.map(buildAssetSearchPlan).filter(Boolean);
}
