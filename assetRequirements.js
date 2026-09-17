const KNOWN_TYPES = new Set(['historical-source','ai-reconstruction','modern-visual','document','other']);

function clean(value = '') { return String(value ?? '').trim(); }
function cleanRules(value) { return Array.isArray(value) ? value.map(clean).filter(Boolean) : []; }

function sourceRequirement(type) {
  if (type === 'historical-source') return 'primary-source-preferred';
  if (type === 'ai-reconstruction') return 'generated-reconstruction';
  if (type === 'document') return 'public-domain-preferred';
  return 'general';
}

/**
 * Turns already-reviewed scene production directions into safe asset acquisition requirements.
 * Pure planning only: no network, download, generation, mediaLibrary mutation, or rights assumption.
 */
export function buildAssetRequirement(scene) {
  if (!scene || typeof scene !== 'object') return null;
  const direction = scene.productionDirection ?? {};
  const rawType = clean(direction.assetType);
  const requestedType = KNOWN_TYPES.has(rawType) ? rawType : 'other';
  const visualDirection = clean(direction.visualDirection);
  const purpose = clean(direction.purpose);
  const prohibitedContent = cleanRules(direction.rules);
  const queryHint = visualDirection || purpose;

  const ambiguousType = !rawType || requestedType === 'other';
  const missingIntent = !queryHint;
  const needsReview = ambiguousType || missingIntent;
  const reasons = [];
  if (ambiguousType) reasons.push('素材種別が明確ではありません');
  if (missingIntent) reasons.push('素材の検索意図がありません');

  return {
    sceneId: clean(scene.id),
    order: Number(scene.order) || 0,
    requestedType,
    queryHint,
    sourceRequirement: sourceRequirement(requestedType),
    rightsRequirement: requestedType === 'ai-reconstruction' ? 'commercial-use-safe' : 'verify-before-use',
    historicalAccuracyRequired: requestedType === 'historical-source' || requestedType === 'ai-reconstruction',
    generatedContentDisclosureRequired: requestedType === 'ai-reconstruction',
    prohibitedContent,
    status: needsReview ? 'needs-review' : 'planned',
    stopReason: reasons.join(' / ')
  };
}

export function buildAssetRequirements(scenes) {
  if (!Array.isArray(scenes)) return [];
  return scenes.map(buildAssetRequirement).filter(Boolean);
}
