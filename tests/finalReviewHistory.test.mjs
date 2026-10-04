import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinalReviewHistory, createFinalReviewSaveController } from '../finalReviewHistory.js';

const sample=()=>({
  scenes:[{id:'s1',order:1,subtitleText:'one',durationSec:4},{id:'s2',order:2,subtitleText:'two',durationSec:5}],
  subtitleStyle:{position:'bottom'},
  bgm:{volume:0.08,procedural:{preset:'calm-documentary'}},
  autoProduction:{mode:'production-request'}
});

test('final review history undoes and redoes commands without mutating initial project',()=>{
  const source=sample();
  const history=createFinalReviewHistory(source);
  history.apply({type:'set-subtitle-text',sceneId:'s1',text:'changed'});
  assert.equal(history.snapshot().scenes[0].subtitleText,'changed');
  assert.equal(source.scenes[0].subtitleText,'one');
  assert.equal(history.canUndo(),true);
  history.undo();
  assert.equal(history.snapshot().scenes[0].subtitleText,'one');
  assert.equal(history.canRedo(),true);
  history.redo();
  assert.equal(history.snapshot().scenes[0].subtitleText,'changed');
});

test('new command after undo clears redo history',()=>{
  const history=createFinalReviewHistory(sample());
  history.apply({type:'set-subtitle-text',sceneId:'s1',text:'a'});
  history.undo();
  history.apply({type:'set-scene-duration',sceneId:'s1',durationSec:6});
  assert.equal(history.canRedo(),false);
});

test('history preserves production metadata and procedural bgm',()=>{
  const history=createFinalReviewHistory(sample());
  history.apply({type:'set-bgm-volume',volume:0.2});
  assert.equal(history.snapshot().autoProduction.mode,'production-request');
  assert.equal(history.snapshot().bgm.procedural.preset,'calm-documentary');
});

test('autosave coalesces edits and persists the latest project',async()=>{
  const saved=[];
  const statuses=[];
  const controller=createFinalReviewSaveController({delay:1000,persist:async p=>saved.push(p),setStatus:s=>statuses.push(s)});
  controller.schedule({...sample(),title:'first'});
  controller.schedule({...sample(),title:'latest'});
  await controller.flush();
  assert.equal(saved.length,1);
  assert.equal(saved[0].title,'latest');
  assert.equal(statuses.at(-1),'保存済み');
});
