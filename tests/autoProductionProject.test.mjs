import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoProductionProject } from '../autoProductionProject.js';

const nightingaleRequest = `
## 目的
正しさだけでは人は動かない。相手が理解し、判断できる形にすることを今日の行動へ変換する。
## トーン
落ち着いた教育ドキュメンタリー
Scene 1
目的：現代の会議で伝わらない問題を提示する
現代の会議。女性が説明しているが伝わっていない。
Scene 2
目的：クリミア戦争の状況へ移る
AI再現。クリミア戦争の病院。赤十字は描かない。
Scene 3
目的：戦後の分析へ進む
ナイチンゲールが報告書を調べる。読める架空文書名は作らない。
Scene 4
目的：数字で捉え直す
記録と数字。70%など架空の比率は使わない。
Scene 5
目的：視覚化の力を示す
1858年の実物統計史料を使う。AI生成した偽の統計図で代用しない。
動き：史料は静かに見せる
Scene 6
目的：改革につながる流れを示す
行政・報告・衛生改革を象徴的に見せる。架空の議会プレゼン場面を作らない。ナイチンゲール一人だけで改革したように描かない。
Scene 7
目的：学びを言語化する
ナイチンゲールが資料を見ながら考える。
Scene 8
目的：現代への翻訳へ戻る
現代。数字・具体例・比較の簡単な図を示す。
Scene 9
目的：今日の行動で終える
現代の手元。資料に数字・具体例・比較のどれか一つを加える。
■音声・BGM: 静かなドキュメンタリーBGM
## 最終QA
約60秒
9シーン
史実と現代解釈を分ける
`;

test('creates a new nine-scene auto-production project locally', () => {
  const result = createAutoProductionProject({ requestText: nightingaleRequest, title: 'ナイチンゲール' });
  assert.equal(result.ok, true);
  assert.equal(result.project.title, 'ナイチンゲール');
  assert.equal(result.project.genre, 'great-person');
  assert.equal(result.project.platform, 'youtube-shorts');
  assert.equal(result.project.scenes.length, 9);
  assert.equal(result.project.productionBrief.sceneDirectives.length, 9);
  assert.equal(result.project.autoProduction.source, 'local-parser');
  assert.equal(result.project.bgm.source, 'procedural');
  assert.equal(result.project.bgm.procedural.preset, 'calm-documentary');
  assert.equal(result.project.bgm.ducking, true);
  const total = result.project.scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  assert.ok(Math.abs(total - 60) < 0.1);
});

test('rejects an empty request without creating a project', () => {
  const result = createAutoProductionProject({ requestText: '   ' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty-request');
  assert.equal(result.project, null);
});

test('rejects a request with no recognized Scene headings', () => {
  const result = createAutoProductionProject({ requestText: '目的：動画を作るだけ' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-scenes');
  assert.equal(result.project, null);
});

test('project payload keeps the ProductionBrief through structured cloning', () => {
  const result = createAutoProductionProject({ requestText: nightingaleRequest });
  const cloned = structuredClone(result.project);
  assert.equal(cloned.productionBrief.objective, result.project.productionBrief.objective);
  assert.equal(cloned.productionBrief.sceneDirectives[4].assetType, 'historical-source');
  assert.equal(cloned.scenes.length, 9);
});

test('Nightingale workflow markers do not become Scene text and multiline Scene 3 is reconstruction', () => {
  const request = `
■半自動進行
素材検索
↓
ナレーション
↓
字幕
↓
Scene 1
映像: 現代。
正しいことを説明しているのに、相手に十分伝わっていない場面。
Scene 2
映像: クリミア戦争期の軍病院。
多くの兵士が置かれていた現実を示す。
Scene 3
映像: 戦争後。
ナイチンゲールが記録・報告書などを調べていることを示す。
`;
  const result = createAutoProductionProject({ requestText: request, title: 'Nightingale regression' });
  assert.equal(result.ok, true);
  assert.equal(result.project.scenes[0].speechText, '');
  assert.equal(result.project.scenes[0].subtitleText, '');
  assert.equal(result.project.scenes[0].text, '');
  assert.equal(result.project.scenes[2].productionDirection.assetType, 'ai-reconstruction');
});

test('carries trailing Scene-specific archive guidance into runtime productionDirection',()=>{const request=`Scene 5\n映像: 統計を「見える形」にしたことを示す。\nここは可能な限り確認可能な実物史料を使用する。\nScene 9\n映像: 今日できる一歩。\n■Scene 5の重要指定\nナイチンゲールの統計図は、\n1858年前後の確認可能な実物史料を優先して使用する。\n■完成条件\n55〜60秒`;const result=createAutoProductionProject({requestText:request,title:'Nightingale targeted guidance'});assert.equal(result.ok,true);const s5=result.project.scenes.find(s=>s.id==='scene-5');assert.match(s5.productionDirection.searchHint,/ナイチンゲール/);assert.match(s5.productionDirection.searchHint,/1858/);assert.doesNotMatch(s5.productionDirection.visualDirection,/Scene 5の重要指定/)});
