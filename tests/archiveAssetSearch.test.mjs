import test from 'node:test';
import assert from 'node:assert/strict';
import { searchArchiveCandidates } from '../archiveAssetSearch.js';

const plan={sceneId:'scene-5',requestedType:'historical-source',queries:['Nightingale'],status:'ready'};

test('uses LoC result without contacting Commons when LoC has candidates',async()=>{
  let commonsCalls=0;
  const result=await searchArchiveCandidates(plan,{
    searchLoc:async()=>({status:'ok',candidates:[{id:'loc'}]}),
    searchCommons:async()=>{commonsCalls++;return{status:'ok',candidates:[{id:'commons'}]}}
  });
  assert.equal(result.provider,'library-of-congress');
  assert.equal(result.candidates[0].id,'loc');
  assert.equal(commonsCalls,0);
});

test('falls back to Commons when LoC returns no candidates',async()=>{
  const result=await searchArchiveCandidates(plan,{
    searchLoc:async()=>({status:'ok',candidates:[]}),
    searchCommons:async()=>({status:'ok',candidates:[{id:'commons'}]})
  });
  assert.equal(result.provider,'wikimedia-commons');
  assert.equal(result.candidates[0].id,'commons');
  assert.deepEqual(result.attempts.map(x=>x.provider),['library-of-congress','wikimedia-commons']);
});

test('can use Commons after a LoC transport error without inventing rights',async()=>{
  const result=await searchArchiveCandidates(plan,{
    searchLoc:async()=>({status:'error',candidates:[],reason:'offline'}),
    searchCommons:async()=>({status:'ok',candidates:[{id:'commons',rightsStatus:'needs-review'}]})
  });
  assert.equal(result.status,'ok');
  assert.equal(result.provider,'wikimedia-commons');
  assert.equal(result.candidates[0].rightsStatus,'needs-review');
});

test('fails safely when both archive providers fail',async()=>{
  const result=await searchArchiveCandidates(plan,{
    searchLoc:async()=>({status:'error',candidates:[],reason:'loc down'}),
    searchCommons:async()=>({status:'error',candidates:[],reason:'commons down'})
  });
  assert.equal(result.status,'error');
  assert.deepEqual(result.candidates,[]);
  assert.match(result.reason,/commons|loc|検索|API/i);
});
