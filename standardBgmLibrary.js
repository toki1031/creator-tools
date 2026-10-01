const clean=value=>String(value??'').trim();

export const STANDARD_BGM_LIBRARY_VERSION=1;

const PRESETS=[
  {
    id:'calm-documentary',
    label:'静かなドキュメンタリー',
    category:'calm',
    description:'教養・解説・人物紹介に使いやすい落ち着いた標準BGM',
    keywords:['静か','落ち着','教養','解説','documentary','ドキュメンタリー','calm'],
    defaultVolume:0.08,
    loopSec:16,
    chordSec:4,
    padGain:0.68,
    pluckGain:0.12,
    pulseHz:0.125,
    chords:[
      [146.83,220.00,293.66,329.63],
      [116.54,174.61,220.00,293.66],
      [174.61,261.63,392.00,440.00],
      [130.81,196.00,293.66,329.63]
    ]
  },
  {
    id:'history-gravity',
    label:'歴史・重厚',
    category:'history',
    description:'歴史・史料・偉人の転換点を静かに重く見せる標準BGM',
    keywords:['歴史','史料','戦争','時代','改革','重厚','history','historical'],
    defaultVolume:0.075,
    loopSec:20,
    chordSec:5,
    padGain:0.72,
    pluckGain:0.07,
    pulseHz:0.08,
    chords:[
      [110.00,164.81,220.00,261.63],
      [98.00,146.83,196.00,246.94],
      [123.47,185.00,246.94,293.66],
      [92.50,138.59,185.00,220.00]
    ]
  },
  {
    id:'gentle-learning',
    label:'教養・やさしい',
    category:'calm',
    description:'知育・学び・やさしい説明に合う明るく柔らかな標準BGM',
    keywords:['やさしい','優しい','知育','学び','教育','子ども','親子','gentle','education'],
    defaultVolume:0.085,
    loopSec:16,
    chordSec:4,
    padGain:0.58,
    pluckGain:0.16,
    pulseHz:0.16,
    chords:[
      [196.00,246.94,293.66,392.00],
      [174.61,220.00,261.63,349.23],
      [220.00,277.18,329.63,440.00],
      [164.81,220.00,261.63,329.63]
    ]
  },
  {
    id:'challenge-forward',
    label:'挑戦・前進',
    category:'challenge',
    description:'行動・成長・挑戦を前向きに見せる標準BGM',
    keywords:['挑戦','前進','行動','成長','未来','突破','チャレンジ','challenge','forward'],
    defaultVolume:0.08,
    loopSec:12,
    chordSec:3,
    padGain:0.60,
    pluckGain:0.20,
    pulseHz:0.22,
    chords:[
      [146.83,185.00,220.00,293.66],
      [164.81,207.65,246.94,329.63],
      [196.00,246.94,293.66,392.00],
      [130.81,164.81,196.00,261.63]
    ]
  },
  {
    id:'emotional-afterglow',
    label:'感動・余韻',
    category:'emotion',
    description:'希望・感謝・締めの余韻を穏やかに残す標準BGM',
    keywords:['感動','余韻','希望','感謝','心','家族','emotion','emotional'],
    defaultVolume:0.075,
    loopSec:20,
    chordSec:5,
    padGain:0.66,
    pluckGain:0.09,
    pulseHz:0.10,
    chords:[
      [174.61,220.00,261.63,349.23],
      [130.81,174.61,220.00,261.63],
      [146.83,196.00,246.94,293.66],
      [164.81,207.65,261.63,329.63]
    ]
  }
];

const byId=new Map(PRESETS.map(item=>[item.id,item]));

export function listStandardBgmPresets(){
  return PRESETS.map(item=>({...item,chords:item.chords.map(chord=>[...chord]),keywords:[...item.keywords]}));
}

export function getStandardBgmPreset(id='calm-documentary'){
  const item=byId.get(clean(id))||byId.get('calm-documentary');
  return {...item,chords:item.chords.map(chord=>[...chord]),keywords:[...item.keywords]};
}

export function isExplicitNoBgm(guidance=[]){
  const items=Array.isArray(guidance)?guidance:[guidance];
  const text=items.map(clean).filter(Boolean).join(' ');
  return /(?:BGM|音楽|music)\s*(?:は)?\s*(?:なし|無し|不要|使わない|入れない)|無音/i.test(text);
}

function scorePreset(preset,text,weight=1){
  let score=0;
  for(const keyword of preset.keywords){
    if(text.toLowerCase().includes(keyword.toLowerCase()))score+=weight;
  }
  return score;
}

export function selectStandardBgmPreset({guidance=[],tone='',objective='',genre=''}={}){
  if(isExplicitNoBgm(guidance))return null;
  const guidanceText=(Array.isArray(guidance)?guidance:[guidance]).map(clean).filter(Boolean).join(' ');
  const contextText=[clean(tone),clean(objective)].filter(Boolean).join(' ');
  let best=null;
  for(const preset of PRESETS){
    const score=scorePreset(preset,guidanceText,4)+scorePreset(preset,contextText,1);
    if(!best||score>best.score)best={preset,score};
  }
  if(best&&best.score>0)return getStandardBgmPreset(best.preset.id);

  const genreDefaults={
    education:'gentle-learning',
    fortune:'emotional-afterglow',
    'great-person':'calm-documentary',
    bgm:'calm-documentary',
    other:'calm-documentary'
  };
  return getStandardBgmPreset(genreDefaults[clean(genre)]||'calm-documentary');
}
