function clean(value=''){ return String(value??'').trim().toLowerCase(); }

function provider(entry){
  return clean(entry?.candidate?.provider);
}
function isAuto(entry){
  return entry?.evaluation?.status==='eligible' && entry?.evaluation?.autoAdoptable===true;
}

export function selectArchiveProviderByRights(evaluatedCandidates, requirement){
  const entries=Array.isArray(evaluatedCandidates)?evaluatedCandidates:[];
  const type=clean(requirement?.requestedType);
  if(type!=='historical-source'&&type!=='document'){
    return {entries,selectedProvider:'',changed:false,reason:'not-archive'};
  }

  const auto=entries.filter(isAuto);
  const loc=auto.filter(entry=>provider(entry)==='library-of-congress');
  if(loc.length){
    return {
      entries:loc,
      selectedProvider:'library-of-congress',
      changed:loc.length!==entries.length,
      reason:'loc-auto-adoptable'
    };
  }

  const commons=auto.filter(entry=>provider(entry)==='wikimedia-commons');
  if(commons.length){
    return {
      entries:commons,
      selectedProvider:'wikimedia-commons',
      changed:commons.length!==entries.length,
      reason:'commons-auto-adoptable-fallback'
    };
  }

  return {
    entries,
    selectedProvider:'',
    changed:false,
    reason:'no-auto-adoptable-archive-provider'
  };
}
