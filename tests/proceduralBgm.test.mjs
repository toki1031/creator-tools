import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralBgmGraph, createProceduralBgmSettings, createProceduralPreviewWavBytes, createProceduralPreviewWavBlob, ensurePlaybackAudioSession, isProceduralBgm } from '../proceduralBgm.js';

test('creates a calm documentary procedural BGM setting from production guidance',()=>{
  const bgm=createProceduralBgmSettings(['静かなドキュメンタリーBGM']);
  assert.equal(bgm.source,'procedural');
  assert.equal(bgm.procedural.preset,'calm-documentary');
  assert.equal(bgm.ducking,true);
  assert.equal(bgm.volume,0.08);
  assert.match(bgm.license,/外部音源不使用/);
  assert.equal(isProceduralBgm(bgm),true);
});

test('does not invent BGM when production guidance is absent',()=>{
  assert.equal(createProceduralBgmSettings([]),null);
  assert.equal(isProceduralBgm({source:'none'}),false);
});

test('builds a Web Audio graph and schedules all procedural voices',()=>{
  const starts=[],stops=[],connections=[];
  const context={
    createOscillator(){
      return {
        type:'sine',
        frequency:{value:0},
        detune:{value:0},
        connect(node){connections.push(['osc',node.kind]);},
        start(time){starts.push(time);},
        stop(time){stops.push(time);}
      };
    },
    createGain(){
      return {kind:'gain',gain:{value:0},connect(node){connections.push(['gain',node.kind||'destination']);}};
    }
  };
  const destination={kind:'destination'};
  const graph=createProceduralBgmGraph(context,destination,{preset:'calm-documentary',durationSec:60});
  assert.equal(graph.sources.length,3);
  graph.start(10);
  assert.deepEqual(starts,[10,10,10]);
  assert.ok(stops.every(value=>value===70.2));
  assert.ok(connections.length>=6);
});


test('creates a playable PCM WAV preview with audible sample data',()=>{
  const bytes=createProceduralPreviewWavBytes({durationSec:1,sampleRate:8000});
  const ascii=(start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
  assert.equal(ascii(0,4),'RIFF');
  assert.equal(ascii(8,4),'WAVE');
  assert.equal(ascii(36,4),'data');
  assert.equal(bytes.length,44+8000*2);
  assert.ok(bytes.slice(44).some(value=>value!==0));
  const blob=createProceduralPreviewWavBlob({durationSec:1,sampleRate:8000});
  assert.equal(blob.type,'audio/wav');
  assert.equal(blob.size,bytes.length);
});

test('requests playback audio session when the platform exposes it',()=>{
  const navigatorLike={audioSession:{type:'ambient'}};
  assert.equal(ensurePlaybackAudioSession(navigatorLike),true);
  assert.equal(navigatorLike.audioSession.type,'playback');
  assert.equal(ensurePlaybackAudioSession({}),false);
});
