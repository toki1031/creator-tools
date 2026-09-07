function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function aggregateDatasetExports(exports = []) {
  const decisionTypes = {};
  let totalDecisions = 0;
  let validExports = 0;

  for (const item of asArray(exports)) {
    if (!item || typeof item !== 'object' || !Array.isArray(item.decisions)) continue;
    validExports += 1;
    totalDecisions += item.decisions.length;
    for (const decision of item.decisions) {
      const type = String(decision?.decisionType || '').trim() || 'unknown';
      decisionTypes[type] = (decisionTypes[type] || 0) + 1;
    }
  }

  return {
    aggregateVersion: '0.31',
    summary: {
      exports: validExports,
      totalDecisions,
      decisionTypes
    }
  };
}

export function inspectDatasetExport(payload) {
  if (!payload || typeof payload !== 'object') return { valid: false, errors: ['payload-not-object'] };
  const errors = [];
  if (payload.exportVersion !== '0.30') errors.push('unsupported-export-version');
  if (!Array.isArray(payload.decisions)) errors.push('decisions-not-array');
  if (!payload.project || typeof payload.project !== 'object') errors.push('project-missing');
  return { valid: errors.length === 0, errors };
}
