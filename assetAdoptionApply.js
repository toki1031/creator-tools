function clean(value = '') {
  return String(value ?? '').trim();
}

function clone(value) {
  if (value == null) return value;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function uniqueAssetId(project, preferred) {
  const used = new Set((project.mediaLibrary || []).map(asset => clean(asset?.id)).filter(Boolean));
  const base = clean(preferred) || `asset-${Date.now()}`;
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function applyAssetAdoptionPlan(project, plan, resolvedAsset, { allowApply = false } = {}) {
  const next = clone(project);
  if (!next || typeof next !== 'object') return { project: next, applied: false, reason: 'プロジェクトがありません' };
  if (!allowApply) return { project: next, applied: false, reason: '素材適用が明示的に許可されていません' };
  if (plan?.status !== 'ready') return { project: next, applied: false, reason: '採用プランがreadyではありません' };

  const sceneId = clean(plan.sceneId);
  const sceneIndex = Array.isArray(next.scenes) ? next.scenes.findIndex(scene => clean(scene?.id) === sceneId) : -1;
  if (sceneIndex < 0) return { project: next, applied: false, reason: '対象Sceneが見つかりません' };
  if (clean(next.scenes[sceneIndex]?.imageAssetId)) {
    return { project: next, applied: false, reason: '既存のScene画像を保護するため上書きしません' };
  }

  const data = clean(resolvedAsset?.data);
  const previewUrl = clean(resolvedAsset?.previewUrl || plan?.candidate?.previewUrl);
  if (!data && !previewUrl) return { project: next, applied: false, reason: '利用可能な画像データがありません' };

  if (!Array.isArray(next.mediaLibrary)) next.mediaLibrary = [];
  const assetId = uniqueAssetId(next, resolvedAsset?.id || `auto-${sceneId}`);
  const candidate = plan?.candidate || {};
  const asset = {
    id: assetId,
    type: 'image',
    name: clean(resolvedAsset?.name || candidate.title || `Scene ${sceneId} image`),
    data,
    previewUrl,
    source: {
      provider: clean(candidate.provider),
      pageUrl: clean(candidate.sourcePage),
      rights: clean(candidate.rights),
      rightsAdvisory: clean(candidate.rightsAdvisory),
      rightsUrl: clean(candidate.rightsUrl),
      license: clean(candidate.license),
      licenseUrl: clean(candidate.licenseUrl)
    },
    origin: 'auto-production'
  };

  next.mediaLibrary.push(asset);
  next.scenes[sceneIndex] = { ...next.scenes[sceneIndex], imageAssetId: assetId };
  next.updatedAt = new Date().toISOString();
  return { project: next, applied: true, assetId, reason: '' };
}
