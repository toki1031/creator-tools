import { getStudioProfile } from './studioProfiles.js';

export function needsResearchStage(requestText,studioProfileId){
  const text=String(requestText||'').trim();
  if(!text)return false;
  if(studioProfileId==='education')return /赤ちゃん|乳児|幼児|子ども|発達|月齢|年齢|安全|睡眠|授乳|食事|運動|健康|おすすめ|効果|できる|目安/.test(text);
  if(studioProfileId==='great-person')return true;
  if(studioProfileId==='fortune')return /今日|明日|今週|月|新月|満月|暦|天体|日付/.test(text);
  return /最新|事実|根拠|比較|調べ|確認/.test(text);
}

export async function researchProductionRequest(requestText,studioProfileId,{fetchImpl=fetch}={}){
  const response=await fetchImpl('/api/research-production',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestText:String(requestText||'').trim(),studioProfile:getStudioProfile(studioProfileId)})});
  let body={};try{body=await response.json()}catch{}
  if(!response.ok||!body?.research)return {ok:false,reason:body?.reason||'Research AIを利用できません',research:null};
  return {ok:true,research:body.research};
}