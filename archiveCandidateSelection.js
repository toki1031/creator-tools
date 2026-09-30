function clean(value=''){return String(value??'').trim();}
function text(candidate={}){
  return [candidate.title,candidate.description,candidate.date,...(Array.isArray(candidate.contributors)?candidate.contributors:[])]
    .map(clean).filter(Boolean).join(' ').toLowerCase();
}
function explicitIntent(query=''){
  const value=clean(query).toLowerCase();
  const years=[...new Set(value.match(/\b(?:17|18|19|20)\d{2}\b/g)||[])];
  return {
    years,
    nightingale:/ナイチンゲール|florence\s+nightingale/.test(value),
    diagram:/統計図|統計グラフ|図表|diagram|chart|coxcomb|polar\s+area|mortality/.test(value)
  };
}
function matches(candidate,intent){
  const haystack=text(candidate);
  if(intent.nightingale&&!/nightingale|ナイチンゲール/.test(haystack))return false;
  if(intent.diagram&&!/diagram|chart|coxcomb|mortality|statistical|統計/.test(haystack))return false;
  if(intent.years.length&&!intent.years.some(year=>haystack.includes(year)))return false;
  return true;
}
function imageArea(candidate={}){
  const mime=clean(candidate.mimeType).toLowerCase();
  if(!mime.startsWith('image/'))return 0;
  const width=Number(candidate.width)||0,height=Number(candidate.height)||0;
  return width>0&&height>0?width*height:0;
}

export function selectEquivalentArchiveCandidate(evaluatedCandidates,requirement){
  const entries=Array.isArray(evaluatedCandidates)?evaluatedCandidates:[];
  const requestedType=clean(requirement?.requestedType);
  if(requestedType!=='historical-source'&&requestedType!=='document')return{entries,selected:false,reason:'not-archive'};
  const intent=explicitIntent(requirement?.queryHint);
  const constraintCount=Number(intent.nightingale)+Number(intent.diagram)+Number(intent.years.length>0);
  if(constraintCount<2)return{entries,selected:false,reason:'insufficient-explicit-intent'};
  const eligible=entries.filter(entry=>entry?.evaluation?.status==='eligible'&&entry?.evaluation?.autoAdoptable===true);
  if(eligible.length<2)return{entries,selected:false,reason:'not-multiple-auto-adoptable'};
  const matching=eligible.filter(entry=>matches(entry.candidate,intent)&&imageArea(entry.candidate)>0);
  if(matching.length<2)return{entries,selected:false,reason:'not-multiple-equivalent-images'};
  const ranked=matching.map(entry=>({entry,area:imageArea(entry.candidate)})).sort((a,b)=>b.area-a.area);
  if(!ranked[0]?.area||ranked[0].area===ranked[1]?.area)return{entries,selected:false,reason:'resolution-tie-or-missing'};
  return{
    entries:[ranked[0].entry],
    selected:true,
    reason:'unique-highest-resolution-equivalent-archive',
    selectedSourceUrl:clean(ranked[0].entry?.candidate?.sourceUrl||ranked[0].entry?.candidate?.sourcePage)
  };
}
