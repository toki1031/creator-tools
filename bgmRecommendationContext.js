export function buildBgmRecommendationContext(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const durationSec = scenes.reduce((sum, scene) => sum + (Number(scene?.durationSec) || 0), 0);
  return {
    genre: String(project?.genre || ''),
    mood: String(project?.bgm?.mood || project?.mood || ''),
    usage: String(project?.platform || ''),
    durationSec: Math.round(durationSec * 100) / 100
  };
}
