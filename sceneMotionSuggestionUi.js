import { getProject, listProjects } from './db.js';
import { readRoute } from './router.js';
import { createLocalLearningCorpus } from './localLearningCorpus.js';
import { createAiEnhancedTrainingSet } from './aiFeedbackTrainingData.js';
import { trainSceneMotionModel, predictSceneMotion } from './sceneMotionModel.js';
import { evaluateAiSuggestionOutcomes } from './aiSuggestionOutcomeEvaluation.js';
import { summarizeAiSuggestionEvidence } from './aiSuggestionQualityEvidence.js';

const LABEL_TEXT = {
  'none': 'なし',
  'zoom-in': 'ズームイン',
  'zoom-out': 'ズームアウト',
  'pan-left': '左へパン',
  'pan-right': '右へパン'
};

let scheduled = false;

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    void renderSceneMotionSuggestions();
  });
}

async function renderSceneMotionSuggestions() {
  const route = readRoute();
  if (route?.page !== 'scenes' || !route?.id) return;

  const selects = [...document.querySelectorAll('[data-motion]')];
  if (!selects.length) return;

  const [project, projects] = await Promise.all([getProject(route.id), listProjects()]);
  if (!project) return;

  const corpus = createLocalLearningCorpus(projects);
  const trainingSet = createAiEnhancedTrainingSet(corpus.decisions, 'scene-motion');
  const examples = trainingSet.examples;
  const labels = new Set(examples.map(example => example.label));
  const contributingProjects = new Set(examples.map(example => example.projectId)).size;
  const evaluation = evaluateAiSuggestionOutcomes(corpus.decisions, 'scene-motion');
  const evidence = summarizeAiSuggestionEvidence(evaluation);
  const ready = examples.length >= 5 && labels.size >= 2 && evidence.hasEnoughEvidence;
  const model = ready ? trainSceneMotionModel(examples) : null;

  for (const select of selects) {
    const index = Number(select.dataset.motion);
    const scene = project?.scenes?.[index];
    if (!scene) continue;

    const host = select.closest('label') || select.parentElement;
    if (!host) continue;

    let note = host.querySelector('.scene-motion-ai-suggestion');
    if (!note) {
      note = document.createElement('small');
      note.className = 'scene-motion-ai-suggestion muted';
      note.style.display = 'block';
      note.style.marginTop = '4px';
      host.appendChild(note);
    }

    if (!ready) {
      note.textContent = `AI提案：学習中（${examples.length}件・${contributingProjects}プロジェクト）`;
      continue;
    }

    const prediction = predictSceneMotion(model, {
      sceneText: scene.text || '',
      sceneIndex: index,
      durationSec: scene.durationSec,
      platform: project.platform || '',
      aspectRatio: project.aspectRatio || ''
    });
    const label = prediction.label;
    const text = LABEL_TEXT[label] || label;
    note.textContent = select.value === label ? 'AI提案：現在の設定と一致' : `AI提案：${text}`;
  }
}

const app = document.querySelector('#app');
if (app && typeof MutationObserver === 'function') {
  new MutationObserver(scheduleRender).observe(app, { childList: true, subtree: true });
}
window.addEventListener('hashchange', scheduleRender);
window.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
scheduleRender();
