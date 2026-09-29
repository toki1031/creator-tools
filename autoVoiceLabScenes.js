import { buildAutoNarrationQueue } from './autoNarrationQueue.js';
import { applyGeneratedSceneNarration } from './autoSceneNarrationApply.js';
import { putMedia } from './mediaStore.js';
import { createAudioAssetIdFromArrayBuffer } from './audioAssetIdentity.js';

export async function generateAutoProductionScenes({project:inputProject,synthesize,save,storeMedia=putMedia,voiceId='tsukuyomi-chan',source='piper-plus'}={}){
  if(typeof synthesize!=='function')return {status:'engine-not-ready',project:inputProject};
  if(typeof save!=='function')return {status:'save-not-ready',project:inputProject};
  let working=inputProject;
  const queue=buildAutoNarrationQueue(working,{voiceId,source});
  if(queue.status!=='ready')return {status:queue.status,project:working,results:[]};
  const results=[];
  for(const item of queue.items){
    if(item.status!=='generate'){results.push(item);continue;}
    try{
      const generated=await synthesize(item.text);
      const blob=generated?.toBlob?.();
      const durationSec=Number(generated?.duration)||0;
      if(!blob||!(durationSec>0))throw new Error('WAVを取得できません');
      const bytes=await blob.arrayBuffer();
      const mediaId=await createAudioAssetIdFromArrayBuffer(bytes);
      if(!mediaId)throw new Error('音声Media IDを作成できません');
      const stored=await storeMedia({projectId:working.id,mediaId,kind:'audio',blob});
      if(stored?.status!=='stored'||!stored?.mediaRef)throw new Error(stored?.reason||'音声をMedia Storeへ保存できません');
      const applied=applyGeneratedSceneNarration(working,{sceneId:item.sceneId,text:item.text,mediaRef:stored.mediaRef,durationSec,voiceId,source,mimeType:blob.type||'audio/wav'});
      if(applied.status!=='applied')throw new Error('Scene音声を保存形式へ変換できません');
      working=applied.project; working.updatedAt=new Date().toISOString(); await save(working);
      results.push({...item,status:'generated',durationSec});
    }catch(error){return {status:'stopped',project:working,results,failedSceneId:item.sceneId,reason:error?.message||String(error)};}
  }
  return {status:'complete',project:working,results};
}
