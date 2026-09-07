function safeText(value) {
  const text = String(value ?? '').trim();
  return text.startsWith('data:') || text.startsWith('blob:') ? '' : text;
}

export function createAiLearningSignature(decisions = [], decisionTypes = []) {
  const allowed = new Set(Array.isArray(decisionTypes) ? decisionTypes : []);
  const source = Array.isArray(decisions) ? decisions : [];
  return source
    .filter(record => allowed.has(record?.decisionType))
    .map(record => JSON.stringify([
      safeText(record?.decisionType),
      safeText(record?.id),
      safeText(record?.projectId),
      safeText(record?.sceneId),
      safeText(record?.timestamp),
      safeText(record?.humanAction?.type),
      safeText(record?.finalDecision?.motion ?? record?.finalDecision?.transition)
    ]))
    .join('|');
}

export function createAiSuggestionRuntimeCache() {
  let signature = null;
  let value = null;
  return {
    get(nextSignature, createValue) {
      const normalized = String(nextSignature ?? '');
      if (signature === normalized && value !== null) return value;
      value = typeof createValue === 'function' ? createValue() : null;
      signature = normalized;
      return value;
    },
    clear() {
      signature = null;
      value = null;
    }
  };
}
