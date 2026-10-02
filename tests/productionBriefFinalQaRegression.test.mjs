import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductionRequest } from '../productionBriefParser.js';

const request=`
目的
Florence Nightingaleの知恵を現代へ伝える。

Scene 1
ナレーション:
一つ目。
字幕:
一つ目。
映像:
AI再現。病院で記録を確認する場面。
asset type: ai-reconstruction

Scene 2
ナレーション:
二つ目。
字幕:
二つ目。
映像:
AI再現。統計資料や図表を整理する机上の場面。文字は描かない。
asset type: ai-reconstruction

Scene 3
ナレーション:
三つ目。
字幕:
三つ目。
映像:
AI再現。資料を前に話し合う場面。
asset type: ai-reconstruction

Scene 4
ナレーション:
四つ目。
字幕:
四つ目。
映像:
現代の会議で、分かりやすい図を使って説明する場面。
asset type: modern-visual

最終QA
画像、ナレーション、字幕、BGMがすべて入っていること。
Scene番号、秒数、矢印、制作指示が字幕やナレーションに混入しないこと。
`;

test('keeps positive visual intent while separating a prohibition in the same visual line',()=>{
  const brief=parseProductionRequest(request);
  const scene2=brief.sceneDirectives.find(scene=>scene.sceneId==='scene-2');
  assert.match(scene2.visualDirection,/AI再現/);
  assert.match(scene2.visualDirection,/統計資料や図表を整理する机上の場面/);
  assert.doesNotMatch(scene2.visualDirection,/文字は描かない/);
  assert.deepEqual(scene2.rules,['文字は描かない。']);
});

test('plain 最終QA ends the last Scene and becomes global QA criteria',()=>{
  const brief=parseProductionRequest(request);
  const scene4=brief.sceneDirectives.find(scene=>scene.sceneId==='scene-4');
  assert.equal(scene4.visualDirection,'現代の会議で、分かりやすい図を使って説明する場面。');
  assert.doesNotMatch(scene4.visualDirection,/最終QA|画像、ナレーション/);
  assert.deepEqual(brief.qaCriteria,[
    '画像、ナレーション、字幕、BGMがすべて入っていること。',
    'Scene番号、秒数、矢印、制作指示が字幕やナレーションに混入しないこと。'
  ]);
});

test('the field label 画 does not consume the first character of ordinary 画像 text',()=>{
  const brief=parseProductionRequest('Scene 1\n画像、ナレーション、字幕、BGMを確認する場面。');
  assert.equal(brief.sceneDirectives[0].visualDirection,'画像、ナレーション、字幕、BGMを確認する場面。');
});

test('mixed unlabeled visual and prohibition text is also split safely',()=>{
  const brief=parseProductionRequest('Scene 1: AI再現。机上の統計資料を見せる。文字は描かない。');
  const scene=brief.sceneDirectives[0];
  assert.match(scene.visualDirection,/AI再現/);
  assert.match(scene.visualDirection,/机上の統計資料/);
  assert.deepEqual(scene.rules,['文字は描かない。']);
});
