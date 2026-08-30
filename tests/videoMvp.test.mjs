import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMvpVideoResult,describeVideoExportFailure,isMvpShortsProject,validateMvpShortsOutput} from '../videoMvp.js';
import {getRecorderMimeCandidates,validatePreparedAudioForExport,validateVideoProject} from '../videoRenderer.js';
const make=()=>({genre:'great-person',platform:'youtube-shorts',output:{width:1080,height:1920,fps:30,format:'mp4',subtitles:true,bgmEnabled:true},scenes:[{durationSec:10,subtitleText:'字幕',subtitleEnabled:true,imageData:'data:image/png;base64,AA=='}],bgm:{source:'none',audioData:''},narration:{audioData:''}});
test('MVP Shorts基準をPASSする',()=>{const p=make();assert.equal(isMvpShortsProject(p),true);assert.equal(validateMvpShortsOutput(p,59.8).pass,true);});
test('解像度・fps・尺の逸脱を検出する',()=>{const p=make();p.output.width=720;p.output.height=1280;p.output.fps=60;const r=validateMvpShortsOutput(p,61);assert.equal(r.pass,false);assert.equal(r.errors.length,3);});
test('BGM StudioはShorts MVP対象外',()=>{const p=make();p.genre='bgm';assert.equal(validateMvpShortsOutput(p,180).applicable,false);});
test('H264/AAC候補をgeneric MP4より優先する',()=>{const a=getRecorderMimeCandidates(true),v=getRecorderMimeCandidates(false);assert.match(a[0],/avc1/i);assert.match(a[0],/mp4a/i);assert.match(v[0],/avc1/i);assert.ok(a.indexOf('video/mp4')>0);});
test('動画validation主要ケース',()=>{const p=make();p.scenes=[{durationSec:0,subtitleText:''}];const r=validateVideoProject(p);assert.ok(r.errors.some(x=>x.includes('0秒')));assert.ok(r.warnings.some(x=>x.includes('画像未登録')));});
test('生成結果をMVP判定する',()=>{const p=make();const ok=assessMvpVideoResult({project:p,durationSec:59,mimeType:'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',selectedMimeType:'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',videoWidth:1080,videoHeight:1920,captureFrameRate:30,hasAudio:true});assert.equal(ok.pass,true);const bad=assessMvpVideoResult({project:p,durationSec:59,mimeType:'video/webm',selectedMimeType:'video/webm',videoWidth:720,videoHeight:1280,captureFrameRate:60});assert.equal(bad.pass,false);});
test('メモリ失敗時に次操作を返す',()=>{const t=describeVideoExportFailure(new Error('Out of memory'),{durationSec:60,width:1080,height:1920,fps:30});assert.match(t,/メモリ/);assert.match(t,/先頭10秒/);});

test('期待したBGMやシーン音声が準備できない場合は検出する',()=>{const p=make();p.bgm={source:'upload',audioData:'data:audio/wav;base64,AA=='};p.scenes[0].narration={audioData:'data:audio/wav;base64,AA=='};const errors=validatePreparedAudioForExport(p,{audioArrayBuffer:null,audioFetchError:'read failed',sceneNarrations:[{error:'decode failed'}]});assert.equal(errors.length,2);assert.match(errors[0],/BGM/);assert.match(errors[1],/シーン別ナレーション/);});


test('画像素材ライブラリ参照も動画validationの画像件数へ反映する',()=>{
  const p=make();p.scenes[0].imageData='';p.scenes[0].imageAssetId='asset-1';p.mediaLibrary=[{id:'asset-1',type:'image',data:'data:image/png;base64,AA==',fileName:'scene.png'}];
  const r=validateVideoProject(p);assert.equal(r.imageCount,1);assert.equal(r.warnings.some(x=>x.includes('画像未登録')),false);
});
test('動画ファイルをBGMへ登録した主要validationエラーを検出する',()=>{
  const p=make();p.bgm={source:'upload',audioData:'data:video/mp4;base64,AA==',fileName:'clip.mp4'};const r=validateVideoProject(p);assert.equal(r.bgmInvalid,true);assert.ok(r.errors.some(x=>x.includes('動画ファイル')));
});
test('シーンなしは動画validationで明示的に失敗する',()=>{
  const p=make();p.scenes=[];const r=validateVideoProject(p);assert.ok(r.errors.some(x=>x.includes('シーンがありません')));assert.ok(r.errors.some(x=>x.includes('0秒')));
});
