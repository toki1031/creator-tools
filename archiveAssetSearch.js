import { searchLocCandidates } from './locAssetSearch.js';
import { searchCommonsCandidates } from './commonsAssetSearch.js';

function resultCandidates(result){ return Array.isArray(result?.candidates)?result.candidates:[]; }
function clean(value=''){return String(value??'').trim().toLowerCase();}
const STOPWORDS=new Set(['scene','image','visual','photo','picture','the','and','for','with','from','this','that','する','した','して','その','この','もの','こと','場面','映像','画像','実物','史料','資料']);
function intentTerms(value=''){
  const normalized=clean(value).normalize('NFKC');
  const latin=normalized.match(/[a-z][a-z0-9'-]{2,}/g)||[];
  const years=normalized.match(/\b(?:17|18|19|20)\d{2}\b/g)||[];
  const japanese=normalized.match(/[一-龠々ぁ-んァ-ヶー]{2,}/g)||[];
  return [...new Set([...years,...latin,...japanese].map(clean).filter(term=>term&&!STOPWORDS.has(term)))];
}
function candidateText(candidate={}){
  return [candidate.title,candidate.description,candidate.date,...(Array.isArray(candidate.contributors)?candidate.contributors:[])]
    .map(clean).filter(Boolean).join(' ');
}
export function archiveIntentMatchScore(candidate,query=''){
  const terms=intentTerms(query);
  if(!terms.length)return 0;
  const haystack=candidateText(candidate);
  return terms.reduce((score,term)=>score+(haystack.includes(term)?1:0),0);
}
export function filterArchiveCandidatesForIntent(candidates,plan){
  const list=resultCandidates({candidates});
  const query=String(plan?.queries?.[0]??'');
  const terms=intentTerms(query);
  if(!terms.length)return list;
  const scored=list.map(candidate=>({candidate,score:archiveIntentMatchScore(candidate,query)}));
  const best=Math.max(0,...scored.map(item=>item.score));
  // Search providers already used the full query. Metadata matching is a conservative relevance
  // refinement only; never discard every provider result merely because metadata is sparse.
  return best>0?scored.filter(item=>item.score>0).map(item=>item.candidate):list;
}

export async function searchArchiveCandidates(plan,{
  searchLoc=searchLocCandidates,
  searchCommons=searchCommonsCandidates
}={}){
  const attempts=[];
  let loc;
  try{loc=await searchLoc(plan);}catch(error){loc={status:'error',candidates:[],reason:String(error?.message||'LoC検索に失敗しました')};}
  const locCandidates=filterArchiveCandidatesForIntent(resultCandidates(loc),plan).map(candidate=>({...candidate,provider:candidate?.provider||'library-of-congress'}));
  attempts.push({provider:'library-of-congress',status:loc?.status||'error',count:resultCandidates(loc).length,matchedCount:locCandidates.length,reason:loc?.reason||''});
  let commons;
  try{commons=await searchCommons(plan);}catch(error){commons={status:'error',candidates:[],reason:String(error?.message||'Commons検索に失敗しました')};}
  const commonsCandidates=filterArchiveCandidatesForIntent(resultCandidates(commons),plan).map(candidate=>({...candidate,provider:candidate?.provider||'wikimedia-commons'}));
  attempts.push({provider:'wikimedia-commons',status:commons?.status||'error',count:resultCandidates(commons).length,matchedCount:commonsCandidates.length,reason:commons?.reason||''});
  const combined=[...locCandidates,...commonsCandidates];
  if(combined.length){
    const providers=[...new Set(combined.map(candidate=>candidate?.provider).filter(Boolean))];
    return {status:'ok',candidates:combined,provider:providers.length===1?providers[0]:'archive-combined',attempts,reason:''};
  }
  if(loc?.status==='ok'||commons?.status==='ok')return {status:'ok',candidates:[],reason:'アーカイブ素材候補が見つかりません',provider:'archive-fallback',attempts};
  return {status:'error',candidates:[],reason:commons?.reason||loc?.reason||'アーカイブ検索を継続できません',provider:'archive-fallback',attempts};
}
