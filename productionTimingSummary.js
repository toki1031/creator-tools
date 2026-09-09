export function summarizeProductionTiming(entries) {
  const summary = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const stage = String(entry?.stage || 'unknown');
    const durationMs = Number(entry?.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < 0) continue;
    const current = summary.get(stage) || { stage, count: 0, totalMs: 0 };
    current.count += 1;
    current.totalMs += durationMs;
    summary.set(stage, current);
  }
  return [...summary.values()].map(item => ({ ...item, averageMs: Math.round(item.totalMs / item.count) })).sort((a, b) => b.totalMs - a.totalMs || a.stage.localeCompare(b.stage));
}
