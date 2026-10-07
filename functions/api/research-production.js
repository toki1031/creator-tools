const MODEL='@cf/meta/llama-3.1-8b-instruct';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v.map(clean).filter(Boolean):[];
function extractJson(value){
 const text=typeof value==='string'?value:clean(value?.response||value?.result||value?.text);
 const start=text.indexOf('{'),end=text.lastIndexOf('}'); if(start<0||end<=start)throw new Error('AI response did not contain JSON');
 return JSON.parse(text.slice(start,end+1));
}
function normalize(raw,profile){
 return {
   mode:'model-background-only',
   externallyVerified:false,
   evidence:[],
   backgroundKnowledge:arr(raw?.backgroundKnowledge).slice(0,12),
   unresolvedClaims:[...arr(raw?.unresolvedClaims),...arr(raw?.claimsRequiringVerification)].slice(0,12),
   safetyFlags:arr(raw?.safetyFlags).slice(0,12),
   suggestedSourceTypes:arr(raw?.suggestedSourceTypes).slice(0,8),
   researchPolicy:clean(profile?.researchPolicy),
   disclaimer:'外部サイト・一次資料は取得していません。Research AIの一般知識整理であり、出典確認済みの調査結果ではありません。'
 };
}
export async function onRequestPost({request,env}){
 if(!env?.AI)return json({reason:'Cloudflare Workers AI binding が未設定です'},503);
 let body;try{body=await request.json()}catch{return json({reason:'調査依頼が不正です'},400)}
 const requestText=clean(body?.requestText),profile=body?.studioProfile||{}; if(!requestText)return json({reason:'調査依頼を入力してください'},400);
 const system=`You are Creator OS Research AI. Return JSON only. Analyze what background knowledge may help plan the requested content and, most importantly, identify claims that require external verification. You DO NOT have web access in this step. Never invent citations, URLs, organizations, studies, statistics, dates, medical advice, developmental milestones, or claim that anything was verified. Studio research policy: ${clean(profile.researchPolicy)}. Review focus: ${Array.isArray(profile.reviewFocus)?profile.reviewFocus.join(', '):''}. For health, safety, child development, age guidance, history, astronomy, current facts, or precise numbers, put uncertain/verification-dependent statements in unresolvedClaims. backgroundKnowledge must stay general and cautious. Suggest source types, not fake sources. Output keys: backgroundKnowledge, unresolvedClaims, safetyFlags, suggestedSourceTypes.`;
 try{
  const result=await env.AI.run(MODEL,{messages:[{role:'system',content:system},{role:'user',content:requestText}],temperature:0.15,max_tokens:1100});
  return json({research:normalize(extractJson(result),profile),model:MODEL,source:'workers-ai-research'});
 }catch(error){return json({reason:'Research AIの整理に失敗しました',detail:clean(error?.message).slice(0,180)},502)}
}