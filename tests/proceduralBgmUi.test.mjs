import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('BGM UI exposes Creator OS procedural source and output readiness recognizes it',async()=>{
  const source=await readFile(new URL('../main.js',import.meta.url),'utf8');
  assert.match(source,/value="procedural">Creator OS 自動BGM/);
  assert.match(source,/isProceduralBgm\(project\.bgm\)/);
  assert.match(source,/Creator OS内生成/);
  assert.match(source,/自動BGMを8秒試聴/);
  assert.match(source,/createProceduralPreviewWavBlob/);
  assert.match(source,/URL\.createObjectURL\(createProceduralPreviewWavBlob\(\{durationSec:8\}\)\)/);
  assert.match(source,/await player\.play\(\)/);
  assert.match(source,/通常の音声プレーヤーで試聴中/);
  assert.match(source,/selected==='procedural'.*calm-documentary/s);
});

test('video renderer mixes procedural BGM through the normal BGM gain path',async()=>{
  const source=await readFile(new URL('../videoRenderer.js',import.meta.url),'utf8');
  assert.match(source,/const hasProceduralBgm = Boolean/);
  assert.match(source,/createProceduralBgmGraph\(context, bgmGain/);
  assert.match(source,/bgmGain\.gain\.value = 0/);
  assert.match(source,/project\.bgm\?\.ducking !== false/);
  assert.match(source,/ensurePlaybackAudioSession\(\)/);
});
