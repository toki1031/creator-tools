import { sceneNarrationStatus } from './narrationResume.js';
function clean(v=''){return String(v??'').trim();}
export function buildAutoNarrationQueue(project,{voiceId='tsukuyomi-chan',source='piper-plus'}={}){
  if(project?.autoProduction?.mode!=='production-request') return {status:'not-auto-production',items:[]};
  const scenes=Array.isArray(project?.scenes)?project.scenes:[];
  const items=scenes.map((scene,index)=>{
    const text=clean(scene?.speechText);
    if(!text)return {sceneId:scene?.id||`scene-${index+1}`,order:Number(scene?.order)||index+1,status:'skip-empty',text:''};
    const reuse=sceneNarrationStatus(scene,{text,voiceId,source})==='reusable';
    return {sceneId:scene?.id||`scene-${index+1}`,order:Number(scene?.order)||index+1,status:reuse?'reuse':'generate',text,voiceId,source};
  }).sort((a,b)=>a.order-b.order);
  return {status:'ready',items,pendingCount:items.filter(x=>x.status==='generate').length,reuseCount:items.filter(x=>x.status==='reuse').length,skipCount:items.filter(x=>x.status==='skip-empty').length};
}
