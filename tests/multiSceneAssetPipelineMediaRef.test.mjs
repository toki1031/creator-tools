import test from 'node:test';
import assert from 'node:assert/strict';
import { runMultiSceneAssetPipeline } from '../multiSceneAssetPipeline.js';
import { storeAndApplyAutoImage } from '../autoImageMediaStorage.js';

function scene(id, order) {
  return { id, order, productionDirection: { assetType: 'historical-source', visualDirection: `historical source ${id}`, rules: [] } };
}
function candidate(sceneId) {
  return { title: `Source ${sceneId}`, provider: 'verified-archive', sourceUrl: `https://example.org/${sceneId}`, previewUrl: `https://example.org/${sceneId}.jpg`, rightsStatements: ['Public domain'], rightsStatus: 'verified' };
}

test('multi-scene real pipeline carries separated MediaRef images forward without embedded Data URLs', async () => {
  const input={id:'p-multi',scenes:[scene('b',2),scene('a',1)],mediaLibrary:[]};
  const before=structuredClone(input);
  const stored=[];
  const result=await runMultiSceneAssetPipeline(input,{
    waitForSearchSlot:async()=>{},
    searchCandidates:async plan=>({status:'ok',candidates:[candidate(plan.sceneId)]}),
    runScene:async (project,current,options)=>{
      const { runSceneAssetPipeline }=await import('../sceneAssetPipeline.js');
      return runSceneAssetPipeline(project,current,{
        ...options,
        enrichCandidates:async values=>values,
        fetchImage:async plan=>({status:'resolved',asset:{id:`img-${plan.sceneId}`,name:`${plan.sceneId}.jpg`,data:'data:image/jpeg;base64,QUJD',previewUrl:`https://example.org/${plan.sceneId}.jpg`,provenance:{provider:'verified-archive',sourceUrl:`https://example.org/${plan.sceneId}`,rightsStatus:'verified'}}}),
        applyAsset:async (p,plan,asset)=>storeAndApplyAutoImage(p,plan,asset,{storeMedia:async args=>{stored.push(args);return {status:'stored',mediaRef:{id:args.mediaId,kind:'image',mimeType:args.blob.type,sizeBytes:args.blob.size}};}})
      });
    }
  });
  assert.equal(result.status,'complete');
  assert.deepEqual(result.results.map(x=>x.sceneId),['a','b']);
  assert.equal(stored.length,2);
  assert.equal(result.project.mediaLibrary.length,2);
  assert.ok(result.project.mediaLibrary.every(asset=>asset.data===''));
  assert.deepEqual(result.project.mediaLibrary.map(asset=>asset.mediaRef.id),['img-a','img-b']);
  assert.equal(result.project.scenes.find(x=>x.id==='a').imageAssetId,'img-a');
  assert.equal(result.project.scenes.find(x=>x.id==='b').imageAssetId,'img-b');
  assert.deepEqual(input,before);
  const reloaded=structuredClone(result.project);
  assert.ok(reloaded.mediaLibrary.every(asset=>asset.mediaRef && asset.data===''));
});

test('default search adapter remains injectable so tests and future providers do not require network', async () => {
  const input={id:'p1',scenes:[scene('a',1)],mediaLibrary:[]};
  let searches=0;
  const result=await runMultiSceneAssetPipeline(input,{
    searchCandidates:async()=>{searches+=1;return {status:'blocked',candidates:[],reason:'fixture stop'};},
    waitForSearchSlot:async()=>{}
  });
  assert.equal(searches,1);
  assert.equal(result.status,'blocked');
  assert.equal(result.stoppedSceneId,'a');
  assert.deepEqual(input.mediaLibrary,[]);
});
