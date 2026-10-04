import { putMedia } from './mediaStore.js';
import { isImageDataUrl } from './mediaLibrary.js';

export function imageDataUrlToBlob(dataUrl) {
  if (!isImageDataUrl(dataUrl)) return null;
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mimeType = header.match(/^data:([^;,]+)/i)?.[1] || 'image/jpeg';
  if (header.toLowerCase().includes(';base64')) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([decodeURIComponent(body)], { type: mimeType });
}

export async function storeImageAssetMedia(project, asset, { store = putMedia } = {}) {
  if (!project?.id || !asset?.id || !isImageDataUrl(asset.data)) {
    return { status: 'blocked', reason: '保存する画像素材がありません', asset };
  }
  let blob;
  try { blob = imageDataUrlToBlob(asset.data); }
  catch (error) { return { status: 'error', reason: error.message, asset }; }
  const result = await store({ projectId: project.id, mediaId: 'image-' + asset.id, kind: 'image', blob });
  if (result?.status !== 'stored' || !result.mediaRef) return { ...result, asset };
  asset.mediaRef = result.mediaRef;
  delete asset.data;
  return { status: 'stored', mediaRef: result.mediaRef, asset };
}
