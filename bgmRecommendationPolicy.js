export function canRecommendBgmTrack(track) {
  if (!track?.audioData) return false;
  if (track.commercialUseAllowed === false) return false;
  if (!track.sourceUrl || !track.license) return false;
  return true;
}

export function filterRecommendableBgmTracks(tracks) {
  return (Array.isArray(tracks) ? tracks : []).filter(canRecommendBgmTrack);
}
