import { appendDecision } from './decisionLog.js';

const text = value => String(value ?? '').trim();

export function getSceneVisualTypeFeedbackState(project, sceneId, typeId) {
  let state = null;
  const decisions = Array.isArray(project?.learning?.decisions) ? project.learning.decisions : [];
  for (const record of decisions) {
    if (record?.decisionType !== 'scene-visual-type-suggestion') continue;
    if (text(record?.sceneId) !== text(sceneId)) continue;
    if (text(record?.proposal?.visualTypeId) !== text(typeId)) continue;
    if (record?.finalDecision?.accepted === true) state = 'accepted';
    if (record?.finalDecision?.accepted === false) state = 'rejected';
  }
  return state;
}

export function recordSceneVisualTypeFeedback(project, { scene, sceneIndex, suggestion, action }, options = {}) {
  const sceneId = text(scene?.id) || `scene-${Number(sceneIndex) + 1}`;
  const normalized = action === 'accept' ? 'accept' : action === 'reject' ? 'reject' : '';
  if (!project || !suggestion?.typeId || !normalized) return null;
  const current = getSceneVisualTypeFeedbackState(project, sceneId, suggestion.typeId);
  if ((normalized === 'accept' && current === 'accepted') || (normalized === 'reject' && current === 'rejected')) return null;
  return appendDecision(project, {
    decisionType:'scene-visual-type-suggestion',
    sceneId,
    context:{ screen:'scene-editor', sceneIndex:Number(sceneIndex), sceneText:text(scene?.text), matchedKeywords:Array.isArray(suggestion.matchedKeywords)?suggestion.matchedKeywords:[], suggestionScore:Number(suggestion.score)||0, platform:text(project.platform), aspectRatio:text(project.aspectRatio) },
    proposal:{ visualTypeId:text(suggestion.typeId), visualTypeLabel:text(suggestion.label), reason:text(suggestion.reason) },
    alternatives:[],
    humanAction:{ type: normalized === 'accept' ? 'accept-scene-visual-type' : 'reject-scene-visual-type' },
    finalDecision:{ accepted: normalized === 'accept', visualTypeId:text(suggestion.typeId) },
    reasonCode:'', reasonNote:'',
    source:{ type:'human', feature:'scene-visual-type-suggestions', version:'0.1' },
    assetIds:[], rights:{}
  }, options);
}
