import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSceneImageForDisplay } from '../sceneImageDisplay.js';

test('keeps legacy library Data URL behavior without media store access', async () => {
  let loads=0;
  const project={id:'p1',mediaLibrary:[{id:'a1',type:'image',data:'data:image/png;base64,YQ=='}]};
  const result=await resolveSceneImageForDisplay(project,{imageAssetId:'a1'},{loadMedia:async()=>{loads+=1;}});
  assert.equal(result.status,'resolved'); assert.equal(result.source,'library'); assert.equal(loads,0);
});

test('resolves MediaRef Blob to temporary Object URL and exposes idempotent cleanup', async () => {
  const project={id:'p1',mediaLibrary:[{id:'a1',type:'image',data:'',mediaRef:{id:'a1',kind:'image',mimeType:'image/jpeg',sizeBytes:3}}]};
  const calls=[]; const blob=new Blob(['abc'],{type:'image/jpeg'});
  const result=await resolveSceneImageForDisplay(project,{imageAssetId:'a1'},{
    loadMedia:async input=>{calls.push(['load',input]);return {status:'resolved',blob};},
    createObjectUrl:()=> 'blob:test-image',
    revokeObjectUrl:url=>calls.push(['revoke',url])
  });
  assert.equal(result.status,'resolved'); assert.equal(result.source,'media-ref'); assert.equal(result.url,'blob:test-image');
  assert.deepEqual(calls[0],['load',{projectId:'p1',mediaId:'a1'}]);
  result.cleanup(); result.cleanup();
  assert.deepEqual(calls.slice(1),[['revoke','blob:test-image']]);
});

test('falls back to legacy scene imageData when no library asset resolves', async () => {
  const result=await resolveSceneImageForDisplay({id:'p1',mediaLibrary:[]},{imageData:'data:image/jpeg;base64,YQ=='});
  assert.equal(result.status,'resolved'); assert.equal(result.source,'legacy');
});

test('missing or failed separated media stays safe', async () => {
  const project={id:'p1',mediaLibrary:[{id:'a1',type:'image',mediaRef:{id:'a1',kind:'image',mimeType:'image/jpeg',sizeBytes:3}}]};
  const missing=await resolveSceneImageForDisplay(project,{imageAssetId:'a1'},{loadMedia:async()=>({status:'missing',reason:'gone'})});
  assert.equal(missing.status,'missing'); assert.equal(missing.url,''); assert.equal(missing.reason,'gone');
  const failed=await resolveSceneImageForDisplay(project,{imageAssetId:'a1'},{loadMedia:async()=>{throw new Error('db failed');}});
  assert.equal(failed.status,'error'); assert.equal(failed.reason,'db failed');
});
