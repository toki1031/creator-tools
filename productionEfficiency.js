const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

export function syncSceneDurationToNarration(scene, options = {}) {
  if (!scene || typeof scene !== 'object') return { changed: false, scene };
  const audioDuration = finite(scene?.narration?.durationSec ?? scene?.narration?.audioDurationSec);
  if (audioDuration === null || audioDuration <= 0) return { changed: false, scene };
  const leadInSec = Math.max(0, finite(options.leadInSec) ?? 0.08);
  const tailSec = Math.max(0, finite(options.tailSec) ?? 0.18);
  const minDurationSec = Math.max(0.5, finite(options.minDurationSec) ?? 1);
  const maxDurationSec = Math.max(minDurationSec, finite(options.maxDurationSec) ?? 30);
  const nextDuration = Math.min(maxDurationSec, Math.max(minDurationSec, audioDuration + leadInSec + tailSec));
  const current = finite(scene.durationSec);
  if (current !== null && Math.abs(current - nextDuration) < 0.01) return { changed: false, scene };
  return { changed: true, scene: { ...scene, durationSec: Math.round(nextDuration * 100) / 100 } };
}

export function syncProjectSceneDurationsToNarration(project, options = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  let changed = 0;
  const nextScenes = scenes.map(scene => {
    const result = syncSceneDurationToNarration(scene, options);
    if (result.changed) changed += 1;
    return result.scene;
  });
  return { changed, project: changed ? { ...project, scenes: nextScenes } : project };
}
