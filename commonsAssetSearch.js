const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const SUPPORTED_TYPES = new Set(['historical-source','document']);

function clean(value=''){ return String(value ?? '').trim(); }
function textMeta(value=''){
  return clean(value)
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/\s+/g,' ')
    .trim();
}
function meta(ext,key){ return textMeta(ext?.[key]?.value); }
function pageUrl(title=''){
  const name=clean(title).replace(/ /g,'_');
  return name ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(name)}` : '';
}

export function buildCommonsSearchQueries(plan){
  if(!plan || plan.status!=='ready' || !SUPPORTED_TYPES.has(clean(plan.requestedType))) return [];
  const original=clean(plan.queries?.[0]);
  if(!original) return [];
  const queries=[original];
  const years=[...new Set(original.match(/\b(?:17|18|19|20)\d{2}\b/g)||[])];
  const english=[];
  if(/ナイチンゲール|florence\s+nightingale/i.test(original)) english.push('Florence Nightingale');
  if(/統計図|統計グラフ|polar\s+area|coxcomb|statistical\s+diagram/i.test(original)) english.push('mortality diagram');
  else if(/図表|diagram/i.test(original)) english.push('diagram');
  if(/死亡|mortality/i.test(original) && !english.some(x=>/mortality/i.test(x))) english.push('mortality');
  if(/軍|army/i.test(original)) english.push('army');
  english.push(...years);
  const alias=english.join(' ').trim();
  if(alias && alias.toLowerCase()!==original.toLowerCase()) queries.push(alias);
  return [...new Set(queries)];
}

export function buildCommonsSearchUrl(query,{count=5}={}){
  const q=clean(query); if(!q)return '';
  const url=new URL(COMMONS_API);
  url.searchParams.set('action','query');
  url.searchParams.set('generator','search');
  url.searchParams.set('gsrsearch',q);
  url.searchParams.set('gsrnamespace','6');
  url.searchParams.set('gsrlimit',String(Math.max(1,Math.min(Number(count)||5,10))));
  url.searchParams.set('prop','imageinfo');
  url.searchParams.set('iiprop','url|mime|size|extmetadata');
  url.searchParams.set('iiurlwidth','1600');
  url.searchParams.set('format','json');
  url.searchParams.set('formatversion','2');
  url.searchParams.set('origin','*');
  return url.toString();
}

function classifyLicense(ext={}){
  const license=meta(ext,'LicenseShortName')||meta(ext,'UsageTerms');
  const licenseUrl=meta(ext,'LicenseUrl');
  const lower=`${license} ${licenseUrl}`.toLowerCase();
  const free=/\bcc0\b|public domain|publicdomain|public domain mark|pdm/i.test(lower);
  return {
    license,
    licenseUrl,
    rightsStatus:free?'rights-cleared-signal':'needs-review',
    signal:free?'public-domain-or-cc0':'license-review-required'
  };
}

export function normalizeCommonsCandidate(page,plan){
  if(!page || typeof page!=='object')return null;
  const info=Array.isArray(page.imageinfo)?page.imageinfo[0]:null;
  if(!info)return null;
  const ext=info.extmetadata||{};
  const sourceUrl=pageUrl(page.title);
  const previewUrl=clean(info.thumburl||info.url);
  if(!sourceUrl||!previewUrl)return null;
  const rights=classifyLicense(ext);
  const artist=meta(ext,'Artist');
  const credit=meta(ext,'Credit')||meta(ext,'Attribution');
  const description=meta(ext,'ImageDescription');
  const date=meta(ext,'DateTimeOriginal')||meta(ext,'DateTime');
  const rightsStatements=[rights.license,meta(ext,'UsageTerms')].filter(Boolean);
  return {
    provider:'wikimedia-commons',
    sceneId:clean(plan?.sceneId),
    requestedType:clean(plan?.requestedType),
    title:clean(page.title).replace(/^File:/i,''),
    sourceUrl,
    previewUrl,
    mimeType:clean(info.mime),
    width:Number(info.width)||0,
    height:Number(info.height)||0,
    sizeBytes:Number(info.size)||0,
    date,
    contributors:[artist].filter(Boolean),
    description,
    rightsStatements:[...new Set(rightsStatements)],
    rightsStatus:rights.rightsStatus,
    license:rights.license,
    licenseUrl:rights.licenseUrl,
    attribution:credit||artist,
    rightsCheck:{
      status:rights.rightsStatus,
      signal:rights.signal,
      source:'commons-extmetadata',
      licenseShortName:rights.license,
      sourceUrl
    },
    autoAdoptable:false
  };
}

export function normalizeCommonsResults(payload,plan){
  const pages=Array.isArray(payload?.query?.pages)?payload.query.pages:[];
  return pages.map(page=>normalizeCommonsCandidate(page,plan)).filter(Boolean);
}

export async function searchCommonsCandidates(plan,{fetchImpl=globalThis.fetch,count=5}={}){
  const queries=buildCommonsSearchQueries(plan);
  if(!queries.length)return {status:'blocked',candidates:[],reason:'Commons検索対象ではないか、検索計画が未確定です'};
  if(typeof fetchImpl!=='function')return {status:'error',candidates:[],reason:'Commons検索機能を利用できません'};
  const attempts=[];
  for(const query of queries){
    const url=buildCommonsSearchUrl(query,{count});
    let response;
    try{response=await fetchImpl(url,{headers:{Accept:'application/json'}});}
    catch(error){attempts.push({query,status:'network-error',detail:clean(error?.message)});continue;}
    if(!response?.ok){attempts.push({query,status:`http-${response?.status??'unknown'}`});continue;}
    let payload;
    try{payload=await response.json();}
    catch(error){attempts.push({query,status:'json-error',detail:clean(error?.message)});continue;}
    const candidates=normalizeCommonsResults(payload,plan);
    attempts.push({query,status:'ok',count:candidates.length});
    if(candidates.length)return {status:'ok',candidates,reason:'',queryUsed:query,attempts};
  }
  const anyOk=attempts.some(item=>item.status==='ok');
  return {status:anyOk?'ok':'error',candidates:[],reason:anyOk?'Commonsで素材候補が見つかりません':'Commons APIへの通信または応答確認に失敗しました',attempts};
}
