import { recordSceneImageSelection } from './decisionLog.js';
import { findMediaAsset, promoteLegacySceneImage } from './mediaLibrary.js';

export function adoptVisualAssetForScene(project, sceneIndex, assetId, { candidateAssetIds = [], ...options } = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const index = Number(sceneIndex);
  const scene = Number.isInteger(index) && index >= 0 && index < scenes.length ? scenes[index] : null;
  if (!scene) return { changed:false, record:null, reason:'scene-not-found' };

  const targetId = String(assetId || '').trim();
  if (!targetId || !findMediaAsset(project, targetId)) return { changed:false, record:null, reason:'asset-not-found' };

  const beforeAssetId = String(scene.imageAssetId || '').trim() || null;
  if (beforeAssetId === targetId && !scene.imageData) return { changed:false, record:null, reason:'same-asset' };

  if (scene.imageData) {
    promoteLegacySceneImage(project, scene, { fileName:`シーン ${index + 1} の旧画像`, ...options });
  }

  scene.imageAssetId = targetId;
  delete scene.imageData;
  const record = recordSceneImageSelection(project, {
    sceneId: scene.id,
    beforeAssetId,
    afterAssetId: targetId,
    sceneIndex: index,
    candidateAssetIds
  }, options);

  return { changed:true, record, reason:'adopted' };
}
