import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSmartFinish, firstSmartFinishAction } from '../smartFinish.js';

const readyProject = () => ({
  scenes:[{text:'短い本文',subtitleText:'短い字幕',durationSec:3,imageAssetId:'a',narration:{audioData:'data:audio/wav;base64,AA=='}}],
  subtitleStyle:{enabled:true}, bgm:{enabled:false}, publish:{title:'タイトル',description:'説明'}
});

test('ready project can proceed to output', () => {
  const project = readyProject();
  assert.equal(inspectSmartFinish(project).ready, true);
  assert.equal(firstSmartFinishAction(project).route, 'output');
});

test('flags unreadably dense subtitles', () => {
  const project = readyProject();
  project.scenes[0].subtitleText = 'これは一秒では読み切れないほど長い字幕文章です。情報量を減らすか字幕カードを分割する必要があります。';
  project.scenes[0].durationSec = 1;
  const issue = inspectSmartFinish(project).issues.find(x => x.code === 'subtitle-too-fast');
  assert.equal(issue.route, 'subtitles-bgm');
});

test('blocks BGM explicitly marked commercial-use not allowed', () => {
  const project = readyProject();
  project.bgm = {enabled:true,audioData:'data:audio/mp3;base64,AA==',commercialUse:'not-allowed',license:'custom',sourceUrl:'https://example.test'};
  const report = inspectSmartFinish(project);
  assert.equal(report.errors, 1);
  assert.equal(report.issues.some(x => x.code === 'bgm-commercial-use-blocked'), true);
});

test('does not invent missing rights metadata', () => {
  const project = readyProject();
  project.bgm = {enabled:true,audioData:'data:audio/mp3;base64,AA=='};
  assert.equal(inspectSmartFinish(project).issues.some(x => x.code === 'bgm-rights-unconfirmed'), true);
});
