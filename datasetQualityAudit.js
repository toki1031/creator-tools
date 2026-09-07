const URL_PREFIX = /^(?:data|blob):/i;

function hasBlockedUrl(value, seen = new WeakSet()) {
  if (typeof value === 'string') return URL_PREFIX.test(value.trim());
  if (value == null || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.some(item => hasBlockedUrl(item, seen));
    return Object.values(value).some(item => hasBlockedUrl(item, seen));
  } finally {
    seen.delete(value);
  }
}

function isValidTimestamp(value) {
  return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value));
}

export function auditDecisionRecord(record, duplicateIds = new Set()) {
  const invalidReasons = [];
  const warningReasons = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { status: 'invalid', invalidReasons: ['record-not-object'], warningReasons: [] };
  }

  const id = String(record.id || '').trim();
  const decisionType = String(record.decisionType || '').trim();
  const projectId = String(record.projectId || '').trim();
  const sceneId = record.sceneId == null ? '' : String(record.sceneId).trim();

  if (!id) invalidReasons.push('missing-id');
  if (id && duplicateIds.has(id)) invalidReasons.push('duplicate-id');
  if (!decisionType || decisionType === 'unknown') invalidReasons.push('invalid-decision-type');
  if (!isValidTimestamp(record.timestamp)) invalidReasons.push('invalid-timestamp');
  if (hasBlockedUrl(record)) invalidReasons.push('blocked-url-present');

  if (!projectId) warningReasons.push('missing-project-id');
  if ('sceneId' in record && !sceneId) warningReasons.push('empty-scene-id');
  if (!record.humanAction || typeof record.humanAction !== 'object') warningReasons.push('missing-human-action');
  if (!record.finalDecision || typeof record.finalDecision !== 'object') warningReasons.push('missing-final-decision');
  if (!record.source || typeof record.source !== 'object') warningReasons.push('missing-source');

  return {
    status: invalidReasons.length ? 'invalid' : warningReasons.length ? 'warning' : 'valid',
    invalidReasons: [...new Set(invalidReasons)],
    warningReasons: [...new Set(warningReasons)]
  };
}

export function auditDecisionRecords(decisions = []) {
  const source = Array.isArray(decisions) ? decisions : [];
  const counts = new Map();
  for (const record of source) {
    const id = String(record?.id || '').trim();
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const duplicateIds = new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  const records = source.map((record, index) => ({ index, id: String(record?.id || '').trim() || null, ...auditDecisionRecord(record, duplicateIds) }));
  const reasonCounts = {};
  const summary = { total: records.length, valid: 0, warning: 0, invalid: 0, reasonCounts };
  for (const result of records) {
    summary[result.status] += 1;
    for (const reason of [...result.invalidReasons, ...result.warningReasons]) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }
  return { summary, records };
}

export function auditDatasetExports(exports = []) {
  const source = Array.isArray(exports) ? exports : [];
  const decisions = source.flatMap(entry => Array.isArray(entry?.decisions) ? entry.decisions : []);
  return auditDecisionRecords(decisions);
}
