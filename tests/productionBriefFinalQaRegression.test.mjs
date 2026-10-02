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


const finalQaRequest=`
目的
人物紹介だけではなく、現代の視聴者が今日から使える形で伝える。

ナレーション方針
自然な日本語にする。
Scene番号、秒数、矢印、制作指示、見出しは読み上げない。
説明口調になりすぎず、短く分かりやすくする。

字幕方針
ナレーション内容に合わせる。
Scene番号、秒数、矢印、制作指示、見出しは字幕に表示しない。
1画面の文字量を多くしすぎない。

BGM
落ち着いたドキュメンタリー調。
ナレーションを邪魔しない音量。
Creator OSの標準BGMを使用してよい。

Scene 1
ナレーション:
テストです。
字幕:
テスト
映像:
AI再現。机上の資料を見る場面。
asset type: ai-reconstruction

最終QA
画像、ナレーション、字幕、BGMがすべて入っていること。
4つすべてのSceneに画像があること。
Scene番号、秒数、矢印、制作指示が字幕やナレーションに混入しないこと。
ナレーションと字幕の内容が大きくずれないこと。
BGMがナレーションを邪魔しないこと。
完成動画が正常に再生できること。
`;

test('ordinary QA sentences beginning with ナレーション or BGM remain QA criteria',()=>{
  const brief=parseProductionRequest(finalQaRequest);
  assert.deepEqual(brief.qaCriteria,[
    '画像、ナレーション、字幕、BGMがすべて入っていること。',
    '4つすべてのSceneに画像があること。',
    'Scene番号、秒数、矢印、制作指示が字幕やナレーションに混入しないこと。',
    'ナレーションと字幕の内容が大きくずれないこと。',
    'BGMがナレーションを邪魔しないこと。',
    '完成動画が正常に再生できること。'
  ]);
});

test('subtitle narration and BGM guidance stay in their own sections',()=>{
  const brief=parseProductionRequest(finalQaRequest);
  assert.deepEqual(brief.narrationGuidance,[
    '自然な日本語にする。',
    'Scene番号、秒数、矢印、制作指示、見出しは読み上げない。',
    '説明口調になりすぎず、短く分かりやすくする。'
  ]);
  assert.deepEqual(brief.subtitleGuidance,[
    'ナレーション内容に合わせる。',
    'Scene番号、秒数、矢印、制作指示、見出しは字幕に表示しない。',
    '1画面の文字量を多くしすぎない。'
  ]);
  assert.deepEqual(brief.bgmGuidance,[
    '落ち着いたドキュメンタリー調。',
    'ナレーションを邪魔しない音量。',
    'Creator OSの標準BGMを使用してよい。'
  ]);
});

test('section words inside ordinary sentences do not become headings without a colon',()=>{
  const brief=parseProductionRequest('最終QA\nナレーションと字幕を合わせる。\nBGMが大きすぎないこと。\n目的は達成できること。');
  assert.deepEqual(brief.qaCriteria,[
    'ナレーションと字幕を合わせる。',
    'BGMが大きすぎないこと。',
    '目的は達成できること。'
  ]);
});


const userNightingaleRequest=`
Scene 1
19世紀の軍病院。Florence Nightingaleが患者の記録や報告書を確認している。
ナレーション：
「正しいことを言えば、人は動く。本当にそうでしょうか。」

Scene 2
病院内の状況や記録を確認し、問題を整理しているFlorence Nightingale。
ナレーション：
「ナイチンゲールが向き合ったのは、医療だけではありませんでした。」

Scene 3
机の上に統計資料や死亡記録を広げ、数字を比較・分析している場面。
ナレーション：
「彼女は数字を集め、問題を見える形に変えていきました。」

Scene 4
統計や図表を使い、相手へ状況を説明している歴史再現場面。
ナレーション：
「大切だったのは、正しさではなく、相手が理解できる伝え方でした。」

Scene 5
資料を見ながら複数人が議論している現代の会議。
ナレーション：
「これは、今の仕事でも同じです。」

Scene 6
一人が説明資料を改善し、数字・具体例・比較を使って分かりやすく整理している現代の場面。
ナレーション：
「伝わらないときは、言葉を増やすより、見せ方を変えてみる。」

Scene 7
シンプルで印象的な締めの映像。
ナレーション：
「正しさを、伝わる形にする。それが、人を動かす一歩です。」

【画像・映像方針】
歴史Sceneは、可能な場合は信頼できる実物史料・歴史資料を優先してください。
実物史料が適さないSceneでは、AIによる歴史再現画像を使用して構いません。
AI歴史再現では、
19世紀として自然な服装、建物、家具、病院環境、紙資料にする
実写ドキュメンタリー風にする

【ナレーション】
Sceneごとの指定セリフを使用してください。
読み上げ用の文章には、
Scene番号
秒数
「ナレーション：」などのラベル
制作指示
記号だけの行
を混入させないでください。

【字幕】
ナレーション全文をそのまま長文表示するのではなく、意味のまとまりごとに読みやすく表示してください。

【BGM】
ナレーションを邪魔しない落ち着いたBGMを使用してください。

【最終確認】
画像がSceneの内容と一致している
無関係な人物・物体・怪物・武器などが生成されていない
問題がなければ、YouTube Shortsとして完成動画を生成してください。
`;

test('actual 7-Scene Nightingale request ends Scene 7 before bracketed production sections',()=>{
  const brief=parseProductionRequest(userNightingaleRequest);
  assert.equal(brief.sceneDirectives.length,7);
  const s7=brief.sceneDirectives[6];
  assert.equal(s7.narrationText,'正しさを、伝わる形にする。それが、人を動かす一歩です。');
  assert.doesNotMatch(s7.narrationText,/画像・映像方針|字幕|BGM|最終確認/);
  assert.doesNotMatch(s7.visualDirection,/画像・映像方針|字幕|BGM|最終確認/);
  assert.ok(brief.globalRules.length);
  assert.ok(brief.narrationGuidance.length);
  assert.ok(brief.subtitleGuidance.length);
  assert.ok(brief.bgmGuidance.length);
  assert.ok(brief.qaCriteria.length);
});

test('actual Nightingale Scene 2 and closing Scene route to automatic image providers',()=>{
  const brief=parseProductionRequest(userNightingaleRequest);
  assert.equal(brief.sceneDirectives[1].assetType,'ai-reconstruction');
  assert.equal(brief.sceneDirectives[6].assetType,'modern-visual');
  assert.notEqual(brief.sceneDirectives[1].assetType,'other');
  assert.notEqual(brief.sceneDirectives[6].assetType,'historical-source');
});

test('actual Nightingale Scene 2 always has usable image intent',()=>{
  const brief=parseProductionRequest(userNightingaleRequest);
  const s2=brief.sceneDirectives[1];
  assert.ok(s2.visualDirection.trim());
  assert.match(s2.visualDirection,/ナイチンゲール|Nightingale/i);
  assert.equal(s2.assetType,'ai-reconstruction');
});
