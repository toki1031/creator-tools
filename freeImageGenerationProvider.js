const FREE_GENERATION_TYPES = new Set(['ai-reconstruction','modern-visual']);

export function planFreeImageGeneration(requirement, { dailyQuotaAvailable = true } = {}) {
  const requestedType = String(requirement?.requestedType || 'other');
  if (requestedType === 'historical-source' || requestedType === 'document') {
    return { status:'blocked', provider:'cloudflare-workers-ai', paidFallback:false, reason:'実物史料・文書は生成AIへフォールバックしません' };
  }
  if (!FREE_GENERATION_TYPES.has(requestedType)) {
    return { status:'needs-review', provider:null, paidFallback:false, reason:'無料画像生成へ送る素材種別を確定できません' };
  }
  if (!dailyQuotaAvailable) {
    return { status:'free-quota-exhausted', provider:'cloudflare-workers-ai', paidFallback:false, reason:'本日の無料生成枠を使い切ったため停止しました' };
  }
  return { status:'ready', provider:'cloudflare-workers-ai', paidFallback:false, serverSideOnly:true, requestedType };
}
