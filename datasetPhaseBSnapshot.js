import { aggregateDatasetExports, inspectDatasetExport } from './datasetAggregate.js';
import { auditDatasetExports } from './datasetQualityAudit.js';
import { evaluateDatasetExportsReadiness } from './datasetTrainingReadiness.js';

export function createDatasetPhaseBSnapshot(exports = [], options = {}) {
  const source = Array.isArray(exports) ? exports : [];
  const inspections = source.map((payload, index) => ({ index, ...inspectDatasetExport(payload) }));
  const aggregate = aggregateDatasetExports(source);
  const audit = auditDatasetExports(source);
  const readiness = evaluateDatasetExportsReadiness(source, options);

  return {
    snapshotVersion: '0.34',
    generatedAt: options.generatedAt || new Date().toISOString(),
    inputs: {
      total: source.length,
      valid: inspections.filter(item => item.valid).length,
      invalid: inspections.filter(item => !item.valid).length,
      inspections
    },
    aggregate: aggregate.summary,
    audit: audit.summary,
    readiness
  };
}
