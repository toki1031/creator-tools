import test from 'node:test';
import assert from 'node:assert/strict';
import { runSceneAssetPipeline } from '../sceneAssetPipeline.js';

const scene={id:'s1',order:1,productionDirection:{assetType:'historical-source',visualDirection:'historical diagram',rules:[]}};
const candidate={title:'Diagram',provider:'verified-archive',sourceUrl:'https://example.org/item',previewUrl:'https://example.org/image.jpg',rightsStatements:['Public domain'],rightsStatus:'verified'};

test('default pipeline stores fetched image separately and project keeps only MediaRef', async () => {
  const project={id:'p1',scenes:[scene],mediaLibrary:[]};
  const stored=[];
  const result=await runSceneAssetPipeline(project,scene,{
    searchCandidates:async()=>({status:'ok',candidates:[candidate]}),
    enrichCandidates:async values=>values,
    fetchImage:async()=>({status:'resolved',asset:{id:'img-1',name:'diagram.jpg',data:'data:image/jpeg;base64,QUJD',previewUrl:candidate.previewUrl,provenance:{provider:candidate.provider,sourceUrl:candidate.sourceUrl,rightsStatements:candidate.rightsStatements,rightsStatus:'verified'}}}),
    applyAsset:async (inputProject,plan,asset)=>{
      const { storeAndApplyAutoImage }=await import('../autoImageMediaStorage.js');
      return storeAndApplyAutoImage(inputProject,plan,asset,{
        storeMedia:async input=>{stored.push(input);return {status:'stored',mediaRef:{id:input.mediaId,kind:'image',mimeType:input.blob.type,sizeBytes:input.blob.size}};}
      });
    }
  });
  assert.equal(result.status,'applied');
  assert.equal(stored.length,1);
  const asset=result.project.mediaLibrary[0];
  assert.equal(asset.data,'');
  assert.deepEqual(asset.mediaRef,{id:'img-1',kind:'image',mimeType:'image/jpeg',sizeBytes:3});
  assert.equal(asset.source.sourceUrl,candidate.sourceUrl);
  assert.equal(result.project.scenes[0].imageAssetId,'img-1');
  const reloaded=structuredClone(result.project);
  assert.equal(reloaded.mediaLibrary[0].data,'');
  assert.equal(reloaded.mediaLibrary[0].mediaRef.id,'img-1');
});

test('separate storage failure stops apply and leaves original project unchanged', async () => {
  const project={id:'p1',scenes:[scene],mediaLibrary:[]};
  const before=structuredClone(project);
  const result=await runSceneAssetPipeline(project,scene,{
    searchCandidates:async()=>({status:'ok',candidates:[candidate]}),
    enrichCandidates:async values=>values,
    fetchImage:async()=>({status:'resolved',asset:{id:'img-1',data:'data:image/jpeg;base64,QUJD',previewUrl:candidate.previewUrl}}),
    applyAsset:async (inputProject,plan,asset)=>{
      const { storeAndApplyAutoImage }=await import('../autoImageMediaStorage.js');
      return storeAndApplyAutoImage(inputProject,plan,asset,{storeMedia:async()=>({status:'error',reason:'quota'})});
    }
  });
  assert.equal(result.stage,'apply');
  assert.equal(result.status,'error');
  assert.deepEqual(project,before);
});
