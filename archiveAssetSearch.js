import { searchLocCandidates } from './locAssetSearch.js';
import { searchCommonsCandidates } from './commonsAssetSearch.js';

function resultCandidates(result){ return Array.isArray(result?.candidates)?result.candidates:[]; }
function candidateText(candidate={}){
  return [candidate.title,candidate.description,candidate.date,...(Array.isArray(candidate.contributors)?candidate.contributors:[])]
    .map(value=>String(value??'').trim()).filter(Boolean).join(' ').toLowerCase();
}
export function filterArchiveCandidatesForIntent(candidates,plan){
  const query=String(plan?.queries?.[0]??'').toLowerCase();
  const requireNightingale=/ナイチンゲール|florence\s+nightingale/.test(query);
  const requireDiagram=/統計図|統計グラフ|図表|diagram|chart|coxcomb|polar\s+area/.test(query);
  if(!requireNightingale&&!requireDiagram)return resultCandidates({candidates});
  return resultCandidates({candidates}).filter(candidate=>{
    const haystack=candidateText(candidate);
    if(requireNightingale&&!/nightingale|ナイチンゲール/.test(haystack))return false;
    if(requireDiagram&&!/diagram|chart|coxcomb|mortality|statistical|統計/.test(haystack))return false;
    return true;
  });
}

export async function searchArchiveCandidates(plan,{
  searchLoc=searchLocCandidates,
  searchCommons=searchCommonsCandidates
}={}){
  const attempts=[];
  let loc;
  try{loc=await searchLoc(plan);}catch(error){loc={status:'error',candidates:[],reason:String(error?.message||'LoC検索に失敗しました')};}
  const locCandidates=filterArchiveCandidatesForIntent(resultCandidates(loc),plan);
  attempts.push({provider:'library-of-congress',status:loc?.status||'error',count:resultCandidates(loc).length,matchedCount:locCandidates.length,reason:loc?.reason||''});
  if(loc?.status==='ok'&&locCandidates.length){
    return {...loc,candidates:locCandidates,provider:'library-of-congress',attempts};
  }

  let commons;
  try{commons=await searchCommons(plan);}catch(error){commons={status:'error',candidates:[],reason:String(error?.message||'Commons検索に失敗しました')};}
  const commonsCandidates=filterArchiveCandidatesForIntent(resultCandidates(commons),plan);
  attempts.push({provider:'wikimedia-commons',status:commons?.status||'error',count:resultCandidates(commons).length,matchedCount:commonsCandidates.length,reason:commons?.reason||''});
  if(commons?.status==='ok'){
    return {...commons,candidates:commonsCandidates,provider:'wikimedia-commons',attempts};
  }
  if(loc?.status==='ok'){
    return {status:'ok',candidates:[],reason:'アーカイブ素材候補が見つかりません',provider:'archive-fallback',attempts};
  }
  return {status:'error',candidates:[],reason:commons?.reason||loc?.reason||'アーカイブ検索を継続できません',provider:'archive-fallback',attempts};
}
