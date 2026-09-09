export function productionSuggestionReadiness({ decisionCount = 0, projectCount = 0, accuracy = null } = {}, options = {}) {
  const minDecisions = Math.max(1, Number(options.minDecisions) || 5);
  const minProjects = Math.max(1, Number(options.minProjects) || 3);
  const minAccuracy = Number.isFinite(Number(options.minAccuracy)) ? Number(options.minAccuracy) : 0.6;
  const decisions = Math.max(0, Number(decisionCount) || 0);
  const projects = Math.max(0, Number(projectCount) || 0);
  const measuredAccuracy = Number.isFinite(Number(accuracy)) ? Number(accuracy) : null;
  const reasons = [];
  if (decisions < minDecisions) reasons.push('decision-evidence-insufficient');
  if (projects < minProjects) reasons.push('project-evidence-insufficient');
  if (measuredAccuracy === null || measuredAccuracy < minAccuracy) reasons.push('accuracy-insufficient');
  return { ready: reasons.length === 0, reasons, thresholds: { minDecisions, minProjects, minAccuracy } };
}
