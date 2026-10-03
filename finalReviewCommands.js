const cleanText=value=>String(value??'').trim();
const finiteNumber=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const cloneProject=project=>structuredClone(project);

function findSceneIndex(project,sceneId){
  return Array.isArray(project?.scenes)?project.scenes.findIndex(scene=>scene?.id===sceneId):-1;
}

export function applyFinalReviewCommand(project,command={}){
  if(!project||typeof project!=='object') return {project,changed:false,reason:'invalid-project'};
  const type=cleanText(command.type);
  const next=cloneProject(project);

  if(type==='replace-scene-image'){
    const index=findSceneIndex(next,command.sceneId);
    const assetId=cleanText(command.assetId);
    if(index<0||!assetId) return {project,changed:false,reason:'invalid-scene-or-asset'};
    if(next.scenes[index].imageAssetId===assetId) return {project,changed:false,reason:'no-change'};
    next.scenes[index].imageAssetId=assetId;
    next.scenes[index].imageData='';
    return {project:next,changed:true};
  }

  if(type==='set-subtitle-text'){
    const index=findSceneIndex(next,command.sceneId);
    if(index<0) return {project,changed:false,reason:'scene-not-found'};
    const value=String(command.text??'');
    if(next.scenes[index].subtitleText===value) return {project,changed:false,reason:'no-change'};
    next.scenes[index].subtitleText=value;
    return {project:next,changed:true};
  }

  if(type==='set-scene-duration'){
    const index=findSceneIndex(next,command.sceneId);
    const value=finiteNumber(command.durationSec,NaN);
    if(index<0||!Number.isFinite(value)||value<0.5||value>60) return {project,changed:false,reason:'invalid-duration'};
    if(next.scenes[index].durationSec===value) return {project,changed:false,reason:'no-change'};
    next.scenes[index].durationSec=value;
    return {project:next,changed:true};
  }

  if(type==='set-subtitle-position'){
    const allowed=new Set(['top','center','bottom']);
    const value=cleanText(command.position);
    if(!allowed.has(value)) return {project,changed:false,reason:'invalid-subtitle-position'};
    next.subtitleStyle={...(next.subtitleStyle||{}),position:value};
    if(project?.subtitleStyle?.position===value) return {project,changed:false,reason:'no-change'};
    return {project:next,changed:true};
  }

  if(type==='set-bgm-volume'){
    const value=finiteNumber(command.volume,NaN);
    if(!Number.isFinite(value)||value<0||value>1) return {project,changed:false,reason:'invalid-bgm-volume'};
    next.bgm={...(next.bgm||{}),volume:value};
    if(project?.bgm?.volume===value) return {project,changed:false,reason:'no-change'};
    return {project:next,changed:true};
  }

  if(type==='move-scene'){
    const from=findSceneIndex(next,command.sceneId);
    const to=Number(command.toIndex);
    if(from<0||!Number.isInteger(to)||to<0||to>=next.scenes.length) return {project,changed:false,reason:'invalid-scene-order'};
    if(from===to) return {project,changed:false,reason:'no-change'};
    const [scene]=next.scenes.splice(from,1);
    next.scenes.splice(to,0,scene);
    next.scenes.forEach((item,index)=>{item.order=index+1;});
    return {project:next,changed:true};
  }

  return {project,changed:false,reason:'unknown-command'};
}
