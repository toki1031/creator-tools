import test from 'node:test';
import assert from 'node:assert/strict';
import { createRestoredProject, mergePronunciationDictionaries, normalizeImportedProject, parseProjectBackup, summarizeProjectBackup } from '../projectBackup.js';

const image = 'data:image/png;base64,AA==';
const video = 'data:video/mp4;base64,AA==';
const audio = 'data:audio/wav;base64,AA==';
const sample = () => ({
  id:'original-project', schemaVersion:4, title:'バックアップ', genre:'great-person', platform:'youtube-shorts',
  aspectRatio:'9:16', targetDurationSec:60, displayScript:'表示台本', speechScript:'音声台本',
  scenes:[
    {id:'same',order:9,text:'一行目',speechText:'読み',durationSec:5,imageData:image,videoData:video,subtitleText:'一行目\n二行目',subtitleEnabled:true,subtitleStartSec:0.5,subtitleEndSec:4.5,motion:'zoom-in',transition:'fade',narration:{audioData:audio,durationSec:4}},
    {id:'same',order:2,text:'次',durationSec:3,subtitleText:'次'}
  ],
  narration:{audioData:audio,source:'kokoro'}, bgm:{audioData:audio,source:'upload',volume:.1},
  subtitleStyle:{position:'bottom',positionOffsetPercent:-6}, output:{subtitlePosition:'bottom'}, publish:{title:'投稿'},
  aiWorkspace:{editor:{result:'結果'}},promptProfile:{brandId:'brand'},promptLibrary:[{id:'prompt'}],
  finalReview:{approved:true,signature:'old'},pronunciationDictionary:[{from:'語',to:'ご'}]
});

test('schemaVersion 4の完全バックアップを新規projectとして復元する', () => {
  const raw=sample(), snapshot=structuredClone(raw);let sequence=0;
  const normalized=normalizeImportedProject(raw,{createId:()=>`generated-${++sequence}`});
  const restored=createRestoredProject(normalized.project,{title:'復元後',createId:()=>`project-${++sequence}`,now:()=> '2026-08-20T00:00:00.000Z'});
  assert.deepEqual(raw,snapshot,'元のJSONオブジェクトを変更しない');
  assert.notEqual(restored.id,raw.id);
  assert.equal(restored.title,'復元後');
  assert.equal(restored.createdAt,'2026-08-20T00:00:00.000Z');
  assert.equal(restored.updatedAt,restored.createdAt);
  assert.deepEqual(restored.scenes.map(scene=>scene.order),[1,2]);
  assert.equal(restored.scenes[0].id,'same');
  assert.notEqual(restored.scenes[1].id,'same');
  assert.equal(restored.scenes[0].imageData,image);
  assert.equal(restored.scenes[0].videoData,video);
  assert.equal(restored.scenes[0].narration.audioData,audio);
  assert.equal(restored.narration.audioData,audio);
  assert.equal(restored.bgm.audioData,audio);
  assert.equal(restored.scenes[0].subtitleText,'一行目\n二行目');
  assert.equal(restored.scenes[0].subtitleStartSec,.5);
  assert.equal(restored.scenes[0].subtitleEndSec,4.5);
  assert.equal(restored.aiWorkspace.editor.result,'結果');
  assert.equal(restored.subtitleStyle.positionOffsetPercent,-6);
  assert.equal(restored.finalReview,undefined);
  assert.equal(restored.pronunciationDictionary,undefined,'辞書をproject本体へ保存しない');
  assert.deepEqual(normalized.pronunciationDictionary,[{from:'語',to:'ご'}]);
});

test('旧projectの不足フィールドと未設定schemaVersionを補完する', () => {
  const old={title:'旧版',genre:'other',platform:'tiktok',displayScript:'旧台本'};
  const normalized=normalizeImportedProject(old);
  assert.equal(normalized.sourceSchemaVersion,'未設定');
  assert.equal(normalized.project.schemaVersion,4);
  assert.deepEqual(normalized.project.scenes,[]);
  assert.equal(normalized.project.speechScript,'旧台本');
  assert.equal(normalized.project.subtitleStyle.positionOffsetPercent,0);
  assert.equal(normalized.project.bgm.source,'none');
  assert.equal(normalized.project.publish.title,'旧版');
  assert.equal(normalized.project.scenes[0]?.subtitlePosition,undefined);
});

test('scene個別字幕位置を正規化して復元する',()=>{
  const raw=sample();
  raw.scenes[0].subtitlePosition='top';raw.scenes[0].subtitlePositionOffsetPercent=-5;
  raw.scenes[1].subtitlePosition='bottom';raw.scenes[1].subtitlePositionOffsetPercent=99;
  const normalized=normalizeImportedProject(raw);
  assert.equal(normalized.project.schemaVersion,4);
  assert.deepEqual([normalized.project.scenes[0].subtitlePosition,normalized.project.scenes[0].subtitlePositionOffsetPercent],['top',-5]);
  assert.deepEqual([normalized.project.scenes[1].subtitlePosition,normalized.project.scenes[1].subtitlePositionOffsetPercent],['bottom',15]);
  const restored=createRestoredProject(normalized.project);
  assert.equal(restored.scenes[0].subtitlePosition,'top');
  assert.equal(restored.finalReview,undefined);
});

test('不正なscene位置と位置のないoffsetを除去する',()=>{
  const raw=sample();raw.scenes[0].subtitlePosition='left';raw.scenes[0].subtitlePositionOffsetPercent=8;
  delete raw.scenes[1].subtitlePosition;raw.scenes[1].subtitlePositionOffsetPercent=-9;
  const scenes=normalizeImportedProject(raw).project.scenes;
  assert.equal(Object.hasOwn(scenes[0],'subtitlePosition'),false);
  assert.equal(Object.hasOwn(scenes[0],'subtitlePositionOffsetPercent'),false);
  assert.equal(Object.hasOwn(scenes[1],'subtitlePositionOffsetPercent'),false);
});

test('ID生成器が元IDを返しても既存projectを上書きしない',()=>{
  const normalized=normalizeImportedProject(sample()).project;
  const restored=createRestoredProject(normalized,{createId:()=>normalized.id});
  assert.notEqual(restored.id,normalized.id);
});

test('壊れたJSON、新しいschema、制作プラン、投稿情報を拒否する', () => {
  assert.throws(()=>parseProjectBackup('{broken'),/解析できません/);
  assert.throws(()=>parseProjectBackup(JSON.stringify({...sample(),schemaVersion:5})),/新しいバージョン/);
  assert.throws(()=>parseProjectBackup(JSON.stringify({schemaVersion:3,title:'plan',scripts:{},subtitles:[],scenes:[]})),/制作プランJSON/);
  assert.throws(()=>parseProjectBackup(JSON.stringify({title:'投稿',description:'本文',tags:''})),/バックアップJSONではありません/);
  assert.throws(()=>parseProjectBackup('[]'),/プロジェクトオブジェクト/);
});

test('不正Data URLだけを除外して警告する', () => {
  const raw=sample();raw.scenes[0].imageData='javascript:alert(1)';raw.scenes[0].videoData='data:image/png;base64,AA==';raw.narration.audioData='data:video/mp4;base64,AA==';raw.bgm.audioData='https://example.com/audio.mp3';
  const normalized=normalizeImportedProject(raw);
  assert.equal(normalized.project.scenes[0].imageData,'');
  assert.equal(normalized.project.scenes[0].videoData,'');
  assert.equal(normalized.project.narration.audioData,'');
  assert.equal(normalized.project.bgm.audioData,'');
  assert.ok(normalized.warnings.length>=4);
});

test('危険なキーをprojectへ持ち込まない', () => {
  const raw=parseProjectBackup('{"title":"安全","genre":"other","platform":"youtube-shorts","scenes":[],"__proto__":{"polluted":true},"nested":{"constructor":{"bad":true}}}');
  const normalized=normalizeImportedProject(raw);
  assert.equal(Object.hasOwn(normalized.project,'__proto__'),false);
  assert.equal(Object.hasOwn(normalized.project.nested,'constructor'),false);
  assert.equal({}.polluted,undefined);
});

test('確認画面用の件数を集計する', () => {
  const normalized=normalizeImportedProject(sample());
  const summary=summarizeProjectBackup(normalized.project,normalized.pronunciationDictionary,normalized.sourceSchemaVersion);
  assert.equal(summary.schemaVersion,4);
  assert.equal(summary.sceneCount,2);
  assert.equal(summary.imageCount,1);
  assert.equal(summary.videoCount,1);
  assert.equal(summary.subtitleCount,2);
  assert.equal(summary.sceneNarrationCount,1);
  assert.equal(summary.hasNarration,true);
  assert.equal(summary.hasBgm,true);
  assert.equal(summary.hasAiData,true);
  assert.equal(summary.dictionaryCount,1);
});

test('読み方辞書は端末側を優先して追加件数と重複件数を返す',()=>{
  const result=mergePronunciationDictionaries([{from:'既存',to:'きそん'}],[{from:'既存',to:'上書きしない'},{from:'追加',to:'ついか'}]);
  assert.deepEqual(result.dictionary,[{from:'既存',to:'きそん'},{from:'追加',to:'ついか'}]);
  assert.equal(result.added,1);
  assert.equal(result.skipped,1);
});
