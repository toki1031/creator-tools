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
