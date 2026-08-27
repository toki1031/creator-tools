import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addImageAsset,
  assetUsageCount,
  assetUsageScenes,
  ensureMediaLibrary,
  estimateAssetBytes,
  normalizeMediaLibrary,
  promoteLegacySceneImage,
  removeAllUnusedAssets,
  removeUnusedAsset,
  renameMediaAsset,
  resolveSceneImageSource,
  summarizeMediaLibrary
} from '../mediaLibrary.js';

const imageA = 'data:image/png;base64,QQ==';
const imageB = 'data:image/jpeg;base64,Qg==';

test('mediaLibrary未設定を空配列で補完する', () => {
  const project = {};
  assert.deepEqual(ensureMediaLibrary(project), []);
  assert.deepEqual(project.mediaLibrary, []);
});

test('画像assetを追加し同じData URLは重複登録しない', () => {
  const project = { mediaLibrary:[] };
  let sequence = 0;
  const first = addImageAsset(project,{data:imageA,fileName:'a.png',createId:()=>`id-${++sequence}`,now:()=> '2026-08-25T00:00:00.000Z'});
  const second = addImageAsset(project,{data:imageA,fileName:'copy.png',createId:()=>`id-${++sequence}`});
  assert.equal(project.mediaLibrary.length,1);
  assert.equal(first.id,second.id);
  assert.equal(first.id,'asset-id-1');
});

test('sceneはlibraryを優先しlegacyへ安全にfallbackする', () => {
  const project={mediaLibrary:[{id:'asset-a',type:'image',data:imageA,fileName:'a.png'}]};
  assert.equal(resolveSceneImageSource(project,{imageAssetId:'asset-a',imageData:imageB}).source,'library');
  assert.equal(resolveSceneImageSource(project,{imageAssetId:'missing',imageData:imageB}).source,'legacy');
  assert.equal(resolveSceneImageSource(project,{imageData:imageB}).data,imageB);
  assert.equal(resolveSceneImageSource(project,{}).source,'none');
});

test('legacy scene画像をlibraryへ退避して参照へ切り替える', () => {
  const project={mediaLibrary:[]};
  const scene={imageData:imageA};
  const asset=promoteLegacySceneImage(project,scene,{createId:()=> 'legacy',now:()=> '2026-08-25T00:00:00.000Z'});
  assert.equal(asset.id,'asset-legacy');
  assert.equal(scene.imageAssetId,'asset-legacy');
  assert.equal(Object.hasOwn(scene,'imageData'),false);
  assert.equal(resolveSceneImageSource(project,scene).data,imageA);
});

test('legacy promote失敗時は元imageDataを失わない', () => {
  const project={mediaLibrary:[]};
  const scene={imageData:'not-an-image'};
  assert.equal(promoteLegacySceneImage(project,scene),null);
  assert.equal(scene.imageData,'not-an-image');
  assert.equal(project.mediaLibrary.length,0);
});

test('使用中assetは削除せず未使用assetだけ削除する', () => {
  const project={
    mediaLibrary:[
      {id:'asset-a',type:'image',data:imageA},
      {id:'asset-b',type:'image',data:imageB}
    ],
    scenes:[{imageAssetId:'asset-a'},{imageAssetId:'asset-a'}]
  };
  assert.equal(assetUsageCount(project,'asset-a'),2);
  assert.equal(removeUnusedAsset(project,'asset-a'),false);
  assert.equal(removeUnusedAsset(project,'asset-b'),true);
  assert.deepEqual(project.mediaLibrary.map(asset=>asset.id),['asset-a']);
});

test('normalizeMediaLibraryは不正asset除外と重複ID再発行を行う', () => {
  let sequence=0;
  const result=normalizeMediaLibrary([
    {id:'same',type:'image',data:imageA,fileName:'a.png'},
    {id:'same',type:'image',data:imageB,fileName:'b.jpg'},
    {id:'bad',type:'video',data:'data:video/mp4;base64,AA=='}
  ],{createId:()=>`new-${++sequence}`,now:()=> '2026-08-25T00:00:00.000Z'});
  assert.equal(result.assets.length,2);
  assert.equal(result.assets[0].id,'same');
  assert.equal(result.assets[1].id,'asset-new-1');
  assert.equal(result.warnings.length,1);
  assert.equal(result.fixes.length,1);
});


test('素材使用sceneとlibrary概要を集計する', () => {
  const project={
    mediaLibrary:[{id:'asset-a',type:'image',data:imageA},{id:'asset-b',type:'image',data:imageB}],
    scenes:[{id:'s1',imageAssetId:'asset-a'},{id:'s2'},{id:'s3',imageAssetId:'asset-a'}]
  };
  assert.deepEqual(assetUsageScenes(project,'asset-a').map(item=>item.number),[1,3]);
  const summary=summarizeMediaLibrary(project);
  assert.deepEqual({totalCount:summary.totalCount,usedCount:summary.usedCount,unusedCount:summary.unusedCount},{totalCount:2,usedCount:1,unusedCount:1});
  assert.equal(summary.estimatedBytes,2);
  assert.equal(estimateAssetBytes(project.mediaLibrary[0]),1);
});

test('素材名変更はidと画像dataを変えずupdatedAtだけ更新する', () => {
  const project={mediaLibrary:[{id:'asset-a',type:'image',data:imageA,fileName:'before.png',updatedAt:'old'}]};
  const asset=renameMediaAsset(project,'asset-a','本田宗一郎 肖像',{now:()=> '2026-08-28T00:00:00.000Z'});
  assert.equal(asset.id,'asset-a');
  assert.equal(asset.data,imageA);
  assert.equal(asset.fileName,'本田宗一郎 肖像');
  assert.equal(asset.updatedAt,'2026-08-28T00:00:00.000Z');
  assert.equal(renameMediaAsset(project,'asset-a','   '),null);
});

test('未使用素材の一括削除は使用中assetを残す', () => {
  const project={
    mediaLibrary:[{id:'asset-a',type:'image',data:imageA},{id:'asset-b',type:'image',data:imageB}],
    scenes:[{imageAssetId:'asset-a'}]
  };
  assert.equal(removeAllUnusedAssets(project),1);
  assert.deepEqual(project.mediaLibrary.map(asset=>asset.id),['asset-a']);
});
