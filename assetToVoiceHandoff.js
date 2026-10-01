function clean(value=''){return String(value??'').trim();}

export function hasReadySceneImage(scene){
  return Boolean(clean(scene?.imageAssetId)||clean(scene?.imageData));
}

export function evaluateAssetToVoiceHandoff(project,result){
  const scenes=Array.isArray(project?.scenes)?project.scenes:[];
  const missingSceneIds=scenes
    .filter(scene=>!hasReadySceneImage(scene))
    .map((scene,index)=>clean(scene?.id)||`scene-${index+1}`);
  const pipelineStatus=clean(result?.status);
  const pipelineComplete=pipelineStatus==='complete'||pipelineStatus==='no-eligible-scenes';
  if(!pipelineComplete){
    return {
      canContinue:false,
      pipelineStatus,
      missingSceneIds,
      reason:clean(result?.reason)||'素材取得が安全完了していません'
    };
  }
  if(!scenes.length){
    return {canContinue:false,pipelineStatus,missingSceneIds,reason:'シーンがありません'};
  }
  if(missingSceneIds.length){
    return {
      canContinue:false,
      pipelineStatus,
      missingSceneIds,
      reason:`画像未設定のSceneが${missingSceneIds.length}件あります`
    };
  }
  return {canContinue:true,pipelineStatus,missingSceneIds:[],reason:''};
}
