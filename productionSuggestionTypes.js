export const PRODUCTION_SUGGESTION_TYPES = Object.freeze([
  'scene-structure',
  'scene-image-selection',
  'scene-motion',
  'scene-transition',
  'bgm-selection'
]);

export function isSupportedProductionSuggestionType(value) {
  return PRODUCTION_SUGGESTION_TYPES.includes(String(value || ''));
}
