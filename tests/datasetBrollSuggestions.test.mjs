import test from 'node:test';
import assert from 'node:assert/strict';
import { collectImageSelectionEvidence, suggestBrollFromDataset } from '../datasetBrollSuggestions.js';

const past = {
  id:'past', title:'北斎本編', platform:'youtube-shorts', aspectRatio:'9:16',
  mediaLibrary:[
    {id:'asset-wave',type:'image',fileName:'wave.jpg',title:'神奈川沖浪裏',tags:['北斎','波','浮世絵'],data:'data:image/jpeg;base64,AAA'}
  ],
  learning:{decisions:[{
    id:'d1',decisionType:'scene-image-selection',projectId:'past',sceneId:'s1',
    context:{sceneText:'北斎は巨大な波を描き、世界を驚かせた。',platform:'youtube-shorts',aspectRatio:'9:16'},
    finalDecision:{imageAssetId:'asset-wave'},timestamp:'2026-09-01T00:00:00Z'
  }]}
};

test('collects adopted image decisions with metadata but no image data', () => {
  const rows = collectImageSelectionEvidence([past]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].asset.id,'asset-wave');
  assert.equal('data' in rows[0].asset,false);
});

test('ranks similar historical Scene as B-roll evidence', () => {
  const current = {id:'current',platform:'youtube-shorts',aspectRatio:'9:16',mediaLibrary:[]};
  const scene = {id:'c1',text:'北斎が描いた大きな波は世界中で知られている。'};
  const result = suggestBrollFromDataset(current,scene,[past]);
  assert.equal(result.length,1);
  assert.equal(result[0].assetId,'asset-wave');
  assert.match(result[0].reason,/過去/);
});

test('marks same asset id as reusable but does not mutate project', () => {
  const current = {id:'current',platform:'youtube-shorts',aspectRatio:'9:16',mediaLibrary:[{id:'asset-wave',type:'image',fileName:'wave-copy.jpg'}]};
  const before = structuredClone(current);
  const result = suggestBrollFromDataset(current,{text:'北斎の波を紹介する'},[past]);
  assert.equal(result[0].reusableInCurrentProject,true);
  assert.deepEqual(current,before);
});

test('ignores non image-selection decisions', () => {
  const project = structuredClone(past);
  project.learning.decisions = [{decisionType:'scene-motion',projectId:'past',sceneId:'s1',context:{sceneText:'北斎'},finalDecision:{motion:'zoom-in'}}];
  assert.deepEqual(collectImageSelectionEvidence([project]),[]);
});
