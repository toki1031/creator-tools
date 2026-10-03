import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFinalReviewCommand} from '../finalReviewCommands.js';

const sample=()=>({
  scenes:[
    {id:'s1',order:1,imageAssetId:'a1',imageData:'legacy',subtitleText:'one',durationSec:4},
    {id:'s2',order:2,imageAssetId:'a2',imageData:'',subtitleText:'two',durationSec:5}
  ],
  subtitleStyle:{position:'bottom'},
  bgm:{volume:0.08,procedural:{preset:'calm-documentary'}},
  mediaLibrary:[{id:'a1',mediaRef:{id:'a1'}},{id:'a2',mediaRef:{id:'a2'}}],
  autoProduction:{mode:'production-request'}
});

test('final review commands edit a clone without mutating source',()=>{
  const source=sample();
  const result=applyFinalReviewCommand(source,{type:'set-subtitle-text',sceneId:'s1',text:'changed'});
  assert.equal(result.changed,true);
  assert.equal(result.project.scenes[0].subtitleText,'changed');
  assert.equal(source.scenes[0].subtitleText,'one');
});

test('scene image replacement keeps MediaRef library and removes legacy inline image',()=>{
  const source=sample();
  const result=applyFinalReviewCommand(source,{type:'replace-scene-image',sceneId:'s1',assetId:'a2'});
  assert.equal(result.project.scenes[0].imageAssetId,'a2');
  assert.equal(result.project.scenes[0].imageData,'');
  assert.deepEqual(result.project.mediaLibrary,source.mediaLibrary);
});

test('duration, subtitle position and bgm volume use safe bounds',()=>{
  let p=sample();
  p=applyFinalReviewCommand(p,{type:'set-scene-duration',sceneId:'s1',durationSec:6.25}).project;
  p=applyFinalReviewCommand(p,{type:'set-subtitle-position',position:'top'}).project;
  p=applyFinalReviewCommand(p,{type:'set-bgm-volume',volume:0.2}).project;
  assert.equal(p.scenes[0].durationSec,6.25);
  assert.equal(p.subtitleStyle.position,'top');
  assert.equal(p.bgm.volume,0.2);
  assert.equal(p.bgm.procedural.preset,'calm-documentary');
  assert.equal(applyFinalReviewCommand(p,{type:'set-bgm-volume',volume:2}).changed,false);
});

test('move scene reorders scenes and normalizes order fields',()=>{
  const result=applyFinalReviewCommand(sample(),{type:'move-scene',sceneId:'s2',toIndex:0});
  assert.deepEqual(result.project.scenes.map(x=>[x.id,x.order]),[['s2',1],['s1',2]]);
});

test('commands preserve production request metadata',()=>{
  const result=applyFinalReviewCommand(sample(),{type:'set-subtitle-text',sceneId:'s2',text:'updated'});
  assert.equal(result.project.autoProduction.mode,'production-request');
});
