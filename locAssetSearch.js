const LOC_SEARCH_ENDPOINT = 'https://www.loc.gov/search/';
const SUPPORTED_TYPES = new Set(['historical-source', 'document']);

function clean(value = '') { return String(value ?? '').trim(); }
function first(value) { return Array.isArray(value) ? value.find(Boolean) ?? '' : value ?? ''; }
function strings(value) { return Array.isArray(value) ? value.map(clean).filter(Boolean) : clean(value) ? [clean(value)] : []; }

export function buildLocSearchUrl(plan, { count = 5 } = {}) {
  if (!plan || plan.status !== 'ready') return '';
  if (!SUPPORTED_TYPES.has(plan.requestedType)) return '';
  const query = clean(plan.queries?.[0]);
  if (!query) return '';
  const url = new URL(LOC_SEARCH_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('fo', 'json');
  url.searchParams.set('c', String(Math.max(1, Math.min(Number(count) || 5, 10))));
  return url.toString();
}

function rightsText(item) {
  return strings([
    ...strings(item?.rights),
    ...strings(item?.item?.rights),
    ...strings(item?.item?.rights_advisory),
    ...strings(item?.item?.access_advisory)
  ]);
}

export function normalizeLocCandidate(item, plan) {
  if (!item || typeof item !== 'object') return null;
  const sourceUrl = clean(item.id || item.url);
  const images = strings(item.image_url);
  const rights = rightsText(item);
  return {
    provider: 'library-of-congress',
    sceneId: clean(plan?.sceneId),
    requestedType: clean(plan?.requestedType),
    title: clean(item.title),
    sourceUrl,
    previewUrl: clean(images[0]),
    date: clean(first(item.date || item.dates)),
    contributors: strings(item.contributor || item.contributors),
    rightsStatements: rights,
    rightsStatus: rights.length ? 'needs-review' : 'needs-review',
    autoAdoptable: false
  };
}

export function normalizeLocResults(payload, plan) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map(item => normalizeLocCandidate(item, plan)).filter(candidate => candidate?.sourceUrl);
}

/**
 * Candidate discovery only. Rights are never auto-approved here.
 * fetchImpl is injectable so tests do not contact external services.
 */
export async function searchLocCandidates(plan, { fetchImpl = globalThis.fetch, count = 5 } = {}) {
  const url = buildLocSearchUrl(plan, { count });
  if (!url) return { status: 'blocked', candidates: [], reason: 'LoC検索対象ではないか、検索計画が未確定です' };
  if (typeof fetchImpl !== 'function') return { status: 'error', candidates: [], reason: '検索機能を利用できません' };
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!response?.ok) return { status: 'error', candidates: [], reason: `LoC API error: ${response?.status ?? 'unknown'}` };
    const payload = await response.json();
    return { status: 'ok', candidates: normalizeLocResults(payload, plan), reason: '' };
  } catch {
    return { status: 'error', candidates: [], reason: 'LoC APIの取得またはJSON解析に失敗しました' };
  }
}
