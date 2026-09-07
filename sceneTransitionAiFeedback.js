const TRANSITION_LABELS = new Set(['fade', 'cut']);

function cleanText(value) {
  const text = String(value ?? '').trim();
  if (!text || text.startsWith('data:') || text.startsWith('blob:')) return '';
  return text;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function createSceneTransitionAiFeedbackRecord(input = {}) {
  const decisionId = cleanText(input.decisionId);
  const projectId = cleanText(input.projectId);
  const sceneId = cleanText(input.sceneId);
  const timestamp = cleanText(input.timestamp);
  const suggested = cleanText(input.suggestedTransition);
  const finalTransition = cleanText(input.finalTransition);

  if (!decisionId || !projectId || !sceneId || !timestamp) return null;
  if (!TRANSITION_LABELS.has(suggested) || !TRANSITION_LABELS.has(finalTransition)) return null;
  if (input.humanConfirmed !== true) return null;

  const context = input.context || {};
  const model = input.model || {};
  const sceneIndex = Number.isInteger(Number(context.sceneIndex)) && Number(context.sceneIndex) >= 0
    ? Number(context.sceneIndex)
    : null;
  const durationSec = finiteNumber(context.durationSec);
  const trainingExamples = Number.isInteger(Number(model.trainingExamples)) && Number(model.trainingExamples) >= 0
    ? Number(model.trainingExamples)
    : null;

  return {
    id: decisionId,
    decisionType: 'scene-transition-ai-feedback',
    projectId,
    sceneId,
    context: {
      sceneText: cleanText(context.sceneText),
      sceneIndex,
      durationSec,
      platform: cleanText(context.platform),
      aspectRatio: cleanText(context.aspectRatio)
    },
    proposal: {
      transition: suggested,
      model: {
        version: cleanText(model.version),
        trainingExamples
      }
    },
    finalDecision: {
      transition: finalTransition
    },
    humanAction: {
      type: suggested === finalTransition ? 'accepted' : 'corrected'
    },
    source: {
      type: 'human',
      feature: 'scene-transition-ai-feedback',
      version: '0.50'
    },
    timestamp
  };
}
