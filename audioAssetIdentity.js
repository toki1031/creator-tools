const AUDIO_ASSET_ID_PREFIX = 'audio-sha256:';
const AUDIO_ASSET_ID_PATTERN = /^audio-sha256:[0-9a-f]{64}$/;

function bytesToHex(value) {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : null;
  if (!bytes) return '';
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeAudioAssetId(value) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return AUDIO_ASSET_ID_PATTERN.test(id) ? id : '';
}

export async function createAudioAssetIdFromArrayBuffer(value, { digest } = {}) {
  try {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : null;
    if (!bytes) return '';
    const digestFn = digest || globalThis.crypto?.subtle?.digest?.bind(globalThis.crypto.subtle);
    if (typeof digestFn !== 'function') return '';
    const hashed = await digestFn('SHA-256', bytes);
    const hex = bytesToHex(hashed);
    return hex.length === 64 ? `${AUDIO_ASSET_ID_PREFIX}${hex}` : '';
  } catch {
    return '';
  }
}

export async function createAudioAssetIdFromFile(file, options = {}) {
  try {
    if (!file || typeof file.arrayBuffer !== 'function') return '';
    return await createAudioAssetIdFromArrayBuffer(await file.arrayBuffer(), options);
  } catch {
    return '';
  }
}
