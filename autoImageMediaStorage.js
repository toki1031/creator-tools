import { putMedia } from './mediaStore.js';
import { applyAssetAdoptionPlan } from './assetAdoptionApply.js';
import { imageDataUrlToBlob } from './imageMediaStorage.js';

function clean(value = '') { return String(value ?? '').trim(); }

export async function storeAndApplyAutoImage(project, plan, resolvedAsset, {
  storeMedia = putMedia,
  applyAsset = applyAssetAdoptionPlan
} = {}) {
  if (!project || typeof project !== 'object') return { status: 'blocked', project, reason: 'プロジェクトがありません' };
  if (plan?.status !== 'ready') return { status: 'blocked', project, reason: '採用プランがreadyではありません' };
  const projectId = clean(project.id);
  if (!projectId) return { status: 'blocked', project, reason: 'プロジェクトIDがありません' };

  const blob = imageDataUrlToBlob(resolvedAsset?.data);
  if (!blob) return { status: 'blocked', project, reason: '保存できる画像データがありません' };

  const mediaId = clean(resolvedAsset?.id) || `auto-${clean(plan.sceneId)}`;
  let stored;
  try {
    stored = await storeMedia({ projectId, mediaId, kind: 'image', blob });
  } catch (error) {
    return { status: 'error', project, reason: clean(error?.message) || '画像の分離保存に失敗しました' };
  }
  if (stored?.status !== 'stored' || !stored.mediaRef) {
    return { status: stored?.status || 'error', project, reason: stored?.reason || '画像の分離保存に失敗しました' };
  }

  const separatedAsset = { ...resolvedAsset, id: mediaId, data: '', mediaRef: stored.mediaRef };
  const applied = applyAsset(project, plan, separatedAsset, { allowApply: true });
  if (!applied?.applied) {
    return { status: 'blocked', project, reason: applied?.reason || '分離保存した画像をprojectへ適用できません', mediaRef: stored.mediaRef };
  }
  return { status: 'applied', project: applied.project, assetId: applied.assetId, mediaRef: stored.mediaRef };
}
