import { searchLocCandidates } from './locAssetSearch.js';
import { searchCommonsCandidates } from './commonsAssetSearch.js';

function resultCandidates(result){ return Array.isArray(result?.candidates)?result.candidates:[]; }

export async function searchArchiveCandidates(plan,{
  searchLoc=searchLocCandidates,
  searchCommons=searchCommonsCandidates
}={}){
  const attempts=[];
  let loc;
  try{loc=await searchLoc(plan);}catch(error){loc={status:'error',candidates:[],reason:String(error?.message||'LoC検索に失敗しました')};}
  attempts.push({provider:'library-of-congress',status:loc?.status||'error',count:resultCandidates(loc).length,reason:loc?.reason||''});
  if(loc?.status==='ok'&&resultCandidates(loc).length){
    return {...loc,provider:'library-of-congress',attempts};
  }

  let commons;
  try{commons=await searchCommons(plan);}catch(error){commons={status:'error',candidates:[],reason:String(error?.message||'Commons検索に失敗しました')};}
  attempts.push({provider:'wikimedia-commons',status:commons?.status||'error',count:resultCandidates(commons).length,reason:commons?.reason||''});
  if(commons?.status==='ok'){
    return {...commons,provider:'wikimedia-commons',attempts};
  }
  if(loc?.status==='ok'){
    return {status:'ok',candidates:[],reason:'アーカイブ素材候補が見つかりません',provider:'archive-fallback',attempts};
  }
  return {status:'error',candidates:[],reason:commons?.reason||loc?.reason||'アーカイブ検索を継続できません',provider:'archive-fallback',attempts};
}
