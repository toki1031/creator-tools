import { enrichLocCandidateRights } from './locRightsEnrichment.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLocCandidate(candidate) {
  if (clean(candidate?.provider).toLowerCase() === 'library-of-congress') return true;
  try {
    const url = new URL(clean(candidate?.sourceUrl || candidate?.sourcePage || candidate?.pageUrl));
    return url.protocol === 'https:' && url.hostname === 'www.loc.gov' && url.pathname.startsWith('/item/');
  } catch {
    return false;
  }
}

export async function enrichAssetCandidates(candidates, {
  enrichLoc = enrichLocCandidateRights,
  waitForExternalSlot,
  enrichOptions = {}
} = {}) {
  if (!Array.isArray(candidates)) return [];
  const enriched = [];
  for (const candidate of candidates) {
    if (!isLocCandidate(candidate)) {
      enriched.push(candidate);
      continue;
    }
    if (typeof waitForExternalSlot === 'function') await waitForExternalSlot();
    enriched.push(await enrichLoc(candidate, enrichOptions));
  }
  return enriched;
}
