import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../main.js',import.meta.url),'utf8');

test('output clearly separates Creator OS retention from iPhone saving',()=>{
  assert.match(source,/id="resultStorageState"/);
  assert.match(source,/iPhoneに保存・共有/);
  assert.match(source,/ファイルをダウンロード/);
  assert.doesNotMatch(source,/>動画を保存<\/a>/);
});

test('successful generation stores the Blob before reporting Creator OS retention',()=>{
  const start=source.indexOf("root.querySelector('#generateVideo').onclick=async()=>");
  const end=source.indexOf("\n  root.querySelector('#cancelRender').onclick",start);
  const handler=source.slice(start,end);
  const exportAt=handler.indexOf('await exportProjectVideo');
  const storeAt=handler.indexOf('await storeFinalVideoArtifact(project,result.blob)');
  const showAt=handler.indexOf('showCompletedVideo({...result,storageResult})');
  assert.ok(exportAt>=0&&storeAt>exportAt&&showAt>storeAt);
  assert.match(handler,/Creator OS内に保持できなかったため、ページを閉じる前にiPhoneへ保存してください/);
});

test('output restores a previously retained final video without regenerating',()=>{
  assert.match(source,/const restorePreviousFinalVideo=async\(\)=>/);
  assert.match(source,/await loadFinalVideoArtifact\(project\)/);
  assert.match(source,/showCompletedVideo\(\{blob:restored\.blob[\s\S]*restored:true\}\)/);
  assert.match(source,/前回の完成動画をCreator OS内から復元しました/);
});

test('share remains the primary device-save path while direct download stays available',()=>{
  assert.match(source,/id="shareVideo" class="primary">iPhoneに保存・共有<\/button>/);
  assert.match(source,/navigator\.share\(\{title:project\.title,files:\[resultFile\]\}\)/);
  assert.match(source,/id="downloadVideo" class="button-link" download>ファイルをダウンロード<\/a>/);
});
