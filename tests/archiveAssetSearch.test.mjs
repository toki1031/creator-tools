import test from 'node:test';
import assert from 'node:assert/strict';
import { searchArchiveCandidates } from '../archiveAssetSearch.js';

const plan={sceneId:'scene-5',requestedType:'historical-source',queries:['Nightingale'],status:'ready'};

test('keeps matching LoC and Commons candidates for rights-aware evaluation',async()=>{
  let commonsCalls=0;
  const result=await searchArchiveCandidates(plan,{
    searchLoc:async()=>({status:'ok',candidates:[{id:'loc',provider:'library-of-congress'}]}),
    searchCommons:async()=>{commonsCalls++;return{status:'ok',candidates:[{id:'commons',provider:'wikimedia-commons'}]}}
  });
  assert.equal(result.status,'ok');
  assert.equal(result.provider,'archive-combined');
  assert.deepEqual(result.candidates.map(x=>x.id),['loc','commons']);
  assert.equal(commonsCalls,1);
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

test('rejects an irrelevant Nightingale portrait when the Scene explicitly asks for a statistical diagram',async()=>{
  const specific={...plan,queries:['ナイチンゲールの統計図 1858']};
  const result=await searchArchiveCandidates(specific,{
    searchLoc:async()=>({status:'ok',candidates:[{provider:'library-of-congress',title:'Florence Nightingale',date:'1862',description:'Portrait photograph'}]}),
    searchCommons:async()=>({status:'ok',candidates:[{provider:'wikimedia-commons',title:'Nightingale-mortality.jpg',date:'1858',description:'Diagram of the causes of mortality in the army in the East'}]})
  });
  assert.equal(result.provider,'wikimedia-commons');
  assert.equal(result.candidates.length,1);
  assert.match(result.candidates[0].title,/mortality/);
  assert.equal(result.attempts[0].matchedCount,0);
});


test('generic archive filtering works for an unrelated person and year without named hardcoding',async()=>{
  const generic={...plan,queries:['Marie Curie laboratory 1911']};
  const result=await searchArchiveCandidates(generic,{
    searchLoc:async()=>({status:'ok',candidates:[
      {id:'curie',title:'Marie Curie in laboratory',date:'1911',description:'Laboratory photograph'},
      {id:'other',title:'Street scene',date:'1911',description:'City photograph'}
    ]}),
    searchCommons:async()=>({status:'ok',candidates:[]})
  });
  assert.deepEqual(result.candidates.map(x=>x.id),['curie']);
});
