const MODEL='@cf/black-forest-labs/flux-1-schnell';
const ALLOWED=new Set(['ai-reconstruction','modern-visual']);
const MAX_PROMPT_CHARS=2048;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const clipPrompt=value=>Array.from(String(value||'').trim()).slice(0,MAX_PROMPT_CHARS).join('');
export async function onRequestPost({request,env}){
  if(!env?.AI) return json({reason:'Cloudflare Workers AI binding が未設定です'},503);
  let body; try{body=await request.json();}catch{return json({reason:'生成リクエストが不正です'},400)}
  const requestedType=String(body?.requestedType||'');
  if(requestedType==='historical-source'||requestedType==='document') return json({reason:'実物史料・文書は生成AIへフォールバックしません'},400);
  if(!ALLOWED.has(requestedType)) return json({reason:'この素材種別は無料画像生成の対象外です'},400);
  const prompt=clipPrompt(body?.prompt); if(!prompt) return json({reason:'画像生成プロンプトがありません'},400);
  try{
    const result=await env.AI.run(MODEL,{prompt});
    const base64=typeof result==='string'?result:result?.image;
    if(!base64) return json({reason:'生成画像を取得できませんでした'},502);
    return json({id:'generated-'+Date.now(),data:'data:image/jpeg;base64,'+base64,model:MODEL,generated:true});
  }catch(error){
    const message=String(error?.message||''); const quota=/quota|limit|neurons|429/i.test(message);
    return json({reason:quota?'本日の無料生成枠を使い切ったため停止しました':'Workers AIで画像生成に失敗しました'},quota?429:502);
  }
}
