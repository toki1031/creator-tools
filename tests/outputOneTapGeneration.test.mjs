import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../main.js',import.meta.url),'utf8');

function generationHandler(){
  const start=source.indexOf("root.querySelector('#generateVideo').onclick=async()=>");
  const end=source.indexOf("\n  root.querySelector('#cancelRender').onclick",start);
  assert.ok(start>=0&&end>start);
  return source.slice(start,end);
}

test('video generation has no second confirmation dialog',()=>{
  assert.doesNotMatch(source,/videoGenerationConfirmDialog/);
  assert.doesNotMatch(source,/data-generation-confirm/);
  assert.doesNotMatch(source,/動画生成を開始しますか？/);
});

test('the first generate-video tap unlocks Web Audio before the first await',()=>{
  const handler=generationHandler();
  const create=handler.indexOf('createGenerationStartController');
  const approve=handler.indexOf('startController.approve()');
  const firstAwait=handler.indexOf('await ');
  assert.ok(create>=0);
  assert.ok(approve>create);
  assert.ok(firstAwait>approve);
  assert.match(handler,/AudioContextClass:globalThis\.AudioContext\|\|globalThis\.webkitAudioContext\|\|null/);
});

test('one tap still stops safely when audio activation fails',()=>{
  const handler=generationHandler();
  assert.match(handler,/if\(startDecision\.audioStartError\)/);
  assert.match(handler,/const audioResumeError=await startDecision\.audioResumeResult/);
  assert.match(handler,/音声を有効化できませんでした/);
});

test('output keeps cancel and lazy media preparation after one-tap change',()=>{
  const handler=generationHandler();
  assert.match(handler,/let assets=await ensurePreparedAssets\(\)/);
  assert.match(source,/id="cancelRender"/);
  assert.match(source,/#cancelRender'\)\.onclick=\(\)=>renderController\?\.abort\(\)/);
  assert.match(source,/「動画を生成」を押すとすぐ生成を開始します/);
});
