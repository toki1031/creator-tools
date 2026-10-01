import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralBgmGraph, createProceduralBgmSettings, createProceduralPcmSamples, createProceduralPreviewWavBytes, createProceduralPreviewWavBlob, ensurePlaybackAudioSession, isProceduralBgm, proceduralBgmSampleAt } from '../proceduralBgm.js';

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
  assert.equal(graph.sources.length,4);
  graph.start(10);
  assert.deepEqual(starts,[10,10,10,10]);
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

test('cycles iOS audio session through ambient to playback so stale Safari state is refreshed',()=>{
  let scheduled=null;
  const timer=callback=>{scheduled=callback;return 1;};
  const navigatorLike={audioSession:{type:'playback'}};
  assert.equal(ensurePlaybackAudioSession(navigatorLike,timer),true);
  assert.equal(navigatorLike.audioSession.type,'ambient');
  assert.equal(typeof scheduled,'function');
  scheduled();
  assert.equal(navigatorLike.audioSession.type,'playback');
  assert.equal(ensurePlaybackAudioSession({},timer),false);
});

test('calm documentary synthesis changes harmony over time instead of holding one tone',()=>{
  const points=[0.8,4.8,8.8,12.8].map(time=>proceduralBgmSampleAt(time));
  assert.ok(points.every(Number.isFinite));
  assert.ok(new Set(points.map(value=>value.toFixed(5))).size>=3);
  const pcm=createProceduralPcmSamples({durationSec:8,sampleRate:8000});
  assert.equal(pcm.length,64000);
  const firstEnergy=pcm.slice(4000,12000).reduce((sum,v)=>sum+Math.abs(v),0);
  const secondEnergy=pcm.slice(36000,44000).reduce((sum,v)=>sum+Math.abs(v),0);
  assert.ok(firstEnergy>10);
  assert.ok(secondEnergy>10);
});

test('Web Audio graph uses a loopable generated buffer when buffer APIs exist',()=>{
  let copied=null,started=[],stopped=[];
  const source={buffer:null,loop:false,connect(){},start(time){started.push(time);},stop(time){stopped.push(time);}};
  const context={
    sampleRate:8000,
    createGain(){return{gain:{value:0},connect(){}};},
    createBuffer(channels,length,rate){
      assert.equal(channels,1);
      assert.equal(rate,8000);
      return{copyToChannel(samples){copied=samples;},getChannelData(){return new Float32Array(length);}};
    },
    createBufferSource(){return source;}
  };
  const graph=createProceduralBgmGraph(context,{},{durationSec:60});
  assert.equal(graph.sources.length,1);
  assert.ok(copied instanceof Float32Array);
  assert.ok(copied.some(value=>Math.abs(value)>0.001));
  assert.equal(source.loop,true);
  graph.start(2);
  assert.deepEqual(started,[2]);
  assert.ok(Math.abs(stopped[0]-62.2)<1e-9);
});
