import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocItemJsonUrl,
  extractLocRightsMetadata,
  classifyLocRightsStatements,
  enrichLocCandidateRights
} from '../locRightsEnrichment.js';

test('builds JSON URL only for official HTTPS LoC item pages', () => {
  assert.equal(buildLocItemJsonUrl('https://www.loc.gov/item/2014717546/'), 'https://www.loc.gov/item/2014717546/?fo=json&at=item%2Cresources');
  assert.equal(buildLocItemJsonUrl('http://www.loc.gov/item/2014717546/'), '');
  assert.equal(buildLocItemJsonUrl('https://evil.example/item/2014717546/'), '');
  assert.equal(buildLocItemJsonUrl('https://www.loc.gov/search/?q=test'), '');
});

test('extracts heterogeneous rights fields without duplicates', () => {
  const statements = extractLocRightsMetadata({ item: { rights_advisory: ['No known restrictions'], rights_information: 'Public domain', rights: ['No known restrictions'] } });
  assert.deepEqual(statements, ['No known restrictions', 'Public domain']);
});

test('recognizes explicit free-use signals but keeps restrictive or ambiguous text in review', () => {
  assert.equal(classifyLocRightsStatements(['Public domain']).status, 'rights-cleared-signal');
  assert.equal(classifyLocRightsStatements(['CC0 1.0 Universal']).status, 'rights-cleared-signal');
  assert.equal(classifyLocRightsStatements(['No known copyright restrictions']).status, 'rights-cleared-signal');
  assert.equal(classifyLocRightsStatements(['Permission is required']).status, 'needs-review');
  assert.equal(classifyLocRightsStatements(['Public domain; third-party material may be protected']).status, 'needs-review');
  assert.equal(classifyLocRightsStatements(['See rights and access page']).status, 'needs-review');
  assert.equal(classifyLocRightsStatements([]).status, 'needs-review');
});

test('enriches candidate from mocked official item metadata without mutating input', async () => {
  const candidate = { sourceUrl: 'https://www.loc.gov/item/abc123/', rightsStatus: 'needs-review', title: 'Example' };
  const before = structuredClone(candidate);
  let requested = '';
  const result = await enrichLocCandidateRights(candidate, {
    fetchImpl: async url => {
      requested = url;
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ item: { rights_advisory: ['No known restrictions on publication.'] }, resources: [] }) };
    }
  });
  assert.match(requested, /\/item\/abc123\//);
  assert.equal(result.rightsStatus, 'rights-cleared-signal');
  assert.deepEqual(result.rightsStatements, ['No known restrictions on publication.']);
  assert.deepEqual(candidate, before);
});

test('does not upgrade candidates with contradictory rights text', async () => {
  const result = await enrichLocCandidateRights({ sourceUrl: 'https://www.loc.gov/item/abc123/' }, {
    fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ item: { rights_advisory: ['Public domain. Third-party material may be protected by copyright.'] } }) })
  });
  assert.equal(result.rightsStatus, 'needs-review');
  assert.equal(result.rightsCheck.signal, 'restriction-or-ambiguity');
});

test('handles rate limits, HTML/CAPTCHA-like responses, network errors and invalid sources safely', async () => {
  const rate = await enrichLocCandidateRights({ sourceUrl: 'https://www.loc.gov/item/a/' }, { fetchImpl: async () => ({ ok: false, status: 429, headers: { get: () => 'text/html' } }) });
  assert.equal(rate.rightsStatus, 'needs-review');
  assert.equal(rate.rightsCheck.signal, 'rate-limited');

  const html = await enrichLocCandidateRights({ sourceUrl: 'https://www.loc.gov/item/a/' }, { fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' } }) });
  assert.equal(html.rightsStatus, 'needs-review');
  assert.equal(html.rightsCheck.signal, 'http-error');

  const network = await enrichLocCandidateRights({ sourceUrl: 'https://www.loc.gov/item/a/' }, { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(network.rightsStatus, 'needs-review');
  assert.equal(network.rightsCheck.signal, 'fetch-error');

  let calls = 0;
  const invalid = await enrichLocCandidateRights({ sourceUrl: 'https://example.com/item/a/' }, { fetchImpl: async () => { calls += 1; } });
  assert.equal(invalid.rightsStatus, 'needs-review');
  assert.equal(calls, 0);
});
