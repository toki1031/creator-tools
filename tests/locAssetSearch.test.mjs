import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocSearchUrl, normalizeLocCandidate, searchLocCandidates } from '../locAssetSearch.js';

const readyPlan = {
  sceneId:'scene-5', order:5, requestedType:'historical-source',
  queries:['1858 Nightingale statistical diagram'], status:'ready'
};

test('builds a bounded LoC JSON search URL for historical sources', () => {
  const url = new URL(buildLocSearchUrl(readyPlan, { count: 50 }));
  assert.equal(url.origin, 'https://www.loc.gov');
  assert.equal(url.pathname, '/search/');
  assert.equal(url.searchParams.get('q'), '1858 Nightingale statistical diagram');
  assert.equal(url.searchParams.get('fo'), 'json');
  assert.equal(url.searchParams.get('c'), '10');
});

test('does not use LoC for AI reconstruction or blocked plans', () => {
  assert.equal(buildLocSearchUrl({ ...readyPlan, requestedType:'ai-reconstruction' }), '');
  assert.equal(buildLocSearchUrl({ ...readyPlan, status:'blocked' }), '');
});

test('normalizes only metadata supplied by LoC and never auto-approves rights', () => {
  const candidate = normalizeLocCandidate({
    id:'https://www.loc.gov/item/example/', title:'Example historical item',
    date:'1858', image_url:['https://tile.loc.gov/example.jpg'],
    contributor:['Example Contributor'],
    item:{ rights_advisory:'No known restrictions on publication.' }
  }, readyPlan);
  assert.equal(candidate.provider,'library-of-congress');
  assert.equal(candidate.sourceUrl,'https://www.loc.gov/item/example/');
  assert.equal(candidate.previewUrl,'https://tile.loc.gov/example.jpg');
  assert.deepEqual(candidate.rightsStatements,['No known restrictions on publication.']);
  assert.equal(candidate.rightsStatus,'needs-review');
  assert.equal(candidate.autoAdoptable,false);
});

test('blocked plan performs zero network calls', async () => {
  let calls = 0;
  const result = await searchLocCandidates({ ...readyPlan, status:'blocked' }, {
    fetchImpl: async () => { calls += 1; throw new Error('must not run'); }
  });
  assert.equal(calls,0);
  assert.equal(result.status,'blocked');
});

test('search returns normalized candidates with mocked fetch', async () => {
  let calls = 0;
  const result = await searchLocCandidates(readyPlan, { fetchImpl: async url => {
    calls += 1;
    assert.match(url,/loc\.gov/);
    return { ok:true, json: async () => ({ results:[{
      id:'https://www.loc.gov/item/example/', title:'Diagram', date:'1858',
      image_url:['https://tile.loc.gov/diagram.jpg'], rights:['Rights information requires review']
    }] }) };
  }});
  assert.equal(calls,1);
  assert.equal(result.status,'ok');
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].rightsStatus,'needs-review');
  assert.equal(result.candidates[0].autoAdoptable,false);
});

test('API and JSON failures are non-destructive error results', async () => {
  const apiError = await searchLocCandidates(readyPlan, { fetchImpl: async () => ({ ok:false, status:429 }) });
  assert.equal(apiError.status,'error');
  assert.deepEqual(apiError.candidates,[]);
  const jsonError = await searchLocCandidates(readyPlan, { fetchImpl: async () => ({ ok:true, json: async () => { throw new Error('bad json'); } }) });
  assert.equal(jsonError.status,'error');
  assert.deepEqual(jsonError.candidates,[]);
});
