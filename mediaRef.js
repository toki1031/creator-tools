export const MEDIA_REF_VERSION = 1;

const MEDIA_KINDS = new Set(['image', 'scene-narration', 'bgm', 'narration', 'video']);

const cleanString = value => typeof value === 'string' ? value.trim() : '';
const cleanBytes = value => {
  const bytes = Number(value);
  return Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes) : 0;
};

export function isMediaRef(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.version === MEDIA_REF_VERSION &&
    cleanString(value.id) &&
    MEDIA_KINDS.has(value.kind)
  );
}

export function createMediaRef({ id, kind, mimeType = '', bytes = 0, fileName = '' } = {}) {
  const normalizedId = cleanString(id);
  if (!normalizedId) throw new Error('MediaRef id がありません。');
  if (!MEDIA_KINDS.has(kind)) throw new Error('MediaRef kind が不正です。');
  return {
    version: MEDIA_REF_VERSION,
    id: normalizedId,
    kind,
    mimeType: cleanString(mimeType),
    bytes: cleanBytes(bytes),
    fileName: cleanString(fileName)
  };
}

export function normalizeMediaRef(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    return createMediaRef(value);
  } catch {
    return null;
  }
}

export function chooseMediaSource({ mediaRef, legacyData } = {}) {
  const ref = normalizeMediaRef(mediaRef);
  if (ref) return { source: 'ref', ref, legacyData: '' };
  if (typeof legacyData === 'string' && legacyData.startsWith('data:')) {
    return { source: 'legacy', ref: null, legacyData };
  }
  return { source: 'none', ref: null, legacyData: '' };
}

export function mediaRefMatchesKind(value, kind) {
  const ref = normalizeMediaRef(value);
  return Boolean(ref && ref.kind === kind);
}
