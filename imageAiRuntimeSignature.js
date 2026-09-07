function safeString(value) {
  return String(value ?? '').trim();
}

function assetFingerprint(asset) {
  const id = safeString(asset?.id);
  const type = safeString(asset?.type);
  const data = typeof asset?.data === 'string' ? asset.data : '';
  if (!id || type !== 'image' || !data.startsWith('data:image/')) return '';
  const prefix = data.slice(0, 64);
  const suffix = data.slice(-64);
  return `${id}:${data.length}:${prefix}:${suffix}`;
}

export function createImageFeatureSignature(projects = []) {
  const source = Array.isArray(projects) ? projects : [];
  return source
    .map(project => {
      const projectId = safeString(project?.id);
      const assets = Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [];
      const fingerprints = assets.map(assetFingerprint).filter(Boolean).sort();
      return `${projectId}[${fingerprints.join(',')}]`;
    })
    .sort()
    .join('|');
}

function alternativeAssetIds(record) {
  const alternatives = Array.isArray(record?.alternatives) ? record.alternatives : [];
  return alternatives
    .map(value => safeString(value?.assetId ?? value))
    .filter(Boolean)
    .sort();
}

export function createSceneImageLearningSignature(decisions = []) {
  const source = Array.isArray(decisions) ? decisions : [];
  return source
    .filter(record => record?.decisionType === 'scene-image-selection')
    .map(record => {
      const chosen = safeString(record?.finalDecision?.assetId || record?.finalDecision?.selectedAssetId);
      return [
        safeString(record?.decisionId),
        safeString(record?.projectId),
        safeString(record?.sceneId),
        chosen,
        alternativeAssetIds(record).join(',')
      ].join(':');
    })
    .sort()
    .join('|');
}

export function createImageAiRuntimeSignature(projects = [], decisions = []) {
  return `${createImageFeatureSignature(projects)}||${createSceneImageLearningSignature(decisions)}`;
}
