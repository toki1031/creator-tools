import { getMedia, putMedia } from './mediaStore.js';

export const FINAL_VIDEO_MEDIA_ID = 'final-video-latest';

function clean(value=''){return String(value??'').trim();}

export async function storeFinalVideoArtifact(project, blob, { storeMedia = putMedia } = {}) {
  const projectId=clean(project?.id);
  if(!projectId || !(blob instanceof Blob) || !blob.size){
    return {status:'blocked',reason:'完成動画を保持するための情報が不足しています',mediaRef:null};
  }
  return await storeMedia({
    projectId,
    mediaId:FINAL_VIDEO_MEDIA_ID,
    kind:'video',
    blob
  });
}

export async function loadFinalVideoArtifact(project, { loadMedia = getMedia } = {}) {
  const projectId=clean(project?.id);
  if(!projectId)return {status:'blocked',reason:'プロジェクトIDがありません',mediaRef:null,blob:null};
  return await loadMedia({projectId,mediaId:FINAL_VIDEO_MEDIA_ID});
}

export function describeFinalVideoStorage(result){
  if(result?.status==='stored'||result?.status==='resolved'){
    return 'Creator OS内に保持済みです。iPhone本体にはまだ保存されていません。';
  }
  const reason=clean(result?.reason);
  return 'Creator OS内には保持できませんでした。ページを閉じる前にiPhoneへ保存してください。'+(reason?'（'+reason+'）':'');
}
