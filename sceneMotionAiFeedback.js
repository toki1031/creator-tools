const MOTION_LABELS = new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right']);

function cleanText(value) {
  const text = String(value ?? '').trim();
  if (!text || text.startsWith('data:') || text.startsWith('blob:')) return '';
  return text;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function createSceneMotionAiFeedbackRecord(input = {}) {
  const decisionId = cleanText(input.decisionId);
  const projectId = cleanText(input.projectId);
  const sceneId = cleanText(input.sceneId);
  const timestamp = cleanText(input.timestamp);
  const suggested = cleanText(input.suggestedMotion);
  const finalMotion = cleanText(input.finalMotion);

  if (!decisionId || !projectId || !sceneId || !timestamp) return null;
  if (!MOTION_LABELS.has(suggested) || !MOTION_LABELS.has(finalMotion)) return null;
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
    decisionType: 'scene-motion-ai-feedback',
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
      motion: suggested,
      model: {
        version: cleanText(model.version),
        trainingExamples
      }
    },
    finalDecision: {
      motion: finalMotion
    },
    humanAction: {
      type: suggested === finalMotion ? 'accepted' : 'corrected'
    },
    source: {
      type: 'human',
      feature: 'scene-motion-ai-feedback',
      version: '0.49'
    },
    timestamp
  };
}
