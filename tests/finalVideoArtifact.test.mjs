import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINAL_VIDEO_MEDIA_ID,
  describeFinalVideoStorage,
  loadFinalVideoArtifact,
  storeFinalVideoArtifact
} from '../finalVideoArtifact.js';

test('stores the latest final video as a project-scoped video artifact',async()=>{
  const blob=new Blob(['video'],{type:'video/mp4'});
  let received=null;
  const result=await storeFinalVideoArtifact({id:'p1'},blob,{
    storeMedia:async args=>{received=args;return {status:'stored',mediaRef:{id:args.mediaId,kind:'video',mimeType:blob.type,sizeBytes:blob.size}};}
  });
  assert.equal(result.status,'stored');
  assert.deepEqual(received,{
    projectId:'p1',
    mediaId:FINAL_VIDEO_MEDIA_ID,
    kind:'video',
    blob
  });
});

test('loads the same project-scoped final video artifact',async()=>{
  let received=null;
  const blob=new Blob(['video'],{type:'video/mp4'});
  const result=await loadFinalVideoArtifact({id:'p2'},{
    loadMedia:async args=>{received=args;return {status:'resolved',mediaRef:{id:FINAL_VIDEO_MEDIA_ID,kind:'video',mimeType:blob.type,sizeBytes:blob.size},blob};}
  });
  assert.equal(result.status,'resolved');
  assert.deepEqual(received,{projectId:'p2',mediaId:FINAL_VIDEO_MEDIA_ID});
  assert.equal(result.blob,blob);
});

test('does not mutate project JSON or embed the final video blob',async()=>{
  const project={id:'p3',output:{width:1080,height:1920}};
  const before=structuredClone(project);
  await storeFinalVideoArtifact(project,new Blob(['v']),{
    storeMedia:async()=>({status:'stored',mediaRef:{id:FINAL_VIDEO_MEDIA_ID,kind:'video',mimeType:'video/mp4',sizeBytes:1}})
  });
  assert.deepEqual(project,before);
});

test('explains Creator OS storage separately from iPhone device storage',()=>{
  assert.match(describeFinalVideoStorage({status:'stored'}),/Creator OS内に保持済み/);
  assert.match(describeFinalVideoStorage({status:'stored'}),/iPhone本体にはまだ保存されていません/);
  const failed=describeFinalVideoStorage({status:'error',reason:'容量不足'});
  assert.match(failed,/ページを閉じる前にiPhoneへ保存/);
  assert.match(failed,/容量不足/);
});

test('blocks invalid final-video writes before Media Store is touched',async()=>{
  let called=false;
  const result=await storeFinalVideoArtifact({id:''},new Blob(['v']),{
    storeMedia:async()=>{called=true;return {status:'stored'};}
  });
  assert.equal(result.status,'blocked');
  assert.equal(called,false);
});
