import test from "node:test";
import assert from "node:assert/strict";
import { parseProductionRequest } from "../productionBriefParser.js";

const request = `
# 目的
正しさだけでは人は動かない。相手が理解し、判断できる形にする、を現代の行動へ翻訳する。
# トーン
落ち着いた教育ドキュメンタリー
# 全体ルール
- 出典のない引用を使わない
- AI生成した歴史場面を史料写真として扱わない
- ナイチンゲール一人だけで改革したように描かない
# 字幕
- 1〜2行
- 数字
- 理解し、判断できる形
- 数字、具体例、比較
- 伝わる形
# ナレーション
- 日本語 約0.92 speed
- 落ち着いた教育ドキュメンタリー
# BGM
- 静かなドキュメンタリー
- ナレーション優先
# SE
- 紙・ペン・小さな転換音のみ
- 戦争音・悲鳴・心拍音を使わない
Scene 1: 現代の会議。女性が説明しているが伝わっていない。
Scene 2: クリミア戦争の病院をAI再現する。
- 赤十字を描かない
Scene 3: ナイチンゲールが報告書を調べる。
Scene 4: 記録と数字を見せる。
- 70%など架空の比率を使わない
Scene 5: 1858年の実物統計史料を使う。
目的: 数字を一目で伝わる形にしたことを示す
動き: 史料は静かに見せる
- AI生成した偽の統計図で代用しない
Scene 6: 行政・報告・改革をAI再現で象徴的に表現。
- 架空の議会・政府高官向けプレゼン場面を作らない
- ナイチンゲール一人だけで改革したように描かない
Scene 7: ナイチンゲールが書類と考える。
Scene 8: 現代へ戻り、簡単な図・比較・具体例を示す。
目的: 史実紹介から現代への翻訳へ戻る
Scene 9: 現代の手元。数字・具体例・比較の一つを加える。
# 最終QA
1. 約60秒
2. 最初の3秒で問題提起
3. メッセージを一つに絞る
4. 史実と現代への翻訳を分ける
5. 出典のない引用を使わない
6. 架空の統計を使わない
7. 実物史料とAI再現を区別する
8. 英雄化しすぎない
9. 今日できる具体的行動がある
10. 偉人を知るだけの動画にしない
`;

test("parses Nightingale request into a ProductionBrief", () => {
  const brief = parseProductionRequest(request);
  assert.match(brief.objective, /理解し、判断できる形/);
  assert.equal(brief.tone, "落ち着いた教育ドキュメンタリー");
  assert.equal(brief.sceneDirectives.length, 9);
  assert.equal(brief.qaCriteria.length, 10);
});

test("keeps safety-critical Nightingale directives", () => {
  const brief = parseProductionRequest(request);
  const scene5 = brief.sceneDirectives.find((scene) => scene.sceneId === "scene-5");
  const scene6 = brief.sceneDirectives.find((scene) => scene.sceneId === "scene-6");
  const scene8 = brief.sceneDirectives.find((scene) => scene.sceneId === "scene-8");
  assert.equal(scene5.assetType, "historical-source");
  assert.ok(scene5.rules.some((rule) => rule.includes("偽の統計図")));
  assert.ok(scene6.rules.some((rule) => rule.includes("架空の議会")));
  assert.ok(scene6.rules.some((rule) => rule.includes("一人だけで改革")));
  assert.match(scene8.purpose, /現代への翻訳/);
});

test("keeps subtitle, narration, BGM and SE guidance", () => {
  const brief = parseProductionRequest(request);
  for (const phrase of ["数字", "理解し、判断できる形", "数字、具体例、比較", "伝わる形"]) {
    assert.ok(brief.subtitleGuidance.includes(phrase));
  }
  assert.ok(brief.narrationGuidance.some((item) => item.includes("0.92")));
  assert.ok(brief.bgmGuidance.some((item) => item.includes("ナレーション優先")));
  assert.ok(brief.seGuidance.some((item) => item.includes("心拍音を使わない")));
});

test("preserves QA order and accepts empty or partial input", () => {
  const brief = parseProductionRequest(request);
  assert.equal(brief.qaCriteria[0], "約60秒");
  assert.equal(brief.qaCriteria[9], "偉人を知るだけの動画にしない");
  assert.deepEqual(parseProductionRequest(""), {
    objective: "", tone: "", globalRules: [], subtitleGuidance: [], narrationGuidance: [], bgmGuidance: [], seGuidance: [], sceneDirectives: [], qaCriteria: [],
  });
  assert.equal(parseProductionRequest("目的: テスト").objective, "テスト");
});
