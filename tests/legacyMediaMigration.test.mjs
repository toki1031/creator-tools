import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyProjectMedia } from '../legacyMediaMigration.js';

const image='data:image/png;base64,aGVsbG8=';
const audio='data:audio/wav;base64,aGVsbG8=';

test('migrates mixed legacy media only after successful storage', async () => {
  const project={id:'p1',mediaLibrary:[{id:'a1',type:'image',data:image}],scenes:[{id:'s1',imageData:image,narration:{audioData:audio}}],bgm:{audioAssetId:'b1',audioData:audio}};
  const stored=[];
  const result=await migrateLegacyProjectMedia(project,{store:async args=>{stored.push(args.mediaId);return {status:'stored',mediaRef:{id:args.mediaId,kind:args.kind,mimeType:args.blob.type,sizeBytes:args.blob.size}}},yieldControl:async()=>{}});
  assert.equal(result.failed,0);
  assert.equal(result.migrated,4);
  assert.equal(project.mediaLibrary[0].data,undefined);
  assert.ok(project.scenes[0].imageAssetId);
  assert.equal(project.scenes[0].imageData,undefined);
  assert.equal(project.scenes[0].narration.audioData,undefined);
  assert.equal(project.bgm.audioData,undefined);
  assert.equal(stored.length,4);
});

test('keeps source bytes when media storage fails and can retry', async () => {
  const project={id:'p2',mediaLibrary:[{id:'a1',type:'image',data:image}],scenes:[],bgm:{audioData:audio}};
  let fail=true;
  const store=async args=>fail?{status:'error',reason:'no space'}:{status:'stored',mediaRef:{id:args.mediaId,kind:args.kind,mimeType:args.blob.type,sizeBytes:args.blob.size}};
  const first=await migrateLegacyProjectMedia(project,{store,yieldControl:async()=>{}});
  assert.equal(first.failed,2);
  assert.equal(project.mediaLibrary[0].data,image);
  assert.equal(project.bgm.audioData,audio);
  fail=false;
  const second=await migrateLegacyProjectMedia(project,{store,yieldControl:async()=>{}});
  assert.equal(second.migrated,2);
  assert.equal(project.mediaLibrary[0].data,undefined);
  assert.equal(project.bgm.audioData,undefined);
});

test('does not touch already separated media or videoData', async () => {
  const project={id:'p3',mediaLibrary:[{id:'a1',type:'image',mediaRef:{id:'image-a1',kind:'image',mimeType:'image/png',sizeBytes:5}}],scenes:[{id:'s1',videoData:'data:video/mp4;base64,aGVsbG8=',narration:{mediaRef:{id:'n1',kind:'audio',mimeType:'audio/wav',sizeBytes:5}}}],bgm:{mediaRef:{id:'b1',kind:'audio',mimeType:'audio/wav',sizeBytes:5}}};
  let calls=0;
  const result=await migrateLegacyProjectMedia(project,{store:async()=>{calls++;return {status:'error'}},yieldControl:async()=>{}});
  assert.deepEqual(result,{migrated:0,failed:0});
  assert.equal(calls,0);
  assert.ok(project.scenes[0].videoData);
});
