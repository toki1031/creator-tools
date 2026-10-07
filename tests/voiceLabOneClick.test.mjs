import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../voice-lab.html',import.meta.url),'utf8');

test('Voice Lab exposes a one-click production-request narration sync action',()=>{
  assert.match(html,/id="autoSyncScenes"/);
  assert.match(html,/準備して全Sceneを自動同期/);
  assert.match(html,/音声エンジン準備 → 保存済み音声の再利用判定 → 未生成・変更Sceneだけ生成/);
});

test('one-click narration sync stays user-triggered and does not preload heavy project or model work',()=>{
  assert.match(html,/ボタンを押すまではプロジェクトや音声モデルを読み込みません/);
  assert.doesNotMatch(html,/\$\('#autoSyncScenes'\)\.onclick\(\);/);
  assert.doesNotMatch(html,/loadProject\(\);\s*\n\s*\$\('#autoSyncScenes'/);
});

test('one-click narration sync prepares only when needed and then runs existing Scene sync',()=>{
  const start=html.indexOf("$('#autoSyncScenes').onclick=async()=>");
  const end=html.indexOf("\n\n$('#prepare').onclick=async()=>",start);
  assert.ok(start>=0&&end>start);
  const handler=html.slice(start,end);
  assert.match(handler,/const allReusable=scenes\.every/);
  assert.match(handler,/if\(allReusable\)\{/);
  assert.match(handler,/音声エンジンの準備を省略/);
  assert.match(handler,/if\(!isCloudVoice\(voice\)&&!tts\)\{/);
  assert.match(handler,/await \$\('#prepare'\)\.onclick\(\);/);
  assert.match(handler,/if\(!tts\)throw new Error\('音声エンジンの準備に失敗しました/);
  assert.match(handler,/await \$\('#generateScenes'\)\.onclick\(\);/);
});

test('one-click narration sync verifies every Scene has narration before reporting completion',()=>{
  assert.match(html,/const ready=scenes\.filter\(scene=>Boolean\(scene\?\.narration\?\.audioData\|\|scene\?\.narration\?\.mediaRef\?\.id\)\)\.length/);
  assert.match(html,/if\(ready<scenes\.length\)throw new Error/);
  assert.match(html,/全Scene同期完了 ✓/);
});

test('one-click narration sync returns to the BGM screen only after every Scene is ready',()=>{
  const start=html.indexOf("$('#autoSyncScenes').onclick=async()=>");
  const end=html.indexOf("\n\n$('#prepare').onclick=async()=>",start);
  assert.ok(start>=0&&end>start);
  const handler=html.slice(start,end);
  assert.match(handler,/if\(ready<scenes\.length\)throw new Error/);
  assert.match(handler,/location\.href=.*\/bgm/);
});

test('manual Scene narration sync keeps the existing review links and does not auto-navigate',()=>{
  const start=html.indexOf("$('#generateScenes').onclick=async()=>");
  assert.ok(start>=0);
  const handler=html.slice(start);
  assert.doesNotMatch(handler,/location\.href=.*\/bgm/);
  assert.match(handler,/afterSceneSync/);
  assert.match(handler,/次へ：字幕・BGM/);
});


test('Voice Lab recovers transient Safari BFCache controls without auto-loading TTS',()=>{
  assert.match(html,/function recoverVoiceLabAfterReturn/);
  assert.match(html,/autoButton\.disabled=false/);
  assert.match(html,/generateButton\.disabled=!tts/);
  assert.match(html,/currentProject=null/);
  assert.match(html,/const latest=await loadProject\(\)/);
  assert.match(html,/addEventListener\('pageshow'/);
  assert.match(html,/visibilityState==='visible'/);
  const start=html.indexOf('async function recoverVoiceLabAfterReturn');
  const end=html.indexOf("\n\n$('#voice').onchange",start);
  const recovery=html.slice(start,end);
  assert.doesNotMatch(recovery,/KokoroJP\.load/);
  assert.doesNotMatch(recovery,/tts\.speak/);
});


test('one-click sync checks reusable narration before starting the heavy TTS engine',()=>{
  const start=html.indexOf("$('#autoSyncScenes').onclick=async()=>");
  const end=html.indexOf("\n\n$('#prepare').onclick=async()=>",start);
  const handler=html.slice(start,end);
  const reuseCheck=handler.indexOf('const allReusable=scenes.every');
  const prepareCall=handler.indexOf("await $('#prepare').onclick()");
  assert.ok(reuseCheck>=0&&prepareCall>reuseCheck);
  assert.match(handler,/if\(allReusable\)[\s\S]*location\.href=[\s\S]*return;/);
});


test('Voice Lab fast narration skips Kokoro preparation and limits cloud concurrency',()=>{
  assert.match(html,/cloud_melotts_ja/);
  assert.match(html,/generateCloudNarration/);
  assert.match(html,/generateCloudBatch\(cloudItems,3\)/);
  assert.match(html,/!isCloudVoice\(voice\)&&!tts/);
  assert.match(html,/cloudflare-workers-ai-melotts/);
  assert.match(html,/audio\/mpeg/);
});
