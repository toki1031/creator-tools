import { isSupportedProductionSuggestionType } from './productionSuggestionTypes.js';

export function createProductionSuggestion(type, payload, evidence = {}) {
  if (!isSupportedProductionSuggestionType(type)) return null;
  return {
    type,
    advisoryOnly: true,
    payload: payload && typeof payload === 'object' ? { ...payload } : {},
    evidence: {
      decisionCount: Math.max(0, Number(evidence.decisionCount) || 0),
      projectCount: Math.max(0, Number(evidence.projectCount) || 0),
      accuracy: Number.isFinite(Number(evidence.accuracy)) ? Number(evidence.accuracy) : null
    }
  };
}
