import { listProjects } from './db.js';
import { createLocalLearningCorpus } from './localLearningCorpus.js';
import { buildProjectImageVisualFeatureIndex } from './projectImageVisualFeatureIndex.js';
import { decodeImageDataUrlForFeatures } from './browserImageFeatureDecoder.js';
import { createSceneImageVisualPairwiseTrainingSet } from './sceneImageVisualPairwiseTraining.js';
import { evaluateSceneImageVisualRanker } from './sceneImageVisualRankerEvaluation.js';
import { assessSceneImageSuggestionReadiness } from './sceneImageSuggestionReadiness.js';
import { trainSceneImageVisualRanker, rankSceneImageVisualCandidates } from './sceneImageVisualRanker.js';
import { createImageAiRuntimeSignature } from './imageAiRuntimeSignature.js';
import { rankProjectAssetsForScene } from './assetSearch.js';

const MIN_BASE_PAIRS = 5;
const MIN_PROJECTS = 3;
let scheduled = false;
let running = false;
let lastSignature = '';
let cachedPromise = null;

function currentProjectId() {
  const match = location.hash.match(/#\/project\/([^/]+)\/scenes/);
  return match ? decodeURIComponent(match[1]) : '';
}

function noteFor(card) {
  let note = card.querySelector('[data-image-ai-suggestion]');
  if (!note) {
    note = document.createElement('small');
    note.dataset.imageAiSuggestion = 'true';
    note.className = 'ai-suggestion-note';
    const control = card.querySelector('.scene-image-control');
    (control || card.querySelector('.scene-settings') || card).appendChild(note);
  }
  return note;
}

function setNoteText(note, text) {
  if (note.textContent !== text) note.textContent = text;
}

function setNotes(text) {
  document.querySelectorAll('.scene-card').forEach(card => { setNoteText(noteFor(card), text); });
}

function baseEvidence(decisions) {
  const relevant = decisions.filter(record => record?.decisionType === 'scene-image-selection');
  const projects = new Set(relevant.map(record => String(record?.projectId || '').trim()).filter(Boolean));
  let pairs = 0;
  for (const record of relevant) {
    const chosen = String(record?.finalDecision?.assetId || record?.finalDecision?.selectedAssetId || '').trim();
    const alternatives = Array.isArray(record?.alternatives) ? record.alternatives : [];
    if (chosen) pairs += alternatives.filter(value => String(value?.assetId ?? value ?? '').trim() && String(value?.assetId ?? value ?? '').trim() !== chosen).length;
  }
  return { pairs, projects: projects.size };
}

async function buildRuntime(projects, decisions) {
  const featureIndex = await buildProjectImageVisualFeatureIndex(
    projects,
    dataUrl => decodeImageDataUrlForFeatures(dataUrl, { maxDimension: 128, timeoutMs: 5000 }),
    { maxAssets: 50, maxSamples: 4096 }
  );
  const trainingSet = createSceneImageVisualPairwiseTrainingSet(decisions, featureIndex);
  const evaluation = evaluateSceneImageVisualRanker(trainingSet.examples);
  const readiness = assessSceneImageSuggestionReadiness(evaluation);
  const model = readiness.ready ? trainSceneImageVisualRanker(trainingSet.examples) : null;
  return { featureIndex, trainingSet, evaluation, readiness, model };
}

function assetName(project, assetId) {
  const asset = (project?.mediaLibrary || []).find(item => item?.id === assetId);
  return asset?.fileName || asset?.name || '画像素材';
}

function localMatchText(project, scene, fallbackText) {
  const best = rankProjectAssetsForScene(project, scene, { limit: 1 })[0];
  if (!best) return fallbackText;
  if (best.assetId === scene?.imageAssetId) return '素材候補：現在の画像と一致（ローカル照合）';
  return `素材候補：${assetName(project, best.assetId)}（ローカル照合）`;
}

function renderLocalMatches(project, learningText) {
  document.querySelectorAll('.scene-card').forEach(card => {
    const index = Number(card.dataset.index);
    const scene = project.scenes?.[index];
    setNoteText(noteFor(card), localMatchText(project, scene, learningText));
  });
}

async function render() {
  const projectId = currentProjectId();
  if (!projectId || !document.querySelector('[data-image]')) return;
  if (running) return;
  running = true;
  try {
    const projects = await listProjects();
    const project = projects.find(item => item?.id === projectId);
    if (!project) return;
    const corpus = createLocalLearningCorpus(projects);
    const evidence = baseEvidence(corpus.decisions);
    if (evidence.pairs < MIN_BASE_PAIRS || evidence.projects < MIN_PROJECTS) {
      renderLocalMatches(project, `AI画像提案：学習中（${evidence.pairs}件・${evidence.projects}プロジェクト）`);
      return;
    }

    const key = createImageAiRuntimeSignature(projects, corpus.decisions);
    if (!cachedPromise || key !== lastSignature) {
      lastSignature = key;
      cachedPromise = buildRuntime(projects, corpus.decisions).catch(error => {
        cachedPromise = null;
        throw error;
      });
    }
    const runtime = await cachedPromise;
    if (!runtime.readiness.ready || !runtime.model) {
      renderLocalMatches(project, `AI画像提案：学習中（${runtime.trainingSet.examples.length}件・${runtime.evaluation.summary.evaluatedProjects}プロジェクト）`);
      return;
    }

    document.querySelectorAll('.scene-card').forEach(card => {
      const index = Number(card.dataset.index);
      const scene = project.scenes?.[index];
      const scoped = runtime.featureIndex.projectsById?.[projectId] || {};
      const candidates = (project.mediaLibrary || [])
        .filter(asset => asset?.type === 'image' && scoped[asset.id])
        .map(asset => ({ assetId: asset.id, visualFeatures: scoped[asset.id] }));
      const ranked = rankSceneImageVisualCandidates(runtime.model, candidates);
      const best = ranked[0];
      const note = noteFor(card);
      if (!best) setNoteText(note, localMatchText(project, scene, 'AI画像提案：候補を分析できません'));
      else if (best.assetId === scene?.imageAssetId) setNoteText(note, 'AI画像提案：現在の画像と一致');
      else setNoteText(note, `AI画像提案：${assetName(project, best.assetId)}`);
    });
  } catch (error) {
    console.warn('Image AI suggestion unavailable:', error);
    setNotes('AI画像提案：現在利用できません');
  } finally {
    running = false;
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; void render(); });
}

const observer = new MutationObserver(mutations => {
  if (mutations.some(mutation => [...mutation.addedNodes].some(node => node?.nodeType === 1 && (node.matches?.('.scene-card') || node.querySelector?.('.scene-card'))))) schedule();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
schedule();
