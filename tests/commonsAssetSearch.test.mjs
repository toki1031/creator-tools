import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommonsSearchQueries, buildCommonsSearchUrl, normalizeCommonsCandidate, searchCommonsCandidates } from '../commonsAssetSearch.js';

const plan={sceneId:'scene-5',order:5,requestedType:'historical-source',queries:['ナイチンゲールの統計図 1858'],status:'ready'};

function page(license='Public domain'){
  return {
    title:'File:Nightingale-mortality.jpg',
    imageinfo:[{
      url:'https://upload.wikimedia.org/example/original.jpg',
      thumburl:'https://upload.wikimedia.org/example/thumb.jpg',
      mime:'image/jpeg',
      width:6996,
      height:3826,
      size:5320000,
      extmetadata:{
        LicenseShortName:{value:license},
        LicenseUrl:{value:license==='CC BY 4.0'?'https://creativecommons.org/licenses/by/4.0/':'https://creativecommons.org/publicdomain/mark/1.0/'},
        Artist:{value:'Florence Nightingale'},
        Credit:{value:'Public domain source'},
        ImageDescription:{value:'Diagram of the causes of mortality in the army in the East'},
        DateTimeOriginal:{value:'1858'}
      }
    }]
  };
}

test('builds original and Nightingale English archive queries',()=>{
  const queries=buildCommonsSearchQueries(plan);
  assert.equal(queries[0],plan.queries[0]);
  assert.ok(queries.some(q=>/Florence Nightingale/i.test(q)));
  assert.ok(queries.some(q=>/mortality diagram/i.test(q)));
  assert.ok(queries.some(q=>/1858/.test(q)));
});

test('builds Commons file-namespace search with imageinfo metadata',()=>{
  const url=new URL(buildCommonsSearchUrl('Florence Nightingale mortality diagram 1858',{count:50}));
  assert.equal(url.origin,'https://commons.wikimedia.org');
  assert.equal(url.pathname,'/w/api.php');
  assert.equal(url.searchParams.get('generator'),'search');
  assert.equal(url.searchParams.get('gsrnamespace'),'6');
  assert.equal(url.searchParams.get('gsrlimit'),'10');
  assert.equal(url.searchParams.get('prop'),'imageinfo');
  assert.match(url.searchParams.get('iiprop'),/extmetadata/);
  assert.equal(url.searchParams.get('origin'),'*');
});

test('normalizes Public Domain metadata as a rights-cleared signal with provenance',()=>{
  const candidate=normalizeCommonsCandidate(page(),plan);
  assert.equal(candidate.provider,'wikimedia-commons');
  assert.equal(candidate.requestedType,'historical-source');
  assert.match(candidate.sourceUrl,/commons\.wikimedia\.org\/wiki\//);
  assert.match(candidate.previewUrl,/upload\.wikimedia\.org/);
  assert.equal(candidate.rightsStatus,'rights-cleared-signal');
  assert.equal(candidate.mimeType,'image/jpeg');
  assert.equal(candidate.width,6996);
  assert.equal(candidate.height,3826);
  assert.equal(candidate.sizeBytes,5320000);
  assert.equal(candidate.rightsCheck.signal,'public-domain-or-cc0');
  assert.equal(candidate.rightsCheck.source,'commons-extmetadata');
  assert.equal(candidate.license,'Public domain');
  assert.equal(candidate.attribution,'Public domain source');
  assert.equal(candidate.date,'1858');
});

test('keeps CC BY metadata in review instead of auto-clearing it',()=>{
  const candidate=normalizeCommonsCandidate(page('CC BY 4.0'),plan);
  assert.equal(candidate.rightsStatus,'needs-review');
  assert.equal(candidate.rightsCheck.signal,'license-review-required');
});

test('search retries with English archive query after Japanese query has no files',async()=>{
  const seen=[];
  const result=await searchCommonsCandidates(plan,{fetchImpl:async url=>{
    const query=new URL(url).searchParams.get('gsrsearch');
    seen.push(query);
    const found=/Florence Nightingale/i.test(query);
    return {ok:true,json:async()=>found?{query:{pages:[page()]}}:{query:{pages:[]}}};
  }});
  assert.equal(result.status,'ok');
  assert.equal(result.candidates.length,1);
  assert.equal(seen[0],plan.queries[0]);
  assert.ok(seen.some(q=>/Florence Nightingale/i.test(q)));
  assert.match(result.queryUsed,/Florence Nightingale/i);
});

test('blocked plans perform zero Commons requests',async()=>{
  let calls=0;
  const result=await searchCommonsCandidates({...plan,status:'blocked'},{fetchImpl:async()=>{calls++;}});
  assert.equal(result.status,'blocked');
  assert.equal(calls,0);
});
