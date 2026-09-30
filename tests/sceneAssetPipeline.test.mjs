import test from 'node:test';
import assert from 'node:assert/strict';
import { runSceneAssetPipeline } from '../sceneAssetPipeline.js';

const scene = {
  id: 'scene-1', order: 1,
  productionDirection: {
    assetType: 'historical-source',
    visualDirection: 'Nightingale statistical diagram',
    rules: ['AI fake chart禁止']
  }
};
const project = { id: 'p1', scenes: [scene], mediaLibrary: [] };
const eligible = {
  title: 'Diagram of the causes of mortality',
  provider: 'verified-archive',
  sourceUrl: 'https://example.org/item/1',
  previewUrl: 'https://example.org/image.jpg',
  rightsStatements: ['Public domain'],
  rightsStatus: 'verified'
};
const resolved = {
  status: 'resolved',
  asset: { name: 'diagram.jpg', data: 'data:image/jpeg;base64,AAAA', previewUrl: eligible.previewUrl }
};

test('connects safe path through mediaLibrary and scene assignment without mutating input', async () => {
  const before = structuredClone(project);
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible] }),
    fetchImage: async () => resolved,
    applyAsset: async (inputProject, plan, asset) => {
      const copy=structuredClone(inputProject);copy.mediaLibrary.push({id:'stored-a',type:'image',data:asset.data});copy.scenes[0].imageAssetId='stored-a';return {status:'applied',project:copy,assetId:'stored-a'};
    }
  });
  assert.equal(result.status, 'applied');
  assert.equal(result.stage, 'complete');
  assert.equal(result.project.mediaLibrary.length, 1);
  assert.equal(result.project.scenes[0].imageAssetId, result.assetId);
  assert.deepEqual(project, before);
});

test('stops at needs-review and never fetches or changes project', async () => {
  let fetchCalls = 0;
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [{ ...eligible, rightsStatus: 'needs-review' }] }),
    fetchImage: async () => { fetchCalls += 1; return resolved; }
  });
  assert.equal(result.status, 'needs-review');
  assert.equal(result.stage, 'adoption');
  assert.equal(fetchCalls, 0);
  assert.equal(result.project, null);
});

test('stops before search when requirement is ambiguous', async () => {
  let searchCalls = 0;
  const result = await runSceneAssetPipeline(project, { id: 's2', productionDirection: {} }, {
    searchCandidates: async () => { searchCalls += 1; return []; }
  });
  assert.equal(result.stage, 'requirement');
  assert.equal(searchCalls, 0);
});

test('stops on multiple eligible candidates before image fetch', async () => {
  let fetchCalls = 0;
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible, { ...eligible, title: 'Second' }] }),
    fetchImage: async () => { fetchCalls += 1; return resolved; }
  });
  assert.equal(result.status, 'needs-selection');
  assert.equal(fetchCalls, 0);
});

test('propagates search and fetch failures without applying', async () => {
  const searchFailure = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'error', reason: 'offline' })
  });
  assert.equal(searchFailure.stage, 'search');
  assert.equal(searchFailure.status, 'error');

  const fetchFailure = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible] }),
    fetchImage: async () => ({ status: 'error', reason: 'CORS' })
  });
  assert.equal(fetchFailure.stage, 'fetch');
  assert.equal(fetchFailure.status, 'error');
  assert.equal(fetchFailure.project, null);
});

test('protects an existing scene image at final apply stage', async () => {
  const withImage = { ...project, scenes: [{ ...scene, imageAssetId: 'manual-image' }] };
  const result = await runSceneAssetPipeline(withImage, withImage.scenes[0], {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible] }),
    fetchImage: async () => resolved,
    applyAsset: async () => ({status:'blocked',project:withImage,reason:'既存画像があります'})
  });
  assert.equal(result.stage, 'apply');
  assert.equal(result.status, 'blocked');
  assert.equal(withImage.scenes[0].imageAssetId, 'manual-image');
});


test('stops a free-use signal without complete official evidence before fetch', async () => {
  let fetchCalls = 0;
  const candidate = { ...eligible, rightsStatus: 'rights-cleared-signal', rightsStatements: ['No known copyright restrictions'], rightsCheck: { status: 'rights-cleared-signal', signal: 'explicit-free-use' } };
  const result = await runSceneAssetPipeline(project, scene, { searchCandidates: async () => ({ status: 'ok', candidates: [candidate] }), enrichCandidates: async candidates => candidates, fetchImage: async () => { fetchCalls += 1; return resolved; } });
  assert.equal(result.status, 'needs-review');
  assert.equal(result.stage, 'adoption');
  assert.equal(fetchCalls, 0);
});

test('preserves rights evidence end-to-end from candidate through image fetch into mediaLibrary', async () => {
  const candidate = {
    ...eligible,
    rightsStatus: 'rights-cleared-signal',
    rightsStatements: ['No known copyright restrictions'],
    sourceUrl: 'https://www.loc.gov/item/example/',
    provider: 'library-of-congress',
    rightsCheck: { status: 'rights-cleared-signal', signal: 'explicit-free-use', itemJsonUrl: 'https://www.loc.gov/item/example/?fo=json&at=item%2Cresources' }
  };
  const stored=[];
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [candidate] }),
    enrichCandidates: async candidates => candidates,
    applyAsset: async (inputProject, plan, asset) => { stored.push(asset); const copy=structuredClone(inputProject); copy.mediaLibrary.push({id:'stored-rights',type:'image',data:asset.data,source:asset.provenance}); copy.scenes[0].imageAssetId='stored-rights'; return {status:'applied',project:copy,assetId:'stored-rights'}; },
    fetchOptions: {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get: key => key === 'content-type' ? 'image/jpeg' : key === 'content-length' ? '4' : null },
        blob: async () => ({ size: 4, type: 'image/jpeg' })
      }),
      blobToDataUrl: async () => 'data:image/jpeg;base64,AAAA'
    }
  });
  assert.equal(result.status, 'applied');
  const source = result.project.mediaLibrary[0].source;
  assert.equal(source.sourceUrl, candidate.sourceUrl);
  assert.deepEqual(source.rightsStatements, candidate.rightsStatements);
  assert.equal(source.rightsStatus, 'rights-cleared-signal');
  assert.deepEqual(source.rightsCheck, candidate.rightsCheck);
  assert.notEqual(source.rightsStatus, 'verified');
});

test('applies a Commons Public Domain candidate with official metadata evidence',async()=>{
  const commons={
    title:'Nightingale-mortality.jpg',
    provider:'wikimedia-commons',
    requestedType:'historical-source',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg',
    previewUrl:'https://upload.wikimedia.org/example/nightingale.jpg',
    rightsStatements:['Public domain'],
    rightsStatus:'rights-cleared-signal',
    license:'Public domain',
    attribution:'Florence Nightingale',
    rightsCheck:{status:'rights-cleared-signal',signal:'public-domain-or-cc0',source:'commons-extmetadata',sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg'}
  };
  const result=await runSceneAssetPipeline(project,scene,{
    searchCandidates:async()=>({status:'ok',candidates:[commons]}),
    enrichCandidates:async candidates=>candidates,
    fetchImage:async()=>({status:'resolved',asset:{name:'Nightingale-mortality.jpg',data:'data:image/jpeg;base64,AAAA',provenance:{provider:commons.provider,sourceUrl:commons.sourceUrl,sourcePage:commons.sourceUrl,rightsStatements:commons.rightsStatements,rightsStatus:commons.rightsStatus,license:commons.license,attribution:commons.attribution,rightsCheck:commons.rightsCheck}}}),
    applyAsset:async(inputProject,plan,asset)=>{const copy=structuredClone(inputProject);copy.mediaLibrary.push({id:'commons-pd',type:'image',data:asset.data,source:asset.provenance});copy.scenes[0].imageAssetId='commons-pd';return{status:'applied',project:copy,assetId:'commons-pd'}}
  });
  assert.equal(result.status,'applied');
  assert.equal(result.project.scenes[0].imageAssetId,'commons-pd');
  assert.equal(result.project.mediaLibrary[0].source.attribution,'Florence Nightingale');
});

test('auto-selects the unique highest-resolution equivalent Commons source for an explicit historical Scene',async()=>{
  const archiveScene={
    id:'scene-5',order:5,
    productionDirection:{
      assetType:'historical-source',
      visualDirection:'統計を見える形にしたことを示す。',
      searchHint:'Florence Nightingale mortality diagram 1858',
      rules:[]
    }
  };
  const archiveProject={id:'p5',scenes:[archiveScene],mediaLibrary:[]};
  const candidate=(name,width,height)=>({
    title:name,
    provider:'wikimedia-commons',
    requestedType:'historical-source',
    sourceUrl:`https://commons.wikimedia.org/wiki/File:${name}`,
    previewUrl:`https://upload.wikimedia.org/${name}`,
    description:'Diagram of the causes of mortality in the army in the East',
    date:'1858',
    contributors:['Florence Nightingale'],
    mimeType:'image/jpeg',
    width,height,
    rightsStatements:['Public domain'],
    rightsStatus:'rights-cleared-signal',
    license:'Public domain',
    rightsCheck:{status:'rights-cleared-signal',signal:'public-domain-or-cc0',source:'commons-extmetadata',sourceUrl:`https://commons.wikimedia.org/wiki/File:${name}`}
  });
  const small=candidate('Coxcomb.jpg',806,638);
  const large=candidate('Nightingale-mortality.jpg',6996,3826);
  let fetched='';
  const result=await runSceneAssetPipeline(archiveProject,archiveScene,{
    searchCandidates:async()=>({status:'ok',candidates:[small,large]}),
    enrichCandidates:async candidates=>candidates,
    fetchImage:async plan=>{fetched=plan.candidate.title;return{status:'resolved',asset:{name:fetched,data:'data:image/jpeg;base64,AAAA'}}},
    applyAsset:async(inputProject,plan)=>{const copy=structuredClone(inputProject);copy.scenes[0].imageAssetId='selected';return{status:'applied',project:copy,assetId:'selected'}}
  });
  assert.equal(result.status,'applied');
  assert.equal(result.candidateSelection.selected,true);
  assert.equal(fetched,'Nightingale-mortality.jpg');
});

test('falls back from LoC review-required candidate to Commons Public Domain candidate',async()=>{
  const loc={
    title:'Florence Nightingale statistical diagram',
    provider:'library-of-congress',
    requestedType:'historical-source',
    sourceUrl:'https://www.loc.gov/item/loc-review/',
    previewUrl:'https://tile.loc.gov/loc-review.jpg',
    rightsStatements:['Rights and access information'],
    rightsStatus:'needs-review'
  };
  const commons={
    title:'Nightingale-mortality.jpg',
    provider:'wikimedia-commons',
    requestedType:'historical-source',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg',
    previewUrl:'https://upload.wikimedia.org/nightingale.jpg',
    description:'Diagram of the causes of mortality in the army in the East',
    date:'1858',
    contributors:['Florence Nightingale'],
    rightsStatements:['Public domain'],
    rightsStatus:'rights-cleared-signal',
    license:'Public domain',
    rightsCheck:{status:'rights-cleared-signal',signal:'public-domain-or-cc0',source:'commons-extmetadata',sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg'}
  };
  let fetchedProvider='';
  const result=await runSceneAssetPipeline(project,scene,{
    searchCandidates:async()=>({status:'ok',candidates:[loc,commons]}),
    enrichCandidates:async candidates=>candidates,
    fetchImage:async plan=>{fetchedProvider=plan.candidate.provider;return resolved;},
    applyAsset:async(inputProject)=>{const copy=structuredClone(inputProject);copy.scenes[0].imageAssetId='commons-selected';return{status:'applied',project:copy,assetId:'commons-selected'}}
  });
  assert.equal(result.status,'applied');
  assert.equal(result.providerSelection.selectedProvider,'wikimedia-commons');
  assert.equal(fetchedProvider,'wikimedia-commons');
});

test('keeps LoC priority when LoC and Commons are both safely auto-adoptable',async()=>{
  const loc={
    title:'Florence Nightingale statistical diagram',
    provider:'library-of-congress',
    requestedType:'historical-source',
    sourceUrl:'https://www.loc.gov/item/loc-safe/',
    previewUrl:'https://tile.loc.gov/loc-safe.jpg',
    rightsStatements:['No known copyright restrictions'],
    rightsStatus:'rights-cleared-signal',
    rightsCheck:{status:'rights-cleared-signal',signal:'explicit-free-use',itemJsonUrl:'https://www.loc.gov/item/loc-safe/?fo=json&at=item%2Cresources'}
  };
  const commons={
    title:'Nightingale-mortality.jpg',
    provider:'wikimedia-commons',
    requestedType:'historical-source',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg',
    previewUrl:'https://upload.wikimedia.org/nightingale.jpg',
    rightsStatements:['Public domain'],
    rightsStatus:'rights-cleared-signal',
    license:'Public domain',
    rightsCheck:{status:'rights-cleared-signal',signal:'public-domain-or-cc0',source:'commons-extmetadata',sourceUrl:'https://commons.wikimedia.org/wiki/File:Nightingale-mortality.jpg'}
  };
  let fetchedProvider='';
  const result=await runSceneAssetPipeline(project,scene,{
    searchCandidates:async()=>({status:'ok',candidates:[loc,commons]}),
    enrichCandidates:async candidates=>candidates,
    fetchImage:async plan=>{fetchedProvider=plan.candidate.provider;return resolved;},
    applyAsset:async(inputProject)=>{const copy=structuredClone(inputProject);copy.scenes[0].imageAssetId='loc-selected';return{status:'applied',project:copy,assetId:'loc-selected'}}
  });
  assert.equal(result.status,'applied');
  assert.equal(result.providerSelection.selectedProvider,'library-of-congress');
  assert.equal(fetchedProvider,'library-of-congress');
});

test('still stops safely when both archive providers require review',async()=>{
  let fetchCalls=0;
  const result=await runSceneAssetPipeline(project,scene,{
    searchCandidates:async()=>({status:'ok',candidates:[
      {...eligible,provider:'library-of-congress',sourceUrl:'https://www.loc.gov/item/review/',rightsStatus:'needs-review'},
      {...eligible,provider:'wikimedia-commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:Review.jpg',rightsStatus:'needs-review'}
    ]}),
    enrichCandidates:async candidates=>candidates,
    fetchImage:async()=>{fetchCalls++;return resolved;}
  });
  assert.equal(result.status,'needs-review');
  assert.equal(result.providerSelection.selectedProvider,'');
  assert.equal(fetchCalls,0);
});
