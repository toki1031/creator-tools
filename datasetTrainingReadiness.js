import { auditDecisionRecords } from './datasetQualityAudit.js';

export const DEFAULT_READINESS_THRESHOLDS = Object.freeze({
  collectMoreValid: 20,
  collectMoreProjects: 2,
  candidateValid: 100,
  candidateProjects: 5,
  candidateSources: 1,
  maxInvalidRate: 0.05
});

function sourceKey(record) {
  const source = record?.source;
  if (!source || typeof source !== 'object') return '';
  return [source.type, source.feature, source.version].map(value => String(value || '').trim()).filter(Boolean).join(':');
}

function classify(stats, thresholds) {
  const total = stats.valid + stats.warning + stats.invalid;
  const invalidRate = total ? stats.invalid / total : 0;
  if (
    stats.valid >= thresholds.candidateValid &&
    stats.projects >= thresholds.candidateProjects &&
    stats.sources >= thresholds.candidateSources &&
    invalidRate <= thresholds.maxInvalidRate
  ) return 'candidate';
  if (stats.valid >= thresholds.collectMoreValid && stats.projects >= thresholds.collectMoreProjects) return 'collect-more';
  return 'insufficient';
}

export function evaluateTrainingReadiness(decisions = [], options = {}) {
  const source = Array.isArray(decisions) ? decisions : [];
  const thresholds = { ...DEFAULT_READINESS_THRESHOLDS, ...(options.thresholds || {}) };
  const audit = auditDecisionRecords(source);
  const byType = {};

  audit.records.forEach((auditRecord, index) => {
    const record = source[index];
    const decisionType = String(record?.decisionType || '').trim() || 'unknown';
    const stats = byType[decisionType] || (byType[decisionType] = {
      total: 0,
      valid: 0,
      warning: 0,
      invalid: 0,
      projects: 0,
      scenes: 0,
      sources: 0,
      readiness: 'insufficient',
      _projects: new Set(),
      _scenes: new Set(),
      _sources: new Set()
    });
    stats.total += 1;
    stats[auditRecord.status] += 1;
    const projectId = String(record?.projectId || '').trim();
    const sceneId = String(record?.sceneId || '').trim();
    const sourceId = sourceKey(record);
    if (projectId) stats._projects.add(projectId);
    if (sceneId) stats._scenes.add(sceneId);
    if (sourceId) stats._sources.add(sourceId);
  });

  for (const stats of Object.values(byType)) {
    stats.projects = stats._projects.size;
    stats.scenes = stats._scenes.size;
    stats.sources = stats._sources.size;
    stats.readiness = classify(stats, thresholds);
    delete stats._projects;
    delete stats._scenes;
    delete stats._sources;
  }

  return {
    thresholds,
    summary: {
      totalDecisions: audit.summary.total,
      valid: audit.summary.valid,
      warning: audit.summary.warning,
      invalid: audit.summary.invalid,
      decisionTypes: Object.keys(byType).length
    },
    decisionTypes: byType
  };
}

export function evaluateDatasetExportsReadiness(exports = [], options = {}) {
  const source = Array.isArray(exports) ? exports : [];
  const decisions = source.flatMap(entry => Array.isArray(entry?.decisions) ? entry.decisions : []);
  return evaluateTrainingReadiness(decisions, options);
}
