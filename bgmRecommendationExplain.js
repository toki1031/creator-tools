export function explainBgmRecommendation(candidate, context = {}) {
  const reasons = [];
  if (candidate?.score > 0) reasons.push('動画条件と登録情報が近い');
  if (Number.isFinite(Number(context.durationSec))) reasons.push(`動画尺 約${Math.round(Number(context.durationSec))}秒を考慮`);
  return reasons.length ? reasons.join(' / ') : '端末内ライブラリの登録曲';
}
