import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEquivalentArchiveCandidate } from '../archiveCandidateSelection.js';

const requirement={requestedType:'historical-source',queryHint:'Florence Nightingale mortality diagram 1858'};
function entry({id,width,height,status='eligible',autoAdoptable=true,description='Diagram of the causes of mortality in the army in the East',date='1858',contributors=['Florence Nightingale'],mimeType='image/jpeg'}={}){
  return {
    candidate:{sourceUrl:`https://commons.wikimedia.org/wiki/File:${id}.jpg`,title:`${id}.jpg`,description,date,contributors,mimeType,width,height,rightsStatus:'rights-cleared-signal'},
    evaluation:{status,autoAdoptable,requestedType:'historical-source'}
  };
}

test('selects a unique highest-resolution equivalent archive image',()=>{
  const small=entry({id:'coxcomb',width:806,height:638});
  const large=entry({id:'nightingale-mortality',width:6996,height:3826});
  const result=selectEquivalentArchiveCandidate([small,large],requirement);
  assert.equal(result.selected,true);
  assert.equal(result.entries.length,1);
  assert.equal(result.entries[0].candidate.title,'nightingale-mortality.jpg');
});

test('keeps needs-selection behavior when top resolution is tied',()=>{
  const a=entry({id:'a',width:2000,height:1000});
  const b=entry({id:'b',width:2000,height:1000});
  const result=selectEquivalentArchiveCandidate([a,b],requirement);
  assert.equal(result.selected,false);
  assert.equal(result.entries.length,2);
  assert.equal(result.reason,'resolution-tie-or-missing');
});

test('never selects a review-required candidate just because it is larger',()=>{
  const safe=entry({id:'safe',width:2000,height:1000});
  const review=entry({id:'review',width:9000,height:9000,status:'needs-review',autoAdoptable:false});
  const other=entry({id:'other-safe',width:1500,height:1000});
  const result=selectEquivalentArchiveCandidate([safe,review,other],requirement);
  assert.equal(result.selected,true);
  assert.equal(result.entries[0].candidate.title,'safe.jpg');
});

test('does not use resolution when candidate fails explicit archive intent',()=>{
  const relevant=entry({id:'diagram',width:1200,height:800});
  const portrait=entry({id:'portrait',width:9000,height:9000,description:'Portrait photograph',date:'1858',contributors:['Florence Nightingale']});
  const result=selectEquivalentArchiveCandidate([relevant,portrait],requirement);
  assert.equal(result.selected,false);
  assert.equal(result.entries.length,2);
  assert.equal(result.reason,'not-multiple-equivalent-images');
});

test('requires sufficiently explicit intent before automatic equivalence selection',()=>{
  const result=selectEquivalentArchiveCandidate([entry({id:'a',width:1200,height:800}),entry({id:'b',width:2000,height:1200})],{requestedType:'historical-source',queryHint:'古い史料'});
  assert.equal(result.selected,false);
  assert.equal(result.reason,'insufficient-explicit-intent');
});
