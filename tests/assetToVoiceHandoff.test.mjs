import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAssetToVoiceHandoff, hasReadySceneImage } from '../assetToVoiceHandoff.js';

test('recognizes ready Scene images from asset id or embedded image data',()=>{
  assert.equal(hasReadySceneImage({imageAssetId:'asset-1'}),true);
  assert.equal(hasReadySceneImage({imageData:'data:image/png;base64,AA=='}),true);
  assert.equal(hasReadySceneImage({}),false);
});

test('continues only after a safely completed pipeline and all Scene images are ready',()=>{
  const project={scenes:[
    {id:'s1',imageAssetId:'a1'},
    {id:'s2',imageAssetId:'a2'}
  ]};
  const result=evaluateAssetToVoiceHandoff(project,{status:'complete'});
  assert.equal(result.canContinue,true);
  assert.deepEqual(result.missingSceneIds,[]);
});

test('does not continue when even one Scene image is missing after pipeline completion',()=>{
  const project={scenes:[
    {id:'s1',imageAssetId:'a1'},
    {id:'s2'}
  ]};
  const result=evaluateAssetToVoiceHandoff(project,{status:'complete'});
  assert.equal(result.canContinue,false);
  assert.deepEqual(result.missingSceneIds,['s2']);
  assert.match(result.reason,/1件/);
});

test('does not continue after a risk stop even when every Scene already has an image',()=>{
  const project={scenes:[{id:'s1',imageAssetId:'a1'}]};
  const result=evaluateAssetToVoiceHandoff(project,{status:'needs-review',reason:'rights review'});
  assert.equal(result.canContinue,false);
  assert.equal(result.reason,'rights review');
});

test('allows no-eligible-scenes only when all Scenes already have images',()=>{
  assert.equal(evaluateAssetToVoiceHandoff(
    {scenes:[{id:'s1',imageAssetId:'a1'}]},
    {status:'no-eligible-scenes'}
  ).canContinue,true);
  assert.equal(evaluateAssetToVoiceHandoff(
    {scenes:[{id:'s1'}]},
    {status:'no-eligible-scenes'}
  ).canContinue,false);
});
