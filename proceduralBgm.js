import { STANDARD_BGM_LIBRARY_VERSION, getStandardBgmPreset, isExplicitNoBgm, selectStandardBgmPreset } from './standardBgmLibrary.js';

function clean(value=''){ return String(value??'').trim(); }

export function isProceduralBgm(bgm){
  return Boolean(
    clean(bgm?.source).toLowerCase()==='procedural'
    && clean(bgm?.procedural?.preset || bgm?.preset)
  );
}

export function createStandardBgmSettingsFromPreset(presetId='calm-documentary',{guidance='',selection='manual'}={}){
  const preset=getStandardBgmPreset(presetId);
  return {
    source:'procedural',
    title:`Creator OS標準BGM｜${preset.label}`,
    category:preset.category,
    volume:preset.defaultVolume,
    ducking:true,
    fadeInSec:1.5,
    fadeOutSec:2.5,
    loop:true,
    license:'Creator OS標準BGM（外部音源不使用・クレジット不要）',
    credit:'',
    audioData:'',
    fileName:'',
    mimeType:'',
    procedural:{
      preset:preset.id,
      libraryVersion:STANDARD_BGM_LIBRARY_VERSION,
      selection,
      guidance:clean(guidance)
    }
  };
}

export function createProceduralBgmSettings(guidance=[],context={}){
  const items=Array.isArray(guidance)?guidance:[guidance];
  const text=items.map(clean).filter(Boolean).join(' ');
  if(isExplicitNoBgm(items)){
    return {
      source:'none',
      title:'BGMなし',
      category:'calm',
      volume:0,
      ducking:true,
      fadeInSec:0,
      fadeOutSec:0,
      loop:false,
      license:'',
      credit:'',
      audioData:'',
      fileName:'',
      mimeType:''
    };
  }
  const preset=selectStandardBgmPreset({
    guidance:items,
    tone:context?.tone,
    objective:context?.objective,
    genre:context?.genre
  });
  return createStandardBgmSettingsFromPreset(preset?.id||'calm-documentary',{guidance:text,selection:'auto'});
}

function presetConfig(name='calm-documentary'){
  return getStandardBgmPreset(name);
}
function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
function mixChord(chord,t){
  let sum=0;
  const gains=[0.34,0.20,0.12,0.08];
  chord.forEach((frequency,index)=>{
    const phase=index*0.37;
    const fundamental=Math.sin(Math.PI*2*frequency*t+phase);
    const harmonic=Math.sin(Math.PI*2*frequency*2*t+phase*0.7)*0.12;
    sum+=(fundamental+harmonic)*gains[index];
  });
  return sum;
}
function pluck(chord,tInChord,amount=0.12){
  const beat=Math.floor(tInChord);
  const local=tInChord-beat;
  const index=beat%chord.length;
  const frequency=chord[index]*2;
  const env=Math.exp(-4.4*local);
  return (
    Math.sin(Math.PI*2*frequency*local)+
    Math.sin(Math.PI*2*frequency*2*local)*0.18
  )*amount*env;
}
export function proceduralBgmSampleAt(timeSec,{preset='calm-documentary'}={}){
  const config=presetConfig(preset);
  const t=Math.max(0,Number(timeSec)||0);
  const loopTime=t%config.loopSec;
  const chordIndex=Math.floor(loopTime/config.chordSec)%config.chords.length;
  const nextIndex=(chordIndex+1)%config.chords.length;
  const inChord=loopTime%config.chordSec;
  const transitionStart=config.chordSec-0.85;
  const blend=clamp((inChord-transitionStart)/0.85,0,1);
  const smoothBlend=blend*blend*(3-2*blend);
  const current=mixChord(config.chords[chordIndex],t);
  const next=mixChord(config.chords[nextIndex],t);
  const pad=current*(1-smoothBlend)+next*smoothBlend;
  const pulseHz=Number(config.pulseHz)||0.125;
  const pulse=0.90+Math.sin(Math.PI*2*pulseHz*t)*0.10;
  return clamp((pad*pulse+pluck(config.chords[chordIndex],inChord,Number(config.pluckGain)||0.12))*(Number(config.padGain)||0.68),-1,1);
}

export function createProceduralPcmSamples({preset='calm-documentary',durationSec=16,sampleRate=22050}={}){
  const duration=Math.max(0.5,Math.min(120,Number(durationSec)||16));
  const rate=Math.max(8000,Math.min(48000,Math.round(Number(sampleRate)||22050)));
  const samples=new Float32Array(Math.floor(duration*rate));
  const fadeSec=Math.min(0.35,duration/4);
  for(let i=0;i<samples.length;i++){
    const t=i/rate;
    const fadeIn=fadeSec>0?clamp(t/fadeSec,0,1):1;
    const fadeOut=fadeSec>0?clamp((duration-t)/fadeSec,0,1):1;
    samples[i]=proceduralBgmSampleAt(t,{preset})*fadeIn*fadeOut;
  }
  return samples;
}

export function createProceduralBgmGraph(context,destination,{preset='calm-documentary',durationSec=60}={}){
  if(!context||typeof context.createGain!=='function'){
    throw new Error('自動BGM生成に必要なWeb Audio機能を利用できません。');
  }
  const duration=Math.max(0.5,Number(durationSec)||60);
  const config=presetConfig(preset);
  const sampleRate=Math.max(8000,Math.min(48000,Math.round(Number(context.sampleRate)||22050)));
  if(typeof context.createBuffer==='function'&&typeof context.createBufferSource==='function'){
    const samples=createProceduralPcmSamples({preset,durationSec:config.loopSec,sampleRate});
    const buffer=context.createBuffer(1,samples.length,sampleRate);
    if(typeof buffer.copyToChannel==='function')buffer.copyToChannel(samples,0);
    else buffer.getChannelData(0).set(samples);
    const source=context.createBufferSource();
    source.buffer=buffer;
    source.loop=duration>config.loopSec;
    source.connect(destination);
    return {
      sources:[source],
      gains:[],
      start(baseTime=0){
        source.start(baseTime);
        if(typeof source.stop==='function')source.stop(baseTime+duration+0.2);
      }
    };
  }

  if(typeof context.createOscillator!=='function'){
    throw new Error('自動BGM生成に必要なWeb Audio機能を利用できません。');
  }
  const sources=[];
  const gains=[];
  const chord=config.chords[0];
  chord.forEach((frequency,index)=>{
    const oscillator=context.createOscillator();
    const gain=context.createGain();
    oscillator.type=index<2?'sine':'triangle';
    oscillator.frequency.value=frequency;
    gain.gain.value=[0.16,0.10,0.06,0.04][index]||0.04;
    oscillator.connect(gain);
    gain.connect(destination);
    sources.push(oscillator);
    gains.push(gain);
  });
  return {
    sources,
    gains,
    start(baseTime=0){
      sources.forEach(source=>{
        source.start(baseTime);
        if(typeof source.stop==='function')source.stop(baseTime+duration+0.2);
      });
    }
  };
}

function writeAscii(view,offset,text){
  for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));
}
function clampSample(value){return Math.max(-1,Math.min(1,value));}
export function createProceduralPreviewWavBytes({preset='calm-documentary',durationSec=8,sampleRate=22050}={}){
  const duration=Math.max(1,Math.min(15,Number(durationSec)||8));
  const rate=Math.max(8000,Math.min(48000,Math.round(Number(sampleRate)||22050)));
  const pcm=createProceduralPcmSamples({preset,durationSec:duration,sampleRate:rate});
  const bytes=new Uint8Array(44+pcm.length*2);
  const view=new DataView(bytes.buffer);
  writeAscii(view,0,'RIFF');
  view.setUint32(4,36+pcm.length*2,true);
  writeAscii(view,8,'WAVE');
  writeAscii(view,12,'fmt ');
  view.setUint32(16,16,true);
  view.setUint16(20,1,true);
  view.setUint16(22,1,true);
  view.setUint32(24,rate,true);
  view.setUint32(28,rate*2,true);
  view.setUint16(32,2,true);
  view.setUint16(34,16,true);
  writeAscii(view,36,'data');
  view.setUint32(40,pcm.length*2,true);
  for(let i=0;i<pcm.length;i++){
    view.setInt16(44+i*2,Math.round(clampSample(pcm[i]*0.82)*32767),true);
  }
  return bytes;
}
export function createProceduralPreviewWavBlob(options={}){
  return new Blob([createProceduralPreviewWavBytes(options)],{type:'audio/wav'});
}
export function ensurePlaybackAudioSession(navigatorLike=globalThis.navigator,timer=globalThis.setTimeout){
  try{
    const session=navigatorLike?.audioSession;
    if(!session)return false;
    session.type='ambient';
    if(typeof timer==='function'){
      timer(()=>{try{session.type='playback';}catch{}},0);
    }else{
      session.type='playback';
    }
    return true;
  }catch{
    return false;
  }
}
