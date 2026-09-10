import assert from 'node:assert/strict';
import { adoptVisualAssetForScene } from '../sceneVisualAssetAdoption.js';

const imgA='data:image/png;base64,QQ==';
const imgB='data:image/png;base64,Qg==';

{
  const project={id:'p1',platform:'youtube-shorts',aspectRatio:'9:16',learning:{decisions:[]},mediaLibrary:[{id:'asset-a',type:'image',data:imgA},{id:'asset-b',type:'image',data:imgB}],scenes:[{id:'s1',text:'作業する手元',imageAssetId:'asset-a'}]};
  const result=adoptVisualAssetForScene(project,0,'asset-b',{candidateAssetIds:['asset-a','asset-b'],createId:()=> 'd1',now:()=> '2026-09-10T00:00:00.000Z'});
  assert.equal(result.changed,true);
  assert.equal(project.scenes[0].imageAssetId,'asset-b');
  assert.equal(result.record.decisionType,'scene-image-selection');
  assert.deepEqual(result.record.proposal,{imageAssetId:'asset-a'});
  assert.deepEqual(result.record.finalDecision,{imageAssetId:'asset-b'});
}

{
  const project={id:'p2',learning:{decisions:[]},mediaLibrary:[{id:'asset-b',type:'image',data:imgB}],scenes:[{id:'s2',text:'legacy',imageData:imgA}]};
  const result=adoptVisualAssetForScene(project,0,'asset-b',{candidateAssetIds:['asset-b'],createId:(()=>{let n=0;return()=>`x${++n}`;})(),now:()=> '2026-09-10T00:00:00.000Z'});
  assert.equal(result.changed,true);
  assert.equal(project.scenes[0].imageAssetId,'asset-b');
  assert.equal('imageData' in project.scenes[0],false);
  assert.ok(result.record.proposal.imageAssetId?.startsWith('asset-'));
  assert.equal(result.record.finalDecision.imageAssetId,'asset-b');
}

{
  const project={id:'p3',learning:{decisions:[]},mediaLibrary:[{id:'asset-a',type:'image',data:imgA}],scenes:[{id:'s3',imageAssetId:'asset-a'}]};
  assert.equal(adoptVisualAssetForScene(project,0,'asset-a').changed,false);
  assert.equal(project.learning.decisions.length,0);
  assert.equal(adoptVisualAssetForScene(project,0,'missing').reason,'asset-not-found');
}

console.log('sceneVisualAssetAdoption tests passed');
