function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value) {
  if (Array.isArray(value)) return value.flatMap(strings).filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings).filter(Boolean);
  const text = clean(value);
  return text ? [text] : [];
}

export function buildLocItemJsonUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'www.loc.gov') return '';
    const match = url.pathname.match(/^\/item\/(.+?)\/?$/);
    if (!match?.[1]) return '';
    url.pathname = `/item/${match[1]}/`;
    url.search = '';
    url.hash = '';
    url.searchParams.set('fo', 'json');
    url.searchParams.set('at', 'item,resources');
    return url.toString();
  } catch {
    return '';
  }
}

export function extractLocRightsMetadata(payload) {
  const item = payload?.item && typeof payload.item === 'object' ? payload.item : {};
  const statements = [
    ...strings(item.rights_advisory),
    ...strings(item.rights_information),
    ...strings(item.rights),
    ...strings(payload?.rights)
  ];
  return [...new Set(statements)];
}

export function classifyLocRightsStatements(statements) {
  const text = strings(statements).join(' ').toLowerCase();
  if (!text) return { status: 'needs-review', signal: 'missing', reason: '権利情報がありません' };

  const restricted = [
    /permission (?:is )?required/,
    /copyright(?:ed)?/,
    /restrictions? (?:apply|may apply|on use|on copying)/,
    /rights? (?:reserved|holder)/,
    /not (?:in )?the public domain/,
    /third[- ]party/,
    /may be protected/
  ].some(pattern => pattern.test(text));
  if (restricted) return { status: 'needs-review', signal: 'restriction-or-ambiguity', reason: '制限・第三者権利・著作権に関する記述があります' };

  const freeSignal = [
    /public domain/,
    /cc0(?: 1\.0)?/,
    /no known (?:copyright )?restrictions/,
    /free to use and reuse/,
    /not (?:subject to|protected by) copyright/
  ].some(pattern => pattern.test(text));
  if (freeSignal) return { status: 'rights-cleared-signal', signal: 'explicit-free-use', reason: '公式metadataに明示的な自由利用シグナルがあります' };

  return { status: 'needs-review', signal: 'ambiguous', reason: '権利情報はありますが自動判定できません' };
}

export async function enrichLocCandidateRights(candidate, { fetchImpl = globalThis.fetch, signal } = {}) {
  const sourceUrl = clean(candidate?.sourceUrl || candidate?.sourcePage || candidate?.pageUrl);
  const itemJsonUrl = buildLocItemJsonUrl(sourceUrl);
  if (!itemJsonUrl) {
    return { ...candidate, rightsStatus: 'needs-review', rightsCheck: { status: 'needs-review', signal: 'invalid-source', reason: '公式LoC item URLを確認できません' } };
  }
  if (typeof fetchImpl !== 'function') {
    return { ...candidate, rightsStatus: 'needs-review', rightsCheck: { status: 'needs-review', signal: 'fetch-unavailable', reason: '権利情報を取得できません' } };
  }

  try {
    const response = await fetchImpl(itemJsonUrl, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    const contentType = clean(response?.headers?.get?.('content-type')).toLowerCase();
    if (!response?.ok || (contentType && !contentType.includes('json'))) {
      return { ...candidate, rightsStatus: 'needs-review', rightsCheck: { status: 'needs-review', signal: response?.status === 429 ? 'rate-limited' : 'http-error', reason: 'LoC権利情報の取得に失敗しました', httpStatus: response?.status || 0 } };
    }
    const payload = await response.json();
    const rightsStatements = extractLocRightsMetadata(payload);
    const classification = classifyLocRightsStatements(rightsStatements);
    return {
      ...candidate,
      sourceUrl,
      rightsStatements,
      rightsStatus: classification.status,
      rightsCheck: { ...classification, itemJsonUrl }
    };
  } catch (error) {
    return { ...candidate, rightsStatus: 'needs-review', rightsCheck: { status: 'needs-review', signal: error?.name === 'AbortError' ? 'aborted' : 'fetch-error', reason: 'LoC権利情報を確認できません' } };
  }
}
