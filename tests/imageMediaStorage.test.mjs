import test from 'node:test';
import assert from 'node:assert/strict';
import { imageDataUrlToBlob, storeImageAssetMedia } from '../imageMediaStorage.js';

test('imageDataUrlToBlob converts image data URL without changing mime type',()=>{
  const blob=imageDataUrlToBlob('data:image/png;base64,aGVsbG8=');
  assert.equal(blob.type,'image/png');
  assert.equal(blob.size,5);
});

test('image data is removed only after separate media storage succeeds',async()=>{
  const asset={id:'asset-1',type:'image',data:'data:image/png;base64,aGVsbG8='};
  const project={id:'project-1'};
  const failed=await storeImageAssetMedia(project,asset,{store:async()=>({status:'error',reason:'quota'})});
  assert.equal(failed.status,'error');
  assert.match(asset.data,/^data:image/);
  assert.equal(asset.mediaRef,undefined);

  const stored=await storeImageAssetMedia(project,asset,{store:async input=>({status:'stored',mediaRef:{id:input.mediaId,kind:'image',mimeType:input.blob.type,sizeBytes:input.blob.size}})});
  assert.equal(stored.status,'stored');
  assert.equal(asset.data,undefined);
  assert.equal(asset.mediaRef.id,'image-asset-1');
  assert.equal(asset.mediaRef.kind,'image');
});

test('invalid or already separated image does not overwrite media state',async()=>{
  let called=false;
  const asset={id:'asset-2',type:'image',mediaRef:{id:'old',kind:'image',mimeType:'image/jpeg',sizeBytes:2}};
  const result=await storeImageAssetMedia({id:'project-1'},asset,{store:async()=>{called=true;}});
  assert.equal(result.status,'blocked');
  assert.equal(called,false);
  assert.equal(asset.mediaRef.id,'old');
});
