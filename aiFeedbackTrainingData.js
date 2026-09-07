import { createSceneMotionTrainingSet } from './sceneMotionTrainingData.js';
import { createSceneTransitionTrainingSet } from './sceneTransitionTrainingData.js';

const BLOCKED_URL = /^(?:data|blob):/i;
const CONFIG = {
  'scene-motion': {
    feedbackType: 'scene-motion-ai-feedback',
    labels: new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']),
    finalKey: 'motion',
    createBase: createSceneMotionTrainingSet
  },
  'scene-transition': {
    feedbackType: 'scene-transition-ai-feedback',
    labels: new Set(['fade', 'cut']),
    finalKey: 'transition',
    createBase: createSceneTransitionTrainingSet
  }
};

function safeString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return BLOCKED_URL.test(text) ? '' : text;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactContext(record) {
  const source = record?.context && typeof record.context === 'object' ? record.context : {};
  return {
    sceneText: safeString(source.sceneText),
    sceneIndex: finiteOrNull(source.sceneIndex),
    durationSec: finiteOrNull(source.durationSec),
    platform: safeString(source.platform),
    aspectRatio: safeString(source.aspectRatio)
  };
}

function exampleSignature(example = {}) {
  const context = example.context || {};
  return JSON.stringify([
    safeString(example.projectId),
    safeString(example.sceneId),
    safeString(example.label),
    safeString(context.sceneText),
    finiteOrNull(context.sceneIndex),
    finiteOrNull(context.durationSec),
    safeString(context.platform),
    safeString(context.aspectRatio)
  ]);
}

export function createAiFeedbackExamples(decisions = [], decisionType) {
  const config = CONFIG[decisionType];
  if (!config) return [];
  const source = Array.isArray(decisions) ? decisions : [];
  const examples = [];

  for (const record of source) {
    if (record?.decisionType !== config.feedbackType) continue;
    const action = safeString(record?.humanAction?.type);
    if (action !== 'accepted' && action !== 'corrected') continue;
    const label = safeString(record?.finalDecision?.[config.finalKey]);
    if (!config.labels.has(label)) continue;
    const decisionId = safeString(record?.id);
    const projectId = safeString(record?.projectId);
    const sceneId = safeString(record?.sceneId);
    if (!decisionId || !projectId || !sceneId) continue;
    examples.push({
      decisionId,
      projectId,
      sceneId,
      context: compactContext(record),
      label,
      feedback: action
    });
  }
  return examples;
}

export function createAiEnhancedTrainingSet(decisions = [], decisionType) {
  const config = CONFIG[decisionType];
  if (!config) return { trainingSetVersion: '0.56', decisionType: decisionType || '', baseExamples: 0, feedbackExamples: 0, deduplicatedFeedbackExamples: 0, examples: [] };
  const source = Array.isArray(decisions) ? decisions : [];
  const base = config.createBase(source).examples;
  const feedback = createAiFeedbackExamples(source, decisionType);
  const baseSignatures = new Set(base.map(exampleSignature));
  const uniqueFeedback = feedback.filter(example => !baseSignatures.has(exampleSignature(example)));
  return {
    trainingSetVersion: '0.56',
    decisionType,
    baseExamples: base.length,
    feedbackExamples: uniqueFeedback.length,
    deduplicatedFeedbackExamples: feedback.length - uniqueFeedback.length,
    examples: [...base, ...uniqueFeedback]
  };
}

export function createCreatorAiEnhancedTrainingSets(decisions = []) {
  return {
    trainingSetVersion: '0.56',
    motion: createAiEnhancedTrainingSet(decisions, 'scene-motion'),
    transition: createAiEnhancedTrainingSet(decisions, 'scene-transition')
  };
}
