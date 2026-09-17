import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const projectSource = fs.readFileSync(new URL("../project.ts", import.meta.url), "utf8");

const nightingaleBrief = {
  objective: "正しさだけでは人は動かない。相手が理解し、判断できる形にする、を現代の行動へ翻訳する。",
  tone: "calm educational documentary",
  globalRules: [
    "出典のない引用を使わない",
    "AI生成した歴史場面を史料写真として扱わない",
    "ナイチンゲール一人だけで改革したように描かない",
  ],
  subtitleGuidance: ["1〜2行", "モバイルで読める", "数字", "理解し、判断できる形", "数字、具体例、比較", "伝わる形"],
  narrationGuidance: ["日本語", "rate 0.92", "落ち着いた教育ドキュメンタリー"],
  bgmGuidance: ["静かなドキュメンタリー", "ナレーション優先"],
  seGuidance: ["紙・ペン・小さな転換音のみ", "戦争音・悲鳴・心拍音を使わない"],
  sceneDirectives: [
    { sceneId: "scene-5", visualDirection: "1858年の実物統計史料", purpose: "数字を一目で伝わる形にしたことを示す", assetType: "historical-source", motionGuidance: "史料は静かに見せる", rules: ["AI生成したそれらしい統計図で代用しない"] },
    { sceneId: "scene-6", visualDirection: "行政・報告・改革を象徴的に表現", purpose: "データが改革を進める力になったことを示す", assetType: "ai-reconstruction", motionGuidance: "slow pan", rules: ["架空の議会・政府高官向けプレゼン場面を作らない", "ナイチンゲール一人だけで改革したように描かない"] },
    { sceneId: "scene-8", visualDirection: "現代へ戻り、簡単な図・比較・具体例を示す", purpose: "史実を現代の行動へ翻訳する", assetType: "modern-visual", motionGuidance: "slow zoom", rules: ["歴史上の数値を捏造しない"] },
  ],
  qaCriteria: [
    "約60秒",
    "最初の3秒で問題提起",
    "メッセージを一つに絞る",
    "史実と現代への翻訳を分ける",
    "出典のない引用を使わない",
    "架空の統計を使わない",
    "実物史料とAI再現を区別する",
    "英雄化しすぎない",
    "今日できる具体的行動がある",
    "偉人を知るだけの動画にしない",
  ],
};

test("CreatorProject keeps productionBrief optional for backward compatibility", () => {
  assert.match(projectSource, /productionBrief\?:\s*ProductionBrief/);
  assert.match(projectSource, /schemaVersion:\s*1/);
});

test("ProductionBrief exposes the Phase 1-A fields and asset types", () => {
  for (const field of ["objective", "tone", "globalRules", "subtitleGuidance", "narrationGuidance", "bgmGuidance", "seGuidance", "sceneDirectives", "qaCriteria"]) {
    assert.match(projectSource, new RegExp(`\\b${field}\\b`));
  }
  for (const assetType of ["historical-source", "ai-reconstruction", "modern-visual", "document", "other"]) {
    assert.ok(projectSource.includes(`\"${assetType}\"`));
  }
});

test("Nightingale fixture survives project-style structured clone without losing directives", () => {
  const project = {
    id: "nightingale-fixture",
    title: "Florence Nightingale",
    genre: "great-person",
    platform: "youtube-shorts",
    aspectRatio: "9:16",
    targetDurationSec: 60,
    displayScript: "",
    speechScript: "",
    scenes: [],
    narration: { voiceURI: "", rate: 0.92, pitch: 1, volume: 1 },
    subtitleStyle: { fontSize: 48, position: "bottom", maxCharsPerLine: 18 },
    productionBrief: nightingaleBrief,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
    schemaVersion: 1,
  };

  const restored = structuredClone(project);
  assert.deepEqual(restored.productionBrief, nightingaleBrief);
  assert.equal(restored.productionBrief.sceneDirectives[0].assetType, "historical-source");
  assert.equal(restored.productionBrief.sceneDirectives[0].rules[0], "AI生成したそれらしい統計図で代用しない");
  assert.equal(restored.productionBrief.sceneDirectives[1].rules[0], "架空の議会・政府高官向けプレゼン場面を作らない");
  assert.equal(restored.productionBrief.sceneDirectives[2].purpose, "史実を現代の行動へ翻訳する");
  assert.equal(restored.productionBrief.qaCriteria.length, 10);
});

test("legacy project shape remains valid without productionBrief data", () => {
  const legacyProject = { id: "legacy", schemaVersion: 1, scenes: [] };
  assert.equal("productionBrief" in legacyProject, false);
});
