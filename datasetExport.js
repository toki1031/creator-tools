const BLOCKED_KEYS = new Set(['imageData', 'videoData', 'audioData']);
const BLOCKED_URL_PREFIX = /^(?:data|blob):/i;
const OMIT = Symbol('dataset-export-omit');

function sanitizeValue(value, seen) {
  if (typeof value === 'string') return BLOCKED_URL_PREFIX.test(value.trim()) ? OMIT : value;
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return OMIT;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item, seen)).filter(item => item !== OMIT);
    }
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) continue;
      const sanitized = sanitizeValue(child, seen);
      if (sanitized !== OMIT) result[key] = sanitized;
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function sanitizeDatasetValue(value) {
  const sanitized = sanitizeValue(value, new WeakSet());
  return sanitized === OMIT ? null : sanitized;
}

export function summarizeDecisionTypes(decisions = []) {
  const summary = {};
  for (const decision of Array.isArray(decisions) ? decisions : []) {
    const type = String(decision?.decisionType || '').trim() || 'unknown';
    summary[type] = (summary[type] || 0) + 1;
  }
  return summary;
}

export function createDatasetExportPayload(project, exportedAt = new Date().toISOString()) {
  const sourceDecisions = Array.isArray(project?.learning?.decisions) ? project.learning.decisions : [];
  const decisions = sanitizeDatasetValue(sourceDecisions);
  return {
    exportVersion: '0.30',
    exportedAt,
    project: {
      id: String(project?.id || ''),
      platform: String(project?.platform || ''),
      genre: String(project?.genre || ''),
      aspectRatio: String(project?.aspectRatio || ''),
      targetDurationSec: Number.isFinite(Number(project?.targetDurationSec)) ? Number(project.targetDurationSec) : null
    },
    summary: {
      totalDecisions: decisions.length,
      decisionTypes: summarizeDecisionTypes(decisions)
    },
    decisions
  };
}
