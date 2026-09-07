import { getProject, listProjects, queueProjectDecision } from './db.js';
import { readRoute } from './router.js';
import { createLocalLearningCorpus } from './localLearningCorpus.js';
import { createAiEnhancedTrainingSet } from './aiFeedbackTrainingData.js';
import { createSceneTransitionAiFeedbackRecord } from './sceneTransitionAiFeedback.js';
import { trainSceneTransitionModel, predictSceneTransition } from './sceneTransitionModel.js';
import { evaluateAiSuggestionOutcomes } from './aiSuggestionOutcomeEvaluation.js';
import { summarizeAiSuggestionEvidence } from './aiSuggestionQualityEvidence.js';

const LABEL_TEXT = {
  fade: 'フェード',
  cut: 'カット'
};

let scheduled = false;

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    void renderSceneTransitionSuggestions();
  });
}

function decisionId() {
  return String(globalThis.crypto?.randomUUID?.() || `scene-transition-ai-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function clearAiProposal(select) {
  delete select.dataset.aiSuggestedTransition;
  delete select.dataset.aiModelVersion;
  delete select.dataset.aiTrainingExamples;
  delete select.dataset.aiSceneId;
  delete select.dataset.aiSceneText;
  delete select.dataset.aiDurationSec;
  delete select.dataset.aiPlatform;
  delete select.dataset.aiAspectRatio;
  delete select.dataset.aiProposalKey;
  delete select.dataset.aiFeedbackConsumed;
}

function attachAiProposal(select, { label, model, examples, scene, index, project }) {
  const proposalKey = JSON.stringify([
    label,
    model?.modelVersion || '',
    Number(model?.totalExamples ?? examples.length),
    String(scene?.id || ''),
    String(scene?.text || ''),
    Number(scene?.durationSec),
    index,
    String(project?.platform || ''),
    String(project?.aspectRatio || '')
  ]);
  if (select.dataset.aiProposalKey !== proposalKey) {
    select.dataset.aiProposalKey = proposalKey;
    select.dataset.aiFeedbackConsumed = '0';
  }
  select.dataset.aiSuggestedTransition = label;
  select.dataset.aiModelVersion = String(model?.modelVersion || '');
  select.dataset.aiTrainingExamples = String(Number(model?.totalExamples ?? examples.length));
  select.dataset.aiSceneId = String(scene?.id || '');
  select.dataset.aiSceneText = String(scene?.text || '');
  select.dataset.aiDurationSec = Number.isFinite(Number(scene?.durationSec)) ? String(Number(scene.durationSec)) : '';
  select.dataset.aiPlatform = String(project?.platform || '');
  select.dataset.aiAspectRatio = String(project?.aspectRatio || '');
}

function captureHumanTransitionFeedback(event) {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement) || !select.matches('[data-transition]')) return;
  if (select.dataset.aiFeedbackConsumed === '1') return;

  const route = readRoute();
  if (route?.page !== 'scenes' || !route?.id) return;
  const suggestedTransition = select.dataset.aiSuggestedTransition;
  if (!suggestedTransition) return;

  const record = createSceneTransitionAiFeedbackRecord({
    decisionId: decisionId(),
    projectId: route.id,
    sceneId: select.dataset.aiSceneId,
    timestamp: new Date().toISOString(),
    suggestedTransition,
    finalTransition: select.value,
    humanConfirmed: true,
    context: {
      sceneText: select.dataset.aiSceneText,
      sceneIndex: Number(select.dataset.transition),
      durationSec: select.dataset.aiDurationSec,
      platform: select.dataset.aiPlatform,
      aspectRatio: select.dataset.aiAspectRatio
    },
    model: {
      version: select.dataset.aiModelVersion,
      trainingExamples: select.dataset.aiTrainingExamples
    }
  });
  if (!record) return;
  if (queueProjectDecision(route.id, record)) select.dataset.aiFeedbackConsumed = '1';
}

async function renderSceneTransitionSuggestions() {
  const route = readRoute();
  if (route?.page !== 'scenes' || !route?.id) return;

  const selects = [...document.querySelectorAll('[data-transition]')];
  if (!selects.length) return;

  const [project, projects] = await Promise.all([getProject(route.id), listProjects()]);
  if (!project) return;

  const corpus = createLocalLearningCorpus(projects);
  const trainingSet = createAiEnhancedTrainingSet(corpus.decisions, 'scene-transition');
  const examples = trainingSet.examples;
  const labels = new Set(examples.map(example => example.label));
  const contributingProjects = new Set(examples.map(example => example.projectId)).size;
  const evaluation = evaluateAiSuggestionOutcomes(corpus.decisions, 'scene-transition');
  const evidence = summarizeAiSuggestionEvidence(evaluation);
  const ready = examples.length >= 5 && labels.size >= 2 && evidence.hasEnoughEvidence;
  const model = ready ? trainSceneTransitionModel(examples) : null;

  for (const select of selects) {
    const index = Number(select.dataset.transition);
    const scene = project?.scenes?.[index];
    if (!scene) continue;

    const host = select.closest('label') || select.parentElement;
    if (!host) continue;

    let note = host.querySelector('.scene-transition-ai-suggestion');
    if (!note) {
      note = document.createElement('small');
      note.className = 'scene-transition-ai-suggestion muted';
      note.style.display = 'block';
      note.style.marginTop = '4px';
      host.appendChild(note);
    }

    if (!ready) {
      clearAiProposal(select);
      note.textContent = `AI提案：学習中（${examples.length}件・${contributingProjects}プロジェクト）`;
      continue;
    }

    const prediction = predictSceneTransition(model, {
      sceneText: scene.text || '',
      sceneIndex: index,
      durationSec: scene.durationSec,
      platform: project.platform || '',
      aspectRatio: project.aspectRatio || ''
    });
    const label = prediction.label;
    attachAiProposal(select, { label, model, examples, scene, index, project });
    const text = LABEL_TEXT[label] || label;
    note.textContent = select.value === label ? 'AI提案：現在の設定と一致' : `AI提案：${text}`;
  }
}

document.addEventListener('change', captureHumanTransitionFeedback, true);
const app = document.querySelector('#app');
if (app && typeof MutationObserver === 'function') {
  new MutationObserver(scheduleRender).observe(app, { childList: true, subtree: true });
}
window.addEventListener('hashchange', scheduleRender);
window.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
scheduleRender();
