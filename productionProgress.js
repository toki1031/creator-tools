const ACTIONABLE = new Set(['blocked', 'needs-input', 'needs-generation', 'review']);
const COMPLETE = new Set(['ready', 'kept', 'prepared']);

export function summarizeProductionProgress(plan = {}) {
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const total = steps.length;
  const completed = steps.filter(step => COMPLETE.has(step?.status)).length;
  const pending = steps.filter(step => ACTIONABLE.has(step?.status));
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return {
    total,
    completed,
    percent,
    pendingCount: pending.length,
    pending: pending.map(step => ({ id: step.id, status: step.status, message: step.message || '' })),
    exportReady: Boolean(plan.canExport) && pending.length === 0
  };
}

export function productionProgressText(summary = {}) {
  const percent = Math.max(0, Math.min(100, Number(summary.percent) || 0));
  if (summary.exportReady) return `制作進捗 ${percent}%｜MP4出力へ進めます`;
  if (summary.pendingCount) return `制作進捗 ${percent}%｜残り ${summary.pendingCount}工程`;
  return `制作進捗 ${percent}%`;
}
