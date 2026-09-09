const text = value => String(value ?? '').trim();

export function buildProductionContext(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const durations = scenes.map(scene => Number(scene?.durationSec)).filter(Number.isFinite);
  const totalDurationSec = Math.round(durations.reduce((sum, value) => sum + value, 0) * 100) / 100;
  return {
    genre: text(project?.genre) || null,
    platform: text(project?.platform) || null,
    aspectRatio: text(project?.aspectRatio) || null,
    sceneCount: scenes.length,
    totalDurationSec,
    averageSceneDurationSec: scenes.length ? Math.round((totalDurationSec / scenes.length) * 100) / 100 : 0,
    scenes: scenes.map((scene, index) => ({
      index,
      text: text(scene?.text).slice(0, 240),
      durationSec: Number.isFinite(Number(scene?.durationSec)) ? Number(scene.durationSec) : null,
      hasImage: Boolean(scene?.imageAssetId || scene?.imageData),
      hasNarration: Boolean(scene?.narration?.audioData),
      motion: text(scene?.motion) || null,
      transition: text(scene?.transition) || null
    }))
  };
}

export function productionContextSignature(context) {
  if (!context || typeof context !== 'object') return '';
  return JSON.stringify(context);
}
