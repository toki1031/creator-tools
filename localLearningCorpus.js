import { sanitizeDatasetValue } from './datasetExport.js';

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function createLocalLearningCorpus(projects = []) {
  const source = Array.isArray(projects) ? projects : [];
  const decisions = [];
  const projectIds = new Set();
  const decisionTypes = {};
  let skippedProjects = 0;
  let skippedDecisions = 0;

  for (const project of source) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      skippedProjects += 1;
      continue;
    }

    const projectId = safeString(project.id);
    const projectDecisions = project?.learning?.decisions;
    if (!projectId || !Array.isArray(projectDecisions)) {
      skippedProjects += 1;
      continue;
    }

    projectIds.add(projectId);
    for (const record of projectDecisions) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        skippedDecisions += 1;
        continue;
      }

      const sanitized = sanitizeDatasetValue(record);
      if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
        skippedDecisions += 1;
        continue;
      }

      const normalized = {
        ...sanitized,
        projectId: safeString(sanitized.projectId) || projectId
      };
      const decisionType = safeString(normalized.decisionType) || 'unknown';
      decisions.push(normalized);
      decisionTypes[decisionType] = (decisionTypes[decisionType] || 0) + 1;
    }
  }

  return {
    corpusVersion: '0.46',
    summary: {
      projects: projectIds.size,
      totalDecisions: decisions.length,
      skippedProjects,
      skippedDecisions,
      decisionTypes
    },
    decisions
  };
}
