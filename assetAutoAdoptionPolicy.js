function clean(value = '') {
  return String(value ?? '').trim();
}

function isOfficialLocItemUrl(value) {
  try {
    const url = new URL(clean(value));
    return url.protocol === 'https:' && url.hostname === 'www.loc.gov' && /^\/item\/[^/]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}


function isOfficialCommonsFileUrl(value) {
  try {
    const url = new URL(clean(value));
    return url.protocol === 'https:' && url.hostname === 'commons.wikimedia.org' && /^\/wiki\/File(?::|%3A)/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function evaluateAutoAdoptionRights(candidate) {
  const rightsStatus = clean(candidate?.rightsStatus).toLowerCase();
  if (rightsStatus === 'verified') {
    return { allowed: true, policy: 'verified', reason: '' };
  }

  if (rightsStatus !== 'rights-cleared-signal') {
    return { allowed: false, policy: 'review-required', reason: '自動採用を許可できる権利状態ではありません' };
  }

  const provider = clean(candidate?.provider).toLowerCase();
  const sourceUrl = clean(candidate?.sourceUrl || candidate?.sourcePage || candidate?.pageUrl);
  const check = candidate?.rightsCheck && typeof candidate.rightsCheck === 'object' ? candidate.rightsCheck : {};
  const checkStatus = clean(check.status).toLowerCase();
  const signal = clean(check.signal).toLowerCase();
  const itemJsonUrl = clean(check.itemJsonUrl);
  const checkSource = clean(check.source).toLowerCase();
  const checkSourceUrl = clean(check.sourceUrl);

  const officialLocEvidence = provider === 'library-of-congress'
    && isOfficialLocItemUrl(sourceUrl)
    && checkStatus === 'rights-cleared-signal'
    && signal === 'explicit-free-use'
    && isOfficialLocItemUrl(itemJsonUrl.replace(/\?.*$/, ''));

  const officialCommonsEvidence = provider === 'wikimedia-commons'
    && isOfficialCommonsFileUrl(sourceUrl)
    && checkStatus === 'rights-cleared-signal'
    && signal === 'public-domain-or-cc0'
    && checkSource === 'commons-extmetadata'
    && isOfficialCommonsFileUrl(checkSourceUrl);

  if (!officialLocEvidence && !officialCommonsEvidence) {
    return { allowed: false, policy: 'review-required', reason: '自由利用シグナルの公式根拠が不足しています' };
  }

  return {
    allowed: true,
    policy: officialCommonsEvidence ? 'commons-public-domain-or-cc0' : 'official-free-use-signal',
    reason: '',
    note: '公式metadataの自由利用シグナルであり、法的なverified判定ではありません'
  };
}
