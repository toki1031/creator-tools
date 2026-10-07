const MODEL='@cf/myshell-ai/melotts';
const MAX_TEXT_CHARS=1800;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
export async function onRequestPost({request,env}){
  if(!env?.AI)return json({reason:'Cloudflare Workers AI binding が未設定です'},503);
  let body;try{body=await request.json()}catch{return json({reason:'音声生成リクエストが不正です'},400)}
  const prompt=Array.from(String(body?.text||'').trim()).slice(0,MAX_TEXT_CHARS).join('');
  if(!prompt)return json({reason:'ナレーション文章がありません'},400);
  try{
    const result=await env.AI.run(MODEL,{prompt,lang:'jp'});
    return new Response(result,{headers:{'content-type':'audio/mpeg','cache-control':'no-store','x-creator-os-model':MODEL}});
  }catch(error){
    const message=String(error?.message||'');
    const quota=/quota|limit|neurons|429/i.test(message);
    return json({reason:quota?'本日のAI音声生成枠を使い切りました':'高速AI音声の生成に失敗しました',detail:message.slice(0,160)},quota?429:502);
  }
}
