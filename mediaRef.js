function clean(value = '') {
  return String(value ?? '').trim();
}

const KINDS = new Set(['image', 'audio', 'video', 'other']);

export function createMediaRef({ id, kind = 'other', mimeType = '', sizeBytes = 0 } = {}) {
  const refId = clean(id);
  if (!refId) return null;
  const normalizedKind = KINDS.has(clean(kind)) ? clean(kind) : 'other';
  const size = Number(sizeBytes);
  return {
    id: refId,
    kind: normalizedKind,
    mimeType: clean(mimeType),
    sizeBytes: Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0
  };
}

export function isMediaRef(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    clean(value.id) &&
    KINDS.has(clean(value.kind)) &&
    Number.isFinite(Number(value.sizeBytes)) &&
    Number(value.sizeBytes) >= 0
  );
}

export function isEmbeddedDataUrl(value, expectedPrefix = 'data:') {
  const data = clean(value);
  return Boolean(data && data.startsWith(clean(expectedPrefix) || 'data:'));
}

export async function readMediaDual({
  embeddedData = '',
  mediaRef = null,
  resolveMedia
} = {}) {
  const legacy = clean(embeddedData);
  if (isEmbeddedDataUrl(legacy)) {
    return { status: 'resolved', source: 'embedded', data: legacy, mediaRef: isMediaRef(mediaRef) ? mediaRef : null };
  }

  if (!isMediaRef(mediaRef)) {
    return { status: 'missing', source: 'none', data: '', mediaRef: null, reason: '利用可能なメディアがありません' };
  }

  if (typeof resolveMedia !== 'function') {
    return { status: 'missing', source: 'media-ref', data: '', mediaRef, reason: 'MediaRefの読み出し機能がありません' };
  }

  try {
    const resolved = await resolveMedia(mediaRef);
    const data = typeof resolved === 'string' ? clean(resolved) : clean(resolved?.data);
    if (!isEmbeddedDataUrl(data)) {
      return { status: 'missing', source: 'media-ref', data: '', mediaRef, reason: 'MediaRefのデータを読み出せません' };
    }
    return { status: 'resolved', source: 'media-ref', data, mediaRef };
  } catch (error) {
    return {
      status: 'error',
      source: 'media-ref',
      data: '',
      mediaRef,
      reason: clean(error?.message) || 'MediaRefの読み出しに失敗しました'
    };
  }
}
