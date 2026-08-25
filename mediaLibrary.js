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

export function assetUsageCount(project, assetId) {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  if (!id) return 0;
  return (Array.isArray(project?.scenes) ? project.scenes : []).filter(scene => scene?.imageAssetId === id).length;
}

export function removeUnusedAsset(project, assetId) {
  if (assetUsageCount(project, assetId) > 0) return false;
  const library = ensureMediaLibrary(project);
  const index = library.findIndex(item => item?.id === assetId);
  if (index < 0) return false;
  library.splice(index, 1);
  return true;
}
