import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAutoAdoptionRights } from '../assetAutoAdoptionPolicy.js';

test('allows existing explicitly verified rights status', () => {
  assert.equal(evaluateAutoAdoptionRights({ rightsStatus: 'verified' }).allowed, true);
});

test('allows LoC free-use signal only with complete official evidence', () => {
  const result = evaluateAutoAdoptionRights({
    provider: 'library-of-congress',
    sourceUrl: 'https://www.loc.gov/item/2021666886/',
    rightsStatus: 'rights-cleared-signal',
    rightsCheck: {
      status: 'rights-cleared-signal',
      signal: 'explicit-free-use',
      itemJsonUrl: 'https://www.loc.gov/item/2021666886/?fo=json&at=item%2Cresources'
    }
  });
  assert.equal(result.allowed, true);
  assert.equal(result.policy, 'official-free-use-signal');
  assert.match(result.note, /verified/);
});

test('does not auto adopt a free-use label without official evidence', () => {
  for (const candidate of [
    { rightsStatus: 'rights-cleared-signal' },
    { provider: 'library-of-congress', sourceUrl: 'https://example.org/item/1', rightsStatus: 'rights-cleared-signal', rightsCheck: { status: 'rights-cleared-signal', signal: 'explicit-free-use' } },
    { provider: 'library-of-congress', sourceUrl: 'https://www.loc.gov/item/1/', rightsStatus: 'rights-cleared-signal', rightsCheck: { status: 'rights-cleared-signal', signal: 'ambiguous', itemJsonUrl: 'https://www.loc.gov/item/1/?fo=json' } }
  ]) assert.equal(evaluateAutoAdoptionRights(candidate).allowed, false);
});

test('reviewed metadata and ambiguous states are never auto adoptable', () => {
  for (const rightsStatus of ['', 'reviewed-metadata', 'needs-review', 'unknown', 'ambiguous']) {
    assert.equal(evaluateAutoAdoptionRights({ rightsStatus }).allowed, false);
  }
});

test('allows Commons Public Domain or CC0 only with official extmetadata evidence',()=>{
  const result=evaluateAutoAdoptionRights({
    provider:'wikimedia-commons',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg',
    rightsStatus:'rights-cleared-signal',
    rightsCheck:{
      status:'rights-cleared-signal',
      signal:'public-domain-or-cc0',
      source:'commons-extmetadata',
      sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg'
    }
  });
  assert.equal(result.allowed,true);
  assert.equal(result.policy,'commons-public-domain-or-cc0');
});

test('does not auto adopt Commons attribution licenses or incomplete evidence',()=>{
  for(const candidate of [
    {provider:'wikimedia-commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg',rightsStatus:'needs-review',rightsCheck:{status:'needs-review',signal:'license-review-required',source:'commons-extmetadata'}},
    {provider:'wikimedia-commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg',rightsStatus:'rights-cleared-signal',rightsCheck:{status:'rights-cleared-signal',signal:'public-domain-or-cc0',source:'commons-extmetadata',sourceUrl:'https://example.org/File:X.jpg'}},
    {provider:'wikimedia-commons',sourceUrl:'https://example.org/File:X.jpg',rightsStatus:'rights-cleared-signal',rightsCheck:{status:'rights-cleared-signal',signal:'public-domain-or-cc0',source:'commons-extmetadata',sourceUrl:'https://commons.wikimedia.org/wiki/File:X.jpg'}}
  ]) assert.equal(evaluateAutoAdoptionRights(candidate).allowed,false);
});
