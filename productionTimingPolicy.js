export function sanitizeProductionTimingEntry(entry) {
  const durationMs = Number(entry?.durationMs);
  if (!entry || !Number.isFinite(durationMs) || durationMs < 0) return null;
  return {
    stage: String(entry.stage || 'unknown').slice(0, 40),
    startedAt: entry.startedAt || null,
    finishedAt: entry.finishedAt || null,
    durationMs: Math.round(durationMs)
  };
}

export function appendSanitizedTiming(entries, entry, limit = 100) {
  const safe = sanitizeProductionTimingEntry(entry);
  const current = (Array.isArray(entries) ? entries : []).map(sanitizeProductionTimingEntry).filter(Boolean);
  if (!safe) return current.slice(-Math.max(1, Number(limit) || 100));
  return [...current, safe].slice(-Math.max(1, Number(limit) || 100));
}
