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
