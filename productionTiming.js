const nowIso = now => new Date(now).toISOString();
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

export function startProductionStage(stage, now = Date.now()) {
  return { stage: String(stage || 'unknown'), startedAt: nowIso(now), startedAtMs: Number(now) };
}

export function finishProductionStage(entry, now = Date.now()) {
  const start = finite(entry?.startedAtMs);
  const end = Number(now);
  return {
    stage: String(entry?.stage || 'unknown'),
    startedAt: entry?.startedAt || (start !== null ? nowIso(start) : null),
    finishedAt: nowIso(end),
    durationMs: start === null ? null : Math.max(0, end - start)
  };
}

export function appendProductionTiming(project, entry, limit = 100) {
  if (!project || typeof project !== 'object' || !entry) return project;
  const current = Array.isArray(project.productionTimingLog) ? project.productionTimingLog : [];
  const next = [...current, { ...entry }].slice(-Math.max(1, Number(limit) || 100));
  return { ...project, productionTimingLog: next };
}
