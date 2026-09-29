const FREE_GENERATION_TYPES = new Set(['ai-reconstruction','modern-visual']);
export const FREE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export function planFreeImageGeneration(requirement, { dailyQuotaAvailable = true } = {}) {
  const requestedType = String(requirement?.requestedType || 'other');
  if (requestedType === 'historical-source' || requestedType === 'document') return { status:'blocked', provider:'cloudflare-workers-ai', paidFallback:false, reason:'実物史料・文書は生成AIへフォールバックしません' };
  if (!FREE_GENERATION_TYPES.has(requestedType)) return { status:'needs-review', provider:null, paidFallback:false, reason:'無料画像生成へ送る素材種別を確定できません' };
  if (!dailyQuotaAvailable) return { status:'free-quota-exhausted', provider:'cloudflare-workers-ai', paidFallback:false, reason:'本日の無料生成枠を使い切ったため停止しました' };
  return { status:'ready', provider:'cloudflare-workers-ai', model:FREE_IMAGE_MODEL, paidFallback:false, serverSideOnly:true, requestedType };
}

export async function requestFreeGeneratedImage(requirement, { fetchImpl = fetch, endpoint = '/api/generate-image' } = {}) {
  const plan = planFreeImageGeneration(requirement);
  if (plan.status !== 'ready') return plan;
  let response;
  try { response = await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestedType:plan.requestedType,prompt:String(requirement?.queryHint||requirement?.query||requirement?.prompt||'').trim()})}); }
  catch { return {...plan,status:'error',reason:'無料画像生成サーバーへ接続できませんでした'}; }
  let payload={}; try { payload=await response.json(); } catch {}
  if (response.status===429) return {...plan,status:'free-quota-exhausted',reason:'本日の無料生成枠を使い切ったため停止しました'};
  if (!response.ok) return {...plan,status:'error',reason:String(payload?.reason||'無料画像生成に失敗しました')};
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(String(payload?.data||''))) return {...plan,status:'error',reason:'生成画像の応答形式が不正です'};
  return {...plan,status:'resolved',asset:{id:String(payload.id||''),data:payload.data,source:'generated-ai',provider:plan.provider,model:plan.model,generated:true,requestedType:plan.requestedType,provenance:{kind:'generated',label:plan.requestedType==='ai-reconstruction'?'AI歴史再現':'AI生成画像'}}};
}
