import { getProject, saveProject } from './db.js';
import { buildProductionPlan } from './productionPipeline.js';
import { summarizeProductionProgress, productionProgressText } from './productionProgress.js';
import { nextProductionDestination, preflightNavigation } from './productionNavigator.js';
import { summarizeProductionTiming, formatProductionTiming } from './productionTimingSummary.js';
import { goProject, goScenes, goBgm, goOutput, goPublish } from './router.js';

const app = document.querySelector('#app');
let installing = false;

function projectIdFromHash() {
  const match = location.hash.match(/^#\/project\/([^/]+)(?:\/|$)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function navigate(projectId, route) {
  if (route === 'scenes') return goScenes(projectId);
  if (route === 'narration') { location.href = `./voice-lab.html?project=${encodeURIComponent(projectId)}`; return; }
  if (route === 'bgm') return goBgm(projectId);
  if (route === 'publish') return goPublish(projectId);
  if (route === 'output') return goOutput(projectId);
  return goProject(projectId);
}

function stepLabel(step) {
  const labels = { scenes:'Scene構成', autofill:'安全な自動補完', images:'画像素材', narration:'ナレーション', duration:'尺調整', preflight:'完成前チェック' };
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
      <p class="notice">現在地をOSが判定し、次に必要な工程へ案内します。既存の手動設定は上書きしません。</p>
      <div data-production-progress></div>
      <div class="actions"><button type="button" class="primary" data-run-pipeline>制作を整理して次へ</button><button type="button" data-review-pipeline>状況を更新</button></div>
      <div data-preflight-links></div>
      <pre data-pipeline-result style="white-space:pre-wrap"></pre>`;
    main.prepend(section);
    const output = section.querySelector('[data-pipeline-result]');
    const progress = section.querySelector('[data-production-progress]');
    const links = section.querySelector('[data-preflight-links]');

    const render = current => {
      const plan = buildProductionPlan(current);
      const summary = summarizeProductionProgress(plan);
      const next = nextProductionDestination(current);
      const timing = summarizeProductionTiming(current.productionTimingLog);
      progress.innerHTML = `<p><strong>${productionProgressText(summary)}</strong></p><progress max="100" value="${summary.percent}" style="width:100%"></progress><p class="muted">${formatProductionTiming(timing)}</p>`;
      output.textContent = `${plan.steps.map(stepLabel).join('\n')}\n\n次：${next.label}`;
      const issues = preflightNavigation(current);
      links.innerHTML = issues.length ? `<p><strong>修正が必要な項目</strong></p>${issues.map((issue,index)=>`<button type="button" data-fix-index="${index}">${issue.message}</button>`).join('')}` : '';
      links.querySelectorAll('[data-fix-index]').forEach(button => {
        button.onclick = () => navigate(projectId, issues[Number(button.dataset.fixIndex)]?.route);
      });
      return { plan, next };
    };

    render(project);
    section.querySelector('[data-review-pipeline]').onclick = async () => {
      const current = await getProject(projectId);
      if (current) render(current);
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
        const latest = await getProject(projectId) || plan.project;
        const state = render(latest);
        setTimeout(() => navigate(projectId, state.next.route), 250);
      } catch (error) {
        console.error(error);
        output.textContent = `半自動制作を進められませんでした：${error?.message || error}`;
      } finally { button.disabled = false; }
    };
  } finally { installing = false; }
}

const observer = new MutationObserver(() => void install());
if (app) observer.observe(app, { childList:true, subtree:true });
window.addEventListener('hashchange', () => queueMicrotask(install));
void install();
