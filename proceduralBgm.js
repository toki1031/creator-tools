function clean(value=''){ return String(value??'').trim(); }

export function isProceduralBgm(bgm){
  return Boolean(
    clean(bgm?.source).toLowerCase()==='procedural'
    && clean(bgm?.procedural?.preset || bgm?.preset)
  );
}

export function createProceduralBgmSettings(guidance=[]){
  const items=Array.isArray(guidance)?guidance:[guidance];
  const text=items.map(clean).filter(Boolean).join(' ');
  if(!text)return null;
  const calm=/静か|落ち着|教養|documentary|ドキュメンタリー|calm/i.test(text);
  const preset=calm?'calm-documentary':'calm-documentary';
  return {
    source:'procedural',
    title:'Creator OS 自動BGM',
    category:calm?'calm':'calm',
    volume:0.08,
    ducking:true,
    fadeInSec:1.5,
    fadeOutSec:2.5,
    loop:true,
    license:'Creator OS内生成（外部音源不使用）',
    credit:'',
    audioData:'',
    fileName:'',
    mimeType:'',
    procedural:{preset,guidance:text}
  };
}

const PRESETS={
  'calm-documentary':{
    voices:[
      {frequency:146.83,type:'sine',gain:0.20,detune:-3},
      {frequency:220.00,type:'sine',gain:0.14,detune:2},
      {frequency:293.66,type:'triangle',gain:0.07,detune:-1}
    ]
  }
};

export function createProceduralBgmGraph(context,destination,{preset='calm-documentary',durationSec=60}={}){
  if(!context||typeof context.createOscillator!=='function'||typeof context.createGain!=='function'){
    throw new Error('自動BGM生成に必要なWeb Audio機能を利用できません。');
  }
  const config=PRESETS[preset]||PRESETS['calm-documentary'];
  const duration=Math.max(0.5,Number(durationSec)||60);
  const sources=[];
  const gains=[];
  for(const voice of config.voices){
    const oscillator=context.createOscillator();
    const gain=context.createGain();
    oscillator.type=voice.type;
    if(oscillator.frequency) oscillator.frequency.value=voice.frequency;
    if(oscillator.detune) oscillator.detune.value=voice.detune||0;
    if(gain.gain) gain.gain.value=voice.gain;
    oscillator.connect(gain);
    gain.connect(destination);
    sources.push(oscillator);
    gains.push(gain);
  }
  return {
    sources,
    gains,
    start(baseTime=0){
      for(const source of sources){
        source.start(baseTime);
        if(typeof source.stop==='function') source.stop(baseTime+duration+0.2);
      }
    }
  };
}

function writeAscii(view,offset,text){
  for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));
}
function clampSample(value){return Math.max(-1,Math.min(1,value));}
export function createProceduralPreviewWavBytes({durationSec=6.6,sampleRate=22050}={}){
  const duration=Math.max(1,Math.min(15,Number(durationSec)||6.6));
  const rate=Math.max(8000,Math.min(48000,Math.round(Number(sampleRate)||22050)));
  const samples=Math.floor(duration*rate);
  const bytes=new Uint8Array(44+samples*2);
  const view=new DataView(bytes.buffer);
  writeAscii(view,0,'RIFF');
  view.setUint32(4,36+samples*2,true);
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
  view.setUint32(40,samples*2,true);

  const bgmStart=0.45;
  for(let i=0;i<samples;i++){
    const t=i/rate;
    let value=0;
    if(t<0.28){
      const cueEnv=Math.min(1,t/0.02)*Math.min(1,(0.28-t)/0.04);
      value+=Math.sin(Math.PI*2*659.25*t)*0.55*cueEnv;
    }
    if(t>=bgmStart){
      const x=t-bgmStart;
      const fadeIn=Math.min(1,x/0.35);
      const fadeOut=Math.min(1,Math.max(0,duration-t)/0.35);
      const env=fadeIn*fadeOut;
      const pad=(
        Math.sin(Math.PI*2*146.83*x)*0.34+
        Math.sin(Math.PI*2*220*x)*0.25+
        Math.sin(Math.PI*2*293.66*x)*0.14
      );
      value+=pad*0.62*env;
    }
    view.setInt16(44+i*2,Math.round(clampSample(value)*32767),true);
  }
  return bytes;
}
export function createProceduralPreviewWavBlob(options={}){
  return new Blob([createProceduralPreviewWavBytes(options)],{type:'audio/wav'});
}
export function ensurePlaybackAudioSession(navigatorLike=globalThis.navigator){
  try{
    const session=navigatorLike?.audioSession;
    if(!session)return false;
    session.type='playback';
    return true;
  }catch{
    return false;
  }
}
