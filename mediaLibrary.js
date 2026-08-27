const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const stringOr = (value, fallback = '') => typeof value === 'string' ? value : fallback;

export function isImageDataUrl(value) {
  return typeof value === 'string' && value.toLowerCase().startsWith('data:image/') && value.includes(',');
}

function createUniqueAssetId(usedIds, createId) {
  let id = '';
  let attempts = 0;
  do {
    id = String(createId?.() || globalThis.crypto?.randomUUID?.() || `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    if (!id.startsWith('asset-')) id = `asset-${id}`;
    attempts += 1;
    if (attempts > 20 && usedIds.has(id)) id = `asset-${Date.now()}-${attempts}-${Math.random().toString(16).slice(2)}`;
  } while (usedIds.has(id));
  return id;
}

export function ensureMediaLibrary(project) {
  if (!project || typeof project !== 'object') throw new Error('プロジェクトがありません。');
  if (!Array.isArray(project.mediaLibrary)) project.mediaLibrary = [];
  return project.mediaLibrary;
}

export function normalizeMediaLibrary(value, { createId, now = () => new Date().toISOString() } = {}) {
  const warnings = [];
  const fixes = [];
  const assets = [];
  const usedIds = new Set();
  const items = Array.isArray(value) ? value : [];
  if (value != null && !Array.isArray(value)) fixes.push('画像素材ライブラリを空の状態で補完');

  items.forEach((item, index) => {
    if (!isRecord(item) || item.type !== 'image' || !isImageDataUrl(item.data)) {
      warnings.push(`画像素材${index + 1}を無効なデータとして除外しました。`);
      return;
    }
    let id = stringOr(item.id).trim();
    if (!id || usedIds.has(id)) {
      id = createUniqueAssetId(usedIds, createId);
      fixes.push(`画像素材${index + 1}のIDを再発行`);
    }
    usedIds.add(id);
    const createdAt = stringOr(item.createdAt, now());
    assets.push({
      id,
      type:'image',
      data:item.data,
      fileName:stringOr(item.fileName),
      createdAt,
      updatedAt:stringOr(item.updatedAt, createdAt)
    });
  });

  return { assets, warnings, fixes };
}

export function findMediaAsset(project, assetId) {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  if (!id) return null;
  const library = Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [];
  const asset = library.find(item => item?.id === id && item?.type === 'image' && isImageDataUrl(item?.data));
  return asset || null;
}

export function resolveSceneImageSource(project, scene) {
  const asset = findMediaAsset(project, scene?.imageAssetId);
  if (asset) return { data:asset.data, assetId:asset.id, source:'library' };
  if (isImageDataUrl(scene?.imageData)) return { data:scene.imageData, assetId:'', source:'legacy' };
  return { data:'', assetId:'', source:'none' };
}

export function addImageAsset(project, { data, fileName = '', createId, now = () => new Date().toISOString() } = {}) {
  if (!isImageDataUrl(data)) throw new Error('画像素材として使用できないデータです。');
  const library = ensureMediaLibrary(project);
  const existing = library.find(item => item?.type === 'image' && item?.data === data && isImageDataUrl(item.data));
  if (existing) return existing;
  const usedIds = new Set(library.map(item => item?.id).filter(Boolean));
  const timestamp = now();
  const asset = {
    id:createUniqueAssetId(usedIds, createId),
    type:'image',
    data,
    fileName:stringOr(fileName),
    createdAt:timestamp,
    updatedAt:timestamp
  };
  library.push(asset);
  return asset;
}

export function promoteLegacySceneImage(project, scene, { fileName = '旧シーン画像', createId, now } = {}) {
  if (!scene || !isImageDataUrl(scene.imageData)) return null;
  const asset = addImageAsset(project, { data:scene.imageData, fileName, createId, now });
  scene.imageAssetId = asset.id;
  delete scene.imageData;
  return asset;
}

export function assetUsageScenes(project, assetId) {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  if (!id) return [];
  return (Array.isArray(project?.scenes) ? project.scenes : []).flatMap((scene, index) =>
    scene?.imageAssetId === id ? [{ id:stringOr(scene.id), index, number:index + 1 }] : []
  );
}

export function assetUsageCount(project, assetId) {
  return assetUsageScenes(project, assetId).length;
}

export function estimateAssetBytes(asset) {
  const data = asset?.data;
  if (!isImageDataUrl(data)) return 0;
  const comma = data.indexOf(',');
  if (comma < 0) return 0;
  const header = data.slice(0, comma).toLowerCase();
  const body = data.slice(comma + 1);
  if (header.includes(';base64')) {
    const padding = (body.match(/=*$/)?.[0] || '').length;
    return Math.max(0, Math.floor(body.length * 3 / 4) - padding);
  }
  try { return new TextEncoder().encode(decodeURIComponent(body)).length; }
  catch { return body.length; }
}

export function summarizeMediaLibrary(project) {
  const library = ensureMediaLibrary(project).filter(asset => asset?.type === 'image' && isImageDataUrl(asset?.data));
  let usedCount = 0;
  let estimatedBytes = 0;
  library.forEach(asset => {
    if (assetUsageCount(project, asset.id) > 0) usedCount += 1;
    estimatedBytes += estimateAssetBytes(asset);
  });
  return {
    totalCount:library.length,
    usedCount,
    unusedCount:library.length - usedCount,
    estimatedBytes
  };
}

export function renameMediaAsset(project, assetId, fileName, { now = () => new Date().toISOString() } = {}) {
  const asset = findMediaAsset(project, assetId);
  const name = stringOr(fileName).trim();
  if (!asset || !name) return null;
  asset.fileName = name;
  asset.updatedAt = now();
  return asset;
}

export function removeUnusedAsset(project, assetId) {
  if (assetUsageCount(project, assetId) > 0) return false;
  const library = ensureMediaLibrary(project);
  const index = library.findIndex(item => item?.id === assetId);
  if (index < 0) return false;
  library.splice(index, 1);
  return true;
}

export function removeAllUnusedAssets(project) {
  const library = ensureMediaLibrary(project);
  const before = library.length;
  project.mediaLibrary = library.filter(asset => assetUsageCount(project, asset?.id) > 0);
  return before - project.mediaLibrary.length;
}
