import test from 'node:test';
import assert from 'node:assert/strict';
import { selectArchiveProviderByRights } from '../archiveProviderSelection.js';

const requirement={requestedType:'historical-source'};
const entry=(provider,{status='eligible',autoAdoptable=true,id=provider}={})=>({
  candidate:{provider,id},
  evaluation:{status,autoAdoptable,requestedType:'historical-source'}
});

test('prefers auto-adoptable LoC over auto-adoptable Commons',()=>{
  const result=selectArchiveProviderByRights([
    entry('library-of-congress',{id:'loc-safe'}),
    entry('wikimedia-commons',{id:'commons-safe'})
  ],requirement);
  assert.equal(result.selectedProvider,'library-of-congress');
  assert.deepEqual(result.entries.map(x=>x.candidate.id),['loc-safe']);
});

test('falls back to Commons when LoC candidates require review',()=>{
  const result=selectArchiveProviderByRights([
    entry('library-of-congress',{id:'loc-review',status:'needs-review',autoAdoptable:false}),
    entry('wikimedia-commons',{id:'commons-safe'})
  ],requirement);
  assert.equal(result.selectedProvider,'wikimedia-commons');
  assert.deepEqual(result.entries.map(x=>x.candidate.id),['commons-safe']);
});

test('keeps all entries when neither provider is safely auto-adoptable',()=>{
  const entries=[
    entry('library-of-congress',{id:'loc-review',status:'needs-review',autoAdoptable:false}),
    entry('wikimedia-commons',{id:'commons-review',status:'needs-review',autoAdoptable:false})
  ];
  const result=selectArchiveProviderByRights(entries,requirement);
  assert.equal(result.selectedProvider,'');
  assert.strictEqual(result.entries,entries);
  assert.equal(result.reason,'no-auto-adoptable-archive-provider');
});

test('does not change non-archive candidate sets',()=>{
  const entries=[entry('wikimedia-commons')];
  const result=selectArchiveProviderByRights(entries,{requestedType:'modern-visual'});
  assert.equal(result.changed,false);
  assert.strictEqual(result.entries,entries);
});
