const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function detectEnergyPeaks(samples, sampleRate, { windowMs = 80, minIntervalSec = 0.28, threshold = 1.45, maxPeaks = 240 } = {}) {
  if (!samples || !Number.isFinite(sampleRate) || sampleRate <= 0) return [];
  const window = Math.max(16, Math.round(sampleRate * windowMs / 1000));
  const energies = [];
  for (let start = 0; start < samples.length; start += window) {
    const end = Math.min(samples.length, start + window);
    let sum = 0;
    for (let i = start; i < end; i++) {
      const value = Number(samples[i]) || 0;
      sum += value * value;
    }
    energies.push({ timeSec: start / sampleRate, energy: sum / Math.max(1, end - start) });
  }
  if (!energies.length) return [];
  const average = energies.reduce((sum, item) => sum + item.energy, 0) / energies.length;
  const floor = average * Math.max(1, Number(threshold) || 1.45);
  const peaks = [];
  let last = -Infinity;
  for (let i = 1; i < energies.length - 1; i++) {
    const item = energies[i];
    if (item.energy < floor || item.energy < energies[i - 1].energy || item.energy < energies[i + 1].energy) continue;
    if (item.timeSec - last < minIntervalSec) continue;
    peaks.push(item.timeSec);
    last = item.timeSec;
    if (peaks.length >= maxPeaks) break;
  }
  return peaks;
}

export function sceneBoundaries(scenes = []) {
  const list = Array.isArray(scenes) ? scenes : [];
  let cursor = 0;
  const boundaries = [];
  for (let i = 0; i < list.length - 1; i++) {
    cursor += Math.max(0, Number(list[i]?.durationSec) || 0);
    boundaries.push(cursor);
  }
  return boundaries;
}

export function proposeBeatSnappedDurations(scenes = [], peaks = [], { toleranceSec = 0.45, minSceneSec = 1.5 } = {}) {
  const list = Array.isArray(scenes) ? scenes : [];
  if (list.length < 2 || !Array.isArray(peaks) || !peaks.length) return { changed: 0, durations: list.map(scene => Math.max(0, Number(scene?.durationSec) || 0)), boundaries: [] };
  const total = list.reduce((sum, scene) => sum + Math.max(0, Number(scene?.durationSec) || 0), 0);
  const current = sceneBoundaries(list);
  const snapped = [];
  let previous = 0;
  let changed = 0;

  current.forEach((boundary, index) => {
    const remainingScenes = list.length - index - 1;
    const maxBoundary = total - remainingScenes * minSceneSec;
    const minBoundary = previous + minSceneSec;
    const candidates = peaks
      .filter(peak => Math.abs(peak - boundary) <= toleranceSec && peak >= minBoundary && peak <= maxBoundary)
      .sort((a, b) => Math.abs(a - boundary) - Math.abs(b - boundary));
    const next = candidates[0] ?? boundary;
    if (Math.abs(next - boundary) > 0.01) changed++;
    snapped.push(next);
    previous = next;
  });

  const durations = [];
  let cursor = 0;
  for (const boundary of snapped) {
    durations.push(Math.round((boundary - cursor) * 100) / 100);
    cursor = boundary;
  }
  durations.push(Math.round((total - cursor) * 100) / 100);
  return { changed, durations, boundaries: snapped };
}

export function applyBeatSnappedDurations(project, proposal) {
  const durations = Array.isArray(proposal?.durations) ? proposal.durations : [];
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  if (durations.length !== scenes.length || !durations.length) return project;
  return {
    ...project,
    scenes: scenes.map((scene, index) => ({ ...scene, durationSec: clamp(durations[index], 0.1, 3600) }))
  };
}
