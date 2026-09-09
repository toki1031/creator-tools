const FORBIDDEN_KEYS = new Set(['audioData','imageData','dataUrl','rawPixels','blob']);

export function hasUnsafeProductionSuggestionPayload(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (child && typeof child === 'object' && hasUnsafeProductionSuggestionPayload(child)) return true;
  }
  return false;
}
