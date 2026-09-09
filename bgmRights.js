const text=value=>String(value??'').trim();

export function assessBgmRights(source={}){
  const commercial=text(source.commercialUse||source.commercialUseAllowed);
  const license=text(source.license);
  const sourceUrl=text(source.sourceUrl);
  const credit=text(source.credit);
  if(commercial==='not-allowed'||commercial==='false'){
    return {status:'blocked',commercialUse:'not-allowed',license,sourceUrl,credit,message:'商用利用不可として登録されています。'};
  }
  const missing=[];
  if(!sourceUrl) missing.push('配布元URL');
  if(!license) missing.push('ライセンス');
  if(commercial!=='allowed'&&commercial!=='true') missing.push('商用利用可否');
  return {
    status:missing.length?'review':'ready',
    commercialUse:commercial||'unknown',license,sourceUrl,credit,missing,
    message:missing.length?`要確認：${missing.join('・')}`:'権利情報確認済み'
  };
}

export function createBgmCreditLines(source={}){
  const lines=[];
  const title=text(source.title);
  const credit=text(source.credit);
  const license=text(source.license);
  const sourceUrl=text(source.sourceUrl);
  if(title) lines.push(`BGM: ${title}`);
  if(credit) lines.push(`Credit: ${credit}`);
  if(license) lines.push(`License: ${license}`);
  if(sourceUrl) lines.push(`Source: ${sourceUrl}`);
  return lines;
}

export function summarizeBgmRights(tracks=[]){
  const rows=(Array.isArray(tracks)?tracks:[]).map(track=>({id:text(track?.id),...assessBgmRights(track)}));
  return {
    total:rows.length,
    ready:rows.filter(row=>row.status==='ready').length,
    review:rows.filter(row=>row.status==='review').length,
    blocked:rows.filter(row=>row.status==='blocked').length,
    rows
  };
}
