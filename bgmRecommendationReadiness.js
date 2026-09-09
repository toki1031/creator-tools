export function bgmRecommendationReadiness(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  const local = list.filter(track => track?.audioData);
  const licensed = local.filter(track => track?.license && track?.sourceUrl && track?.commercialUseAllowed !== false);
  return {
    ready: licensed.length >= 2,
    registeredCount: list.length,
    localAudioCount: local.length,
    recommendableCount: licensed.length,
    message: licensed.length >= 2 ? 'BGM候補を比較できます。' : '配布元・ライセンスを記録したBGMを2曲以上登録すると候補比較できます。'
  };
}
