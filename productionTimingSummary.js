const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function summarizeProductionTiming(entries = []) {
  const clean = (Array.isArray(entries) ? entries : [])
    .filter(entry => entry && typeof entry.stage === 'string' && number(entry.durationMs) >= 0)
    .map(entry => ({ stage: entry.stage, durationMs: number(entry.durationMs) }));
  const byStage = new Map();
  for (const entry of clean) byStage.set(entry.stage, (byStage.get(entry.stage) || 0) + entry.durationMs);
  const stages = [...byStage.entries()].map(([stage,durationMs]) => ({ stage, durationMs })).sort((a,b)=>b.durationMs-a.durationMs);
  return { entryCount: clean.length, totalDurationMs: clean.reduce((sum,e)=>sum+e.durationMs,0), stages };
}

export function productionEfficiencySummary(project = {}) {
  const timing = summarizeProductionTiming(project.productionTimingLog);
  const decisions = Array.isArray(project?.learning?.decisions) ? project.learning.decisions : [];
  return {
    projectId: String(project.id || ''),
    genre: String(project.genre || ''),
    platform: String(project.platform || ''),
    totalDurationMs: timing.totalDurationMs,
    stageCount: timing.stages.length,
    stages: timing.stages,
    decisionCount: decisions.length,
    sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0
  };
}

export function formatProductionTiming(summary = {}) {
  if (!summary.entryCount) return '制作時間ログ：まだありません';
  const totalMin = Math.round((summary.totalDurationMs / 60000) * 10) / 10;
  const rows = summary.stages.map(row => `${row.stage} ${Math.round(row.durationMs/6000)/10}分`);
  return `制作時間 合計 ${totalMin}分｜${rows.join(' / ')}`;
}
