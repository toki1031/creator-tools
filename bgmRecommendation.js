const GENRE_AFFINITY = {
  'great-person': ['inspiring', 'dramatic', 'traditional', 'calm', 'ambient', 'other'],
  education: ['inspiring', 'calm', 'ambient', 'other', 'dramatic', 'traditional'],
  fortune: ['traditional', 'ambient', 'calm', 'inspiring', 'dramatic', 'other'],
  bgm: ['ambient', 'calm', 'inspiring', 'dramatic', 'traditional', 'other'],
  other: ['calm', 'inspiring', 'ambient', 'dramatic', 'traditional', 'other']
};

export function isRecommendableBgm(track = {}) {
  return Boolean(track.blob || track.audioData) && track.commercialUse !== 'not-allowed';
}

export function scoreBgmTrack(track = {}, project = {}) {
  if (!isRecommendableBgm(track)) return -Infinity;
  const order = GENRE_AFFINITY[project.genre || 'other'] || GENRE_AFFINITY.other;
  const index = order.indexOf(track.category || 'other');
  let score = index < 0 ? 0 : (order.length - index) * 10;
  if (track.commercialUse === 'allowed') score += 8;
  if (String(track.license || '').trim()) score += 5;
  if (String(track.sourceUrl || '').trim()) score += 2;
  return score;
}

export function rankBgmTracks(tracks = [], project = {}, limit = 3) {
  return [...tracks]
    .map(track => ({ track, score: scoreBgmTrack(track, project) }))
    .filter(row => Number.isFinite(row.score))
    .sort((a, b) => b.score - a.score || String(b.track.updatedAt || '').localeCompare(String(a.track.updatedAt || '')))
    .slice(0, Math.max(1, Number(limit) || 3));
}

export function bgmRecommendationReason(track = {}, project = {}) {
  const labels = { inspiring: '前向き', dramatic: 'ドラマチック', traditional: '和・伝統', calm: '落ち着き', ambient: '環境・アンビエント', other: 'その他' };
  const category = labels[track.category] || track.category || 'その他';
  const rights = track.commercialUse === 'allowed' ? '商用利用可を確認済み' : '利用条件を要確認';
  return `${project.genre || 'other'}向けの「${category}」候補・${rights}`;
}
