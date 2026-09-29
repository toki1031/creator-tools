import { createNarrationFingerprint } from './narrationResume.js';
function clean(v=''){return String(v??'').trim();}
export function applyGeneratedSceneNarration(project,{sceneId,text,audioData='',mediaRef=null,durationSec,voiceId='tsukuyomi-chan',source='piper-plus',mimeType='audio/wav'}={}){
  if(project?.autoProduction?.mode!=='production-request')return {status:'blocked',project};
  const id=clean(sceneId), speech=clean(text), audio=clean(audioData), duration=Number(durationSec);
  const hasEmbedded=audio.startsWith('data:audio/'), hasRef=Boolean(mediaRef?.id);
  if(!id||!speech||(!hasEmbedded&&!hasRef)||!(duration>0))return {status:'invalid',project};
  const scenes=Array.isArray(project?.scenes)?project.scenes:[]; const index=scenes.findIndex(s=>s?.id===id);
  if(index<0)return {status:'scene-not-found',project};
  const next={...project,scenes:scenes.map((s,i)=>i===index?{...s,narration:{...(s.narration||{}),...(hasEmbedded?{audioData:audio}:{}),...(hasRef?{mediaRef}:{}) ,durationSec:duration,voiceId,source,mimeType,fingerprint:createNarrationFingerprint({text:speech,voiceId,source})}}:{...s})};
  return {status:'applied',project:next,scene:next.scenes[index]};
}
