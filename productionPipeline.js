import { splitIntoScenes } from './qualityLogic.js';
import { syncProjectSceneDurationsToNarration } from './productionEfficiency.js';
import { inspectProductionProject } from './productionPreflight.js';
import { safeAutofillProject } from './productionSafeAutofill.js';

export const PRODUCTION_PIPELINE_VERSION = '1.2.1';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function buildProductionPlan(project, options = {}) {
  const source = clone(project || {});
  const script = String(source.script || source.text || '').trim();
  const targetDurationSec = Number(options.targetDurationSec || source.targetDurationSec || 60);
  const steps = [];

  if (!Array.isArray(source.scenes) || !source.scenes.length) {
    if (script) {
      source.scenes = splitIntoScenes(script, targetDurationSec);
      steps.push({ id: 'scenes', status: 'prepared', message: `${source.scenes.length} Sceneを構成` });
    } else {
      steps.push({ id: 'scenes', status: 'blocked', message: '台本がありません' });
    }
  } else {
    steps.push({ id: 'scenes', status: 'kept', message: '既存Sceneを維持' });
  }

  const autofilled = safeAutofillProject(source);
  const prepared = autofilled.project;
  steps.push({
    id: 'autofill',
    status: autofilled.changedFields ? 'prepared' : 'kept',
    count: autofilled.changedFields,
    message: autofilled.changedFields ? `${autofilled.changedScenes} Sceneの不足設定を補完候補化` : '字幕・読み上げ・基本演出は設定済み'
  });

  const missingImages = (prepared.scenes || []).filter(scene => !scene.imageAssetId && !scene.imageData).length;
  steps.push({ id: 'images', status: missingImages ? 'needs-input' : 'ready', count: missingImages, message: missingImages ? `画像未設定 ${missingImages} Scene` : '画像準備済み' });

  const missingNarration = (prepared.scenes || []).filter(scene => !scene?.narration?.audioData).length;
  steps.push({ id: 'narration', status: missingNarration ? 'needs-generation' : 'ready', count: missingNarration, message: missingNarration ? `音声未生成 ${missingNarration} Scene` : '音声準備済み' });

  const synced = syncProjectSceneDurationsToNarration(prepared);
  const planned = synced.project;
  steps.push({ id: 'duration', status: synced.changed ? 'prepared' : 'kept', count: synced.changed, message: synced.changed ? `${synced.changed} Sceneを音声尺へ調整候補化` : 'Scene尺変更なし' });

  const report = inspectProductionProject(planned);
  steps.push({ id: 'preflight', status: report.errors ? 'blocked' : report.warnings ? 'review' : 'ready', errors: report.errors, warnings: report.warnings, message: `要修正 ${report.errors} / 確認 ${report.warnings}` });

  return {
    version: PRODUCTION_PIPELINE_VERSION,
    project: planned,
    steps,
    canExport: report.errors === 0,
    requiresHumanInput: steps.some(step => ['blocked', 'needs-input', 'needs-generation', 'review'].includes(step.status))
  };
}

export function nextProductionAction(plan) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  return steps.find(step => ['blocked', 'needs-input', 'needs-generation', 'review'].includes(step.status)) || { id: 'output', status: 'ready', message: 'MP4出力へ進めます' };
}
