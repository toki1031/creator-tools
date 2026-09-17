const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function clean(value = '') {
  return String(value ?? '').trim();
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(clean(value));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function defaultBlobToDataUrl(blob) {
  if (typeof FileReader === 'undefined') throw new Error('この環境では画像データを変換できません');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('画像データを変換できません'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchAssetImage(plan, {
  fetchImpl = globalThis.fetch,
  blobToDataUrl = defaultBlobToDataUrl,
  maxBytes = DEFAULT_MAX_BYTES,
  signal
} = {}) {
  if (plan?.status !== 'ready') return { status: 'blocked', reason: '採用プランがreadyではありません' };
  const candidate = plan?.candidate || {};
  const imageUrl = safeHttpsUrl(candidate.previewUrl || candidate.imageUrl || candidate.thumbnailUrl);
  if (!imageUrl) return { status: 'blocked', reason: '安全なHTTPS画像URLがありません' };
  if (typeof fetchImpl !== 'function') return { status: 'error', reason: '画像取得機能を利用できません' };

  try {
    const response = await fetchImpl(imageUrl, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response?.ok) return { status: 'error', reason: `画像取得に失敗しました (${response?.status || 'network'})` };
    const type = clean(response.headers?.get?.('content-type')).toLowerCase().split(';')[0];
    if (!type.startsWith('image/')) return { status: 'blocked', reason: '取得先が画像ではありません' };

    const declaredSize = Number(response.headers?.get?.('content-length') || 0);
    if (declaredSize > maxBytes) return { status: 'blocked', reason: '画像サイズが上限を超えています' };
    const blob = await response.blob();
    if (!blob || blob.size <= 0) return { status: 'error', reason: '画像データが空です' };
    if (blob.size > maxBytes) return { status: 'blocked', reason: '画像サイズが上限を超えています' };
    const data = await blobToDataUrl(blob);
    if (!clean(data).startsWith('data:image/')) return { status: 'error', reason: '画像データへの変換に失敗しました' };

    return {
      status: 'resolved',
      asset: {
        name: clean(candidate.title) || 'Auto production image',
        data: clean(data),
        previewUrl: imageUrl,
        mimeType: type,
        sizeBytes: blob.size,
        provenance: {
          provider: clean(candidate.provider),
          sourcePage: clean(candidate.sourcePage),
          rights: clean(candidate.rights),
          rightsAdvisory: clean(candidate.rightsAdvisory),
          rightsUrl: clean(candidate.rightsUrl),
          license: clean(candidate.license),
          licenseUrl: clean(candidate.licenseUrl)
        }
      }
    };
  } catch (error) {
    if (error?.name === 'AbortError') return { status: 'aborted', reason: '画像取得が中断されました' };
    return { status: 'error', reason: clean(error?.message) || '画像取得に失敗しました' };
  }
}

export { DEFAULT_MAX_BYTES };
