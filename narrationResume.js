export function normalizeNarrationText(value = '') {
  return String(value).replace(/\r\n?/g, '\n').trim().replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n+/g, '\n');
}

export function createNarrationFingerprint({ text = '', voiceId = '', source = 'kokoro-js-jp' } = {}) {
  return `${source}|${String(voiceId || '').trim()}|${normalizeNarrationText(text)}`;
}

export function canReuseSceneNarration(scene, { text = '', voiceId = '', source = 'kokoro-js-jp' } = {}) {
  const narration = scene?.narration;
  if (!narration?.audioData || !(Number(narration.durationSec) > 0)) return false;
  const expected = createNarrationFingerprint({ text, voiceId, source });
  return narration.fingerprint === expected;
}

export function sceneNarrationStatus(scene, { text = '', voiceId = '', source = 'kokoro-js-jp' } = {}) {
  if (canReuseSceneNarration(scene, { text, voiceId, source })) return 'reusable';
  if (scene?.narration?.audioData) return 'stale';
  return 'missing';
}
