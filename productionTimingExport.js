import { summarizeProductionTiming } from './productionTimingSummary.js';

export function createProductionTimingReport(project) {
  const entries = Array.isArray(project?.productionTimingLog) ? project.productionTimingLog : [];
  return {
    version: 1,
    projectId: project?.id || null,
    genre: project?.genre || null,
    platform: project?.platform || null,
    entryCount: entries.length,
    stages: summarizeProductionTiming(entries)
  };
}
