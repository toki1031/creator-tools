import { putMedia } from './mediaStore.js';
import { imageDataUrlToBlob } from './imageMediaStorage.js';

function dataUrlToBlob(value) {
  const data = typeof value === 'string' ? value : '';
  const comma = data.indexOf(',');
  if (!data.startsWith('data:') || comma < 0) return null;
  const header = data.slice(0, comma);
  const body = data.slice(comma + 1);
  const mimeType = header.match(/^data:([^;,]+)/i)?.[1] || 'application/octet-stream';
  if (header.toLowerCase().includes(';base64')) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type:mimeType });
  }
  return new Blob([decodeURIComponent(body)], { type:mimeType });
}

const yieldBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

async function storeThenReplace({ projectId, mediaId, kind, data, target, field, store }) {
  let blob;
  try { blob = kind === 'image' ? imageDataUrlToBlob(data) : dataUrlToBlob(data); }
  catch { return false; }
  if (!blob) return false;
  const result = await store({ projectId, mediaId, kind, blob });
  if (result?.status !== 'stored' || !result.mediaRef?.id) return false;
  target.mediaRef = result.mediaRef;
  delete target[field];
  return true;
}

export async function migrateLegacyProjectMedia(project, { store = putMedia, yieldControl = yieldBrowser } = {}) {
  if (!project?.id) return { migrated:0, failed:0 };
  let migrated = 0;
  let failed = 0;
  const tasks = [];

  for (const asset of Array.isArray(project.mediaLibrary) ? project.mediaLibrary : []) {
    if (asset?.type === 'image' && typeof asset.data === 'string' && asset.data.startsWith('data:image/') && !asset.mediaRef?.id) {
      tasks.push({ mediaId:'image-' + asset.id, kind:'image', data:asset.data, target:asset, field:'data' });
    }
  }
  for (const [index, scene] of (Array.isArray(project.scenes) ? project.scenes : []).entries()) {
    if (typeof scene?.imageData === 'string' && scene.imageData.startsWith('data:image/') && !scene.imageAssetId) {
      const assetId = 'asset-legacy-scene-' + String(scene.id || index + 1);
      const asset = { id:assetId, type:'image', fileName:'旧シーン画像', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
      if (!Array.isArray(project.mediaLibrary)) project.mediaLibrary = [];
      project.mediaLibrary.push(asset);
      const ok = await storeThenReplace({ projectId:project.id, mediaId:'image-' + assetId, kind:'image', data:scene.imageData, target:asset, field:'data', store });
      if (ok) { scene.imageAssetId = assetId; delete scene.imageData; migrated += 1; }
      else { project.mediaLibrary = project.mediaLibrary.filter(item => item !== asset); failed += 1; }
      await yieldControl();
    }
    if (typeof scene?.narration?.audioData === 'string' && scene.narration.audioData.startsWith('data:audio/') && !scene.narration.mediaRef?.id) {
      tasks.push({ mediaId:'narration-' + (scene.id || index + 1), kind:'audio', data:scene.narration.audioData, target:scene.narration, field:'audioData' });
    }
  }
  if (typeof project?.narration?.audioData === 'string' && project.narration.audioData.startsWith('data:audio/') && !project.narration.mediaRef?.id) {
    tasks.push({ mediaId:'narration-project', kind:'audio', data:project.narration.audioData, target:project.narration, field:'audioData' });
  }
  if (typeof project?.bgm?.audioData === 'string' && project.bgm.audioData.startsWith('data:audio/') && !project.bgm.mediaRef?.id) {
    tasks.push({ mediaId:'bgm-' + (project.bgm.audioAssetId || 'legacy'), kind:'audio', data:project.bgm.audioData, target:project.bgm, field:'audioData' });
  }

  for (const task of tasks) {
    const ok = await storeThenReplace({ projectId:project.id, ...task, store });
    if (ok) migrated += 1; else failed += 1;
    await yieldControl();
  }
  return { migrated, failed };
}
