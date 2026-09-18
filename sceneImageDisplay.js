import { isMediaRef } from './mediaRef.js';
import { getMedia } from './mediaStore.js';
import { isImageDataUrl } from './mediaLibrary.js';

function clean(value = '') { return String(value ?? '').trim(); }
const noop = () => {};

function findImageAsset(project, assetId) {
  const id = clean(assetId);
  if (!id) return null;
  return (Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [])
    .find(asset => asset?.type === 'image' && clean(asset?.id) === id) || null;
}

export async function resolveSceneImageForDisplay(project, scene, {
  loadMedia = getMedia,
  createObjectUrl = blob => URL.createObjectURL(blob),
  revokeObjectUrl = url => URL.revokeObjectURL(url)
} = {}) {
  const asset = findImageAsset(project, scene?.imageAssetId);
  if (asset && isImageDataUrl(asset.data)) {
    return { status:'resolved', source:'library', url:asset.data, assetId:asset.id, cleanup:noop };
  }
  if (asset && isMediaRef(asset.mediaRef)) {
    let loaded;
    try {
      loaded = await loadMedia({ projectId: clean(project?.id), mediaId: asset.mediaRef.id });
    } catch (error) {
      return { status:'error', source:'media-ref', url:'', assetId:asset.id, cleanup:noop, reason:clean(error?.message) || '画像を読み出せませんでした' };
    }
    if (loaded?.status !== 'resolved' || !(loaded.blob instanceof Blob)) {
      return { status:loaded?.status === 'error' ? 'error' : 'missing', source:'media-ref', url:'', assetId:asset.id, cleanup:noop, reason:loaded?.reason || '画像が見つかりません' };
    }
    try {
      const url = createObjectUrl(loaded.blob);
      if (!clean(url)) throw new Error('表示URLを作成できませんでした');
      let revoked = false;
      return {
        status:'resolved', source:'media-ref', url, assetId:asset.id,
        cleanup:() => { if (!revoked) { revoked = true; revokeObjectUrl(url); } }
      };
    } catch (error) {
      return { status:'error', source:'media-ref', url:'', assetId:asset.id, cleanup:noop, reason:clean(error?.message) || '画像の表示準備に失敗しました' };
    }
  }
  if (isImageDataUrl(scene?.imageData)) {
    return { status:'resolved', source:'legacy', url:scene.imageData, assetId:'', cleanup:noop };
  }
  return { status:'missing', source:'none', url:'', assetId:'', cleanup:noop, reason:'利用可能なScene画像がありません' };
}
