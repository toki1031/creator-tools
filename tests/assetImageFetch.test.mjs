import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAssetImage, DEFAULT_MAX_BYTES } from '../assetImageFetch.js';

const plan = {
  status: 'ready',
  sceneId: 'scene-5',
  candidate: {
    title: 'Historical diagram',
    provider: 'library-of-congress',
    sourceUrl: 'https://www.loc.gov/item/example/',
    sourcePage: 'https://www.loc.gov/item/example/',
    previewUrl: 'https://tile.loc.gov/example.jpg',
    rightsAdvisory: 'Check Rights & Access',
    rightsStatements: ['No known copyright restrictions'],
    rightsStatus: 'rights-cleared-signal',
    rightsCheck: { status: 'rights-cleared-signal', signal: 'explicit-free-use', itemJsonUrl: 'https://www.loc.gov/item/example/?fo=json' }
  }
};

function response({ ok = true, status = 200, type = 'image/jpeg', size = 100, length = size } = {}) {
  return {
    ok,
    status,
    headers: { get: key => key === 'content-type' ? type : key === 'content-length' ? String(length) : null },
    blob: async () => ({ size, type })
  };
}

const convert = async blob => `data:${blob.type};base64,AAAA`;

test('does not fetch non-ready plans', async () => {
  let calls = 0;
  const result = await fetchAssetImage({ ...plan, status: 'needs-review' }, { fetchImpl: async () => { calls += 1; return response(); }, blobToDataUrl: convert });
  assert.equal(result.status, 'blocked');
  assert.equal(calls, 0);
});

test('requires an https image URL', async () => {
  let calls = 0;
  const result = await fetchAssetImage({ ...plan, candidate: { ...plan.candidate, previewUrl: 'http://example.com/a.jpg' } }, { fetchImpl: async () => { calls += 1; return response(); }, blobToDataUrl: convert });
  assert.equal(result.status, 'blocked');
  assert.equal(calls, 0);
});

test('resolves a valid image and preserves complete rights provenance without mutation', async () => {
  const before = structuredClone(plan);
  const result = await fetchAssetImage(plan, { fetchImpl: async () => response(), blobToDataUrl: convert });
  assert.equal(result.status, 'resolved');
  assert.equal(result.asset.mimeType, 'image/jpeg');
  assert.equal(result.asset.provenance.sourceUrl, plan.candidate.sourceUrl);
  assert.equal(result.asset.provenance.sourcePage, plan.candidate.sourcePage);
  assert.deepEqual(result.asset.provenance.rightsStatements, plan.candidate.rightsStatements);
  assert.equal(result.asset.provenance.rightsStatus, 'rights-cleared-signal');
  assert.deepEqual(result.asset.provenance.rightsCheck, plan.candidate.rightsCheck);
  assert.notEqual(result.asset.provenance.rightsCheck, plan.candidate.rightsCheck);
  assert.deepEqual(plan, before);
  assert.match(result.asset.data, /^data:image\/jpeg/);
});

test('falls back to legacy sourcePage when canonical sourceUrl is absent', async () => {
  const legacyPlan = { ...plan, candidate: { ...plan.candidate, sourceUrl: '' } };
  const result = await fetchAssetImage(legacyPlan, { fetchImpl: async () => response(), blobToDataUrl: convert });
  assert.equal(result.asset.provenance.sourceUrl, legacyPlan.candidate.sourcePage);
});

test('rejects http errors and non-image responses', async () => {
  const failed = await fetchAssetImage(plan, { fetchImpl: async () => response({ ok: false, status: 404 }), blobToDataUrl: convert });
  assert.equal(failed.status, 'error');
  const html = await fetchAssetImage(plan, { fetchImpl: async () => response({ type: 'text/html' }), blobToDataUrl: convert });
  assert.equal(html.status, 'blocked');
});

test('rejects oversized declared or actual payloads', async () => {
  const declared = await fetchAssetImage(plan, { fetchImpl: async () => response({ length: DEFAULT_MAX_BYTES + 1 }), blobToDataUrl: convert });
  assert.equal(declared.status, 'blocked');
  const actual = await fetchAssetImage(plan, { fetchImpl: async () => response({ size: DEFAULT_MAX_BYTES + 1, length: 0 }), blobToDataUrl: convert });
  assert.equal(actual.status, 'blocked');
});

test('handles abort and network failures safely', async () => {
  const aborted = await fetchAssetImage(plan, { fetchImpl: async () => { const error = new Error('stop'); error.name = 'AbortError'; throw error; }, blobToDataUrl: convert });
  assert.equal(aborted.status, 'aborted');
  const network = await fetchAssetImage(plan, { fetchImpl: async () => { throw new Error('offline'); }, blobToDataUrl: convert });
  assert.equal(network.status, 'error');
});
