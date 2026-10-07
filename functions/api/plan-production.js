const MODEL='@cf/meta/llama-3.1-8b-instruct';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const clean=v=>String(v??'').trim();
function extractJson(value){
  const text=typeof value==='string'?value:clean(value?.response||value?.result||value?.text);
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0||end<=start) throw new Error('AI response did not contain JSON');
  return JSON.parse(text.slice(start,end+1));
}
function normalizeBrief(raw,profile){
  const scenes=Array.isArray(raw?.sceneDirectives)?raw.sceneDirectives.slice(0,12):[];
  if(!scenes.length) throw new Error('AI response had no scenes');
  return {
    objective:clean(raw.objective),
    tone:clean(raw.tone)||clean(profile?.narrationDirection),
    globalRules:[...(Array.isArray(raw.globalRules)?raw.globalRules:[]),...(Array.isArray(profile?.reviewFocus)?profile.reviewFocus.map(x=>`要確認: ${x}`):[])].map(clean).filter(Boolean),
    subtitleGuidance:Array.isArray(raw.subtitleGuidance)?raw.subtitleGuidance.map(clean).filter(Boolean):[],
    narrationGuidance:[clean(profile?.narrationDirection),...(Array.isArray(raw.narrationGuidance)?raw.narrationGuidance:[])].map(clean).filter(Boolean),
    bgmGuidance:Array.isArray(raw.bgmGuidance)?raw.bgmGuidance.map(clean).filter(Boolean):[],
    seGuidance:[],
    qaCriteria:[...(Array.isArray(raw.qaCriteria)?raw.qaCriteria:[]),'AIが一般知識から構成した案。外部調査・出典確認を行ったとはみなさない'].map(clean).filter(Boolean),
    sceneDirectives:scenes.map((s,i)=>({
      sceneId:`scene-${i+1}`, purpose:clean(s?.purpose), narrationText:clean(s?.narrationText),
      subtitleText:clean(s?.subtitleText)||clean(s?.narrationText), visualDirection:clean(s?.visualDirection),
      assetType:['ai-reconstruction','modern-visual','other'].includes(clean(s?.assetType))?clean(s.assetType):'modern-visual',
      motionGuidance:clean(s?.motionGuidance)||'zoom-in', rules:Array.isArray(s?.rules)?s.rules.map(clean).filter(Boolean):[]
    }))
  };
}
export async function onRequestPost({request,env}){
  if(!env?.AI)return json({reason:'Cloudflare Workers AI binding が未設定です'},503);
  let body;try{body=await request.json()}catch{return json({reason:'制作依頼が不正です'},400)}
  const requestText=clean(body?.requestText),profile=body?.studioProfile||{};
  if(!requestText)return json({reason:'制作依頼を入力してください'},400);
  const system=`You are Creator OS Production Planner. Return JSON only. Convert the user's short request into a safe, reviewable short-video ProductionBrief. Never claim that web research, source verification, medical review, or professional review occurred. Studio research policy: ${clean(profile.researchPolicy)}. Script direction: ${clean(profile.scriptTone)}. Visual direction: ${clean(profile.visualDirection)}. Narration: ${clean(profile.narrationDirection)}. Review focus: ${Array.isArray(profile.reviewFocus)?profile.reviewFocus.join(', '):''}. Use 4-8 scenes unless the request clearly needs otherwise. Each scene needs purpose,narrationText,subtitleText,visualDirection,assetType,motionGuidance,rules. For ordinary education visuals use modern-visual. Avoid unsupported precise health/development claims; when safety-sensitive, use cautious wording and add a review rule. Output keys: objective,tone,globalRules,subtitleGuidance,narrationGuidance,bgmGuidance,qaCriteria,sceneDirectives.`;
  try{
    const result=await env.AI.run(MODEL,{messages:[{role:'system',content:system},{role:'user',content:requestText}],temperature:0.35,max_tokens:1800});
    return json({brief:normalizeBrief(extractJson(result),profile),model:MODEL,source:'workers-ai-planner'});
  }catch(error){return json({reason:'AIによるScene設計に失敗しました',detail:clean(error?.message).slice(0,180)},502)}
}