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
  assert.match(html,/generateCloudBatch\(cloudItems,2\)/);
  assert.match(html,/!isCloudVoice\(voice\)&&!tts/);
  assert.match(html,/cloudflare-workers-ai-melotts/);
  assert.match(html,/audio\/mpeg/);
});


test('Voice Lab retries cloud narration and propagates Scene sync failures to one-click status',()=>{
  assert.match(html,/attempts=3/);
  assert.match(html,/Promise\.allSettled/);
  assert.match(html,/generateCloudBatch\(cloudItems,2\)/);
  assert.match(html,/const syncResult=await \$\('#generateScenes'\)\.onclick\(\)/);
  assert.match(html,/if\(syncResult\?\.ok===false\)throw syncResult\.error/);
  assert.match(html,/return \{ok:false,error:e\}/);
});


test('Cloudflare MeloTTS uses the provider Japanese language code',async()=>{
  const source=await readFile(new URL('../functions/api/generate-narration.js',import.meta.url),'utf8');
  assert.match(source,/lang:'jp'/);
  assert.doesNotMatch(source,/lang:'ja'/);
});


test('Cloud narration reuse fingerprints include the cloud source',()=>{
  assert.match(html,/narrationSourceForVoice/);
  assert.match(html,/cloudflare-workers-ai-melotts/);
  assert.match(html,/canReuseNarration\(scene,text,voice\)/);
  assert.match(html,/fingerprint:narrationFingerprintFor\(text,voice\)/);
});


test('MeloTTS endpoint normalizes documented base64 Audio responses',async()=>{
  const source=await readFile(new URL('../functions/api/generate-narration.js',import.meta.url),'utf8');
  assert.match(source,/typeof result\.audio==='string'/);
  assert.match(source,/atob\(result\.audio\)/);
  assert.match(source,/new Uint8Array/);
});

test('Cloud MP3 duration uses browser metadata instead of Web Audio decoding',()=>{
  assert.match(html,/blob\?\.type==='audio\/mpeg'/);
  assert.match(html,/new Audio\(\)/);
  assert.match(html,/onloadedmetadata/);
  assert.match(html,/audioDurationFromBlob\(blob,audioBuffer\)/);
});
