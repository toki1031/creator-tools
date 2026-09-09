import { getProject, saveProject } from './db.js';
import { buildProductionPlan, nextProductionAction } from './productionPipeline.js';
import { summarizeProductionProgress, productionProgressText } from './productionProgress.js';
import { goProject, goScenes, goBgm, goOutput } from './router.js';

const app = document.querySelector('#app');
let installing = false;

function projectIdFromHash() {
  const match = location.hash.match(/^#\/project\/([^/]+)(?:\/|$)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function routeForAction(projectId, actionId) {
  if (actionId === 'scenes' || actionId === 'images') return () => goScenes(projectId);
  if (actionId === 'narration') return () => goProject(projectId);
  if (actionId === 'preflight') return () => goBgm(projectId);
  return () => goOutput(projectId);
}

function stepLabel(step) {
  const labels = { scenes: 'Scene構成', autofill: '安全な自動補完', images: '画像素材', narration: 'ナレーション', duration: '尺調整', preflight: '完成前チェック' };
  return `${labels[step.id] || step.id}：${step.message}`;
}

async function install() {
  if (!app || installing) return;
  const projectId = projectIdFromHash();
  if (!projectId || app.querySelector('#productionPipelinePanel')) return;
  const main = app.querySelector('main');
  if (!main) return;
  installing = true;
  try {
    const project = await getProject(projectId);
    if (!project || projectIdFromHash() !== projectId) return;
    const section = document.createElement('section');
    section.id = 'productionPipelinePanel';
    section.className = 'card';
    section.innerHTML = `<h2>半自動制作 v1.2</h2>
      <p class="notice">台本から完成までの不足工程をOSが整理します。手動設定は上書きせず、空欄だけを安全に補完します。</p>
      <div data-production-progress></div>
      <div class="actions"><button type="button" class="primary" data-run-pipeline>制作を整理して次へ</button><button type="button" data-review-pipeline>制作状況を見る</button></div>
      <pre data-pipeline-result style="white-space:pre-wrap"></pre>`;
    main.prepend(section);
    const output = section.querySelector('[data-pipeline-result]');
    const progress = section.querySelector('[data-production-progress]');
    const renderPlan = plan => {
      const next = nextProductionAction(plan);
      const summary = summarizeProductionProgress(plan);
      progress.innerHTML = `<p><strong>${productionProgressText(summary)}</strong></p><progress max="100" value="${summary.percent}" style="width:100%"></progress>`;
      output.textContent = `${plan.steps.map(stepLabel).join('\n')}\n\n次：${next.message}`;
      return next;
    };
    renderPlan(buildProductionPlan(project));

    section.querySelector('[data-review-pipeline]').onclick = async () => {
      const current = await getProject(projectId);
      if (current) renderPlan(buildProductionPlan(current));
    };

    section.querySelector('[data-run-pipeline]').onclick = async () => {
      const button = section.querySelector('[data-run-pipeline]');
      button.disabled = true;
      try {
        const current = await getProject(projectId);
        if (!current) return;
        const hadScenes = Array.isArray(current.scenes) && current.scenes.length > 0;
        const plan = buildProductionPlan(current);
        const createdScenes = !hadScenes && Array.isArray(plan.project.scenes) && plan.project.scenes.length > 0;
        const autofillChanged = plan.steps.find(step => step.id === 'autofill')?.status === 'prepared';
        const durationChanged = plan.steps.find(step => step.id === 'duration')?.status === 'prepared';
        if (createdScenes || autofillChanged || durationChanged) {
          plan.project.updatedAt = new Date().toISOString();
          await saveProject(plan.project);
        }
        const next = renderPlan(plan);
        output.textContent += createdScenes ? '\n\nScene構成案を保存しました。' : '';
        output.textContent += autofillChanged ? '\n空欄だった字幕・読み上げ・基本演出を補完しました。' : '';
        output.textContent += durationChanged ? '\n音声実尺に合わせたScene尺を保存しました。' : '';
        setTimeout(routeForAction(projectId, next.id), 250);
      } catch (error) {
        console.error(error);
        output.textContent = `半自動制作を進められませんでした：${error?.message || error}`;
      } finally { button.disabled = false; }
    };
  } finally { installing = false; }
}

const observer = new MutationObserver(() => void install());
if (app) observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(install));
void install();
