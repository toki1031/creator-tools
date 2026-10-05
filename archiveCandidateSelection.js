import { archiveIntentMatchScore } from './archiveAssetSearch.js';
function clean(value=''){return String(value??'').trim();}
function imageArea(candidate={}){
  const mime=clean(candidate.mimeType).toLowerCase();
  if(!mime.startsWith('image/'))return 0;
  const width=Number(candidate.width)||0,height=Number(candidate.height)||0;
  return width>0&&height>0?width*height:0;
}
function sourceKey(candidate={}){
  return clean(candidate.sourceUrl||candidate.sourcePage||candidate.pageUrl);
}
export function selectEquivalentArchiveCandidate(evaluatedCandidates,requirement){
  const entries=Array.isArray(evaluatedCandidates)?evaluatedCandidates:[];
  const requestedType=clean(requirement?.requestedType);
  if(requestedType!=='historical-source'&&requestedType!=='document')return{entries,selected:false,reason:'not-archive'};
  const eligible=entries.filter(entry=>entry?.evaluation?.status==='eligible'&&entry?.evaluation?.autoAdoptable===true);
  if(eligible.length<2)return{entries,selected:false,reason:'not-multiple-auto-adoptable'};
  const query=clean(requirement?.queryHint);
  const ranked=eligible.map(entry=>({
    entry,
    relevance:archiveIntentMatchScore(entry.candidate,query),
    area:imageArea(entry.candidate),
    source:sourceKey(entry.candidate)
  })).filter(item=>item.area>0)
    .sort((a,b)=>b.relevance-a.relevance||b.area-a.area||a.source.localeCompare(b.source));
  if(ranked.length<2)return{entries,selected:false,reason:'not-multiple-comparable-images'};
  const first=ranked[0],second=ranked[1];
  // Relevance must uniquely beat the runner-up, or equal-relevance candidates must have a
  // unique higher-resolution representation. Exact ties remain review-only.
  const uniqueRelevance=first.relevance>second.relevance;
  const uniqueResolution=first.relevance===second.relevance&&first.area>second.area;
  if(!uniqueRelevance&&!uniqueResolution)return{entries,selected:false,reason:'relevance-resolution-tie'};
  return{
    entries:[first.entry],
    selected:true,
    reason:uniqueRelevance?'unique-best-metadata-match':'unique-highest-resolution-equivalent-archive',
    selectedSourceUrl:first.source
  };
}
