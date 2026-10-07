import { getStudioProfile } from './studioProfiles.js';
export async function planProductionRequest(requestText,studioProfileId,{fetchImpl=fetch}={}){
  const response=await fetchImpl('/api/plan-production',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestText:String(requestText||'').trim(),studioProfile:getStudioProfile(studioProfileId)})});
  let body={};try{body=await response.json()}catch{}
  if(!response.ok||!body?.brief)throw new Error(body?.reason||'AIによるScene設計に失敗しました');
  return {brief:body.brief,source:body.source||'workers-ai-planner',model:body.model||''};
}