const words = value => String(value ?? '').toLowerCase().split(/[\s,、/・]+/).map(v => v.trim()).filter(Boolean);

function scoreTrack(track, context) {
  let score = 0;
  const haystack = words([track?.title, track?.mood, track?.usage, track?.tags, track?.genre].filter(Boolean).join(' '));
  const desired = words([context?.genre, context?.mood, context?.usage].filter(Boolean).join(' '));
  for (const token of desired) if (haystack.some(value => value.includes(token) || token.includes(value))) score += 2;
  if (track?.commercialUseAllowed === true) score += 1;
  if (track?.license && track?.sourceUrl) score += 1;
  const duration = Number(track?.durationSec);
  const target = Number(context?.durationSec);
  if (Number.isFinite(duration) && Number.isFinite(target) && duration >= target) score += 1;
  return score;
}

export function recommendBgmTracks(tracks, context = {}, limit = 3) {
  return (Array.isArray(tracks) ? tracks : [])
    .filter(track => track && track.audioData)
    .map((track, index) => ({ track, index, score: scoreTrack(track, context) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, Number(limit) || 3))
    .map(({ track, score }) => ({ id: track.id, title: track.title || 'BGM', score, reason: score > 0 ? '動画条件と登録メタデータが一致' : '登録済みBGM候補' }));
}
