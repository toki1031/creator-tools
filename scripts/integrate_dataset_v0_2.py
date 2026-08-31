from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

# 1) DecisionRecord helper
path = Path("decisionLog.js")
text = path.read_text(encoding="utf-8")
if "export function recordSceneDurationChange" not in text:
    marker = "\nexport function moveSceneWithDecision(project, index, direction, options = {}) {"
    helper = r'''

export function recordSceneDurationChange(project, {
  sceneId,
  beforeDurationSec,
  afterDurationSec,
  sceneIndex,
  totalDurationBefore
}, options = {}) {
  const before = Number(beforeDurationSec);
  const after = Number(afterDurationSec);
  if (!sceneId || !Number.isFinite(before) || !Number.isFinite(after) || before < 1 || after < 1) return null;
  if (Math.abs(before - after) < 0.001) return null;

  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const requestedIndex = Number(sceneIndex);
  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length
    ? requestedIndex
    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));
  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : scenes.find(item => String(item?.id || '') === String(sceneId));
  const targetDuration = Number(project?.targetDurationSec);
  const suppliedTotalBefore = Number(totalDurationBefore);
  const currentTotal = scenes.reduce((sum, item) => sum + (Number(item?.durationSec) || 0), 0);
  const inferredTotalBefore = Number.isFinite(currentTotal) ? currentTotal - after + before : before;

  return appendDecision(project, {
    decisionType: 'scene-duration',
    sceneId: String(sceneId),
    context: {
      screen: 'scene-editor',
      sceneIndex: resolvedIndex,
      sceneNumber: resolvedIndex >= 0 ? resolvedIndex + 1 : null,
      sceneText: stringOr(scene?.text),
      targetDurationSec: Number.isFinite(targetDuration) ? targetDuration : null,
      projectTotalDurationSecBefore: Number.isFinite(suppliedTotalBefore) ? suppliedTotalBefore : inferredTotalBefore
    },
    proposal: { durationSec: before },
    alternatives: [],
    humanAction: { type: 'set-duration' },
    finalDecision: { durationSec: after },
    reasonCode: '',
    reasonNote: '',
    source: { type: 'system', feature: 'scene-editor', version: '0.2' },
    assetIds: [],
    rights: {}
  }, options);
}
'''
    text = replace_once(text, marker, helper + marker, "decisionLog insertion")
    path.write_text(text, encoding="utf-8")

# 2) Scene editor wiring: keep oninput behavior, capture only the value committed at blur.
path = Path("main.js")
text = path.read_text(encoding="utf-8")
old_import = 'import { ensureLearningState, moveSceneWithDecision } from "./decisionLog.js";'
new_import = 'import { ensureLearningState, moveSceneWithDecision, recordSceneDurationChange } from "./decisionLog.js";'
if new_import not in text:
    text = replace_once(text, old_import, new_import, "main import")

old_binding = '    root.querySelectorAll("[data-duration]").forEach(el=>el.oninput=()=>{updateSceneDuration(project.scenes[Number(el.dataset.duration)],el.value);root.querySelector("#totalDuration").textContent=`${total()}秒`;save();});'
new_binding = '''    root.querySelectorAll("[data-duration]").forEach(el=>{
      const index=Number(el.dataset.duration);
      el.onfocus=()=>{el.dataset.durationBefore=String(Math.max(1,Number(project.scenes[index]?.durationSec)||1));};
      el.oninput=()=>{updateSceneDuration(project.scenes[index],el.value);root.querySelector("#totalDuration").textContent=`${total()}秒`;save();};
      el.onblur=()=>{
        const scene=project.scenes[index];if(!scene)return;
        const before=Number(el.dataset.durationBefore),raw=Number(el.value),after=Math.max(1,Number(scene.durationSec)||1);
        if(Number.isFinite(raw)&&raw>=1&&Number.isFinite(before)&&before>=1){
          const currentTotal=total();
          recordSceneDurationChange(project,{sceneId:scene.id,beforeDurationSec:before,afterDurationSec:after,sceneIndex:index,totalDurationBefore:currentTotal-after+before});
        }
        el.dataset.durationBefore=String(after);save();
      };
    });'''
if "el.dataset.durationBefore" not in text:
    text = replace_once(text, old_binding, new_binding, "duration binding")
path.write_text(text, encoding="utf-8")

# 3) Unit tests
path = Path("tests/decisionLog.test.mjs")
text = path.read_text(encoding="utf-8")
old_import_piece = "  normalizeLearningState,\n  recordSceneOrderChange,\n  snapshotSceneOrder"
new_import_piece = "  normalizeLearningState,\n  recordSceneDurationChange,\n  recordSceneOrderChange,\n  snapshotSceneOrder"
if "recordSceneDurationChange" not in text:
    text = replace_once(text, old_import_piece, new_import_piece, "test import")

if "scene-duration stores one committed duration decision" not in text:
    text += r'''

test('scene-duration stores one committed duration decision with editing context', () => {
  const project = {
    id: 'p-duration',
    targetDurationSec: 60,
    learning: { decisions: [] },
    scenes: [
      { id: 's1', text: 'intro', durationSec: 8, imageAssetId: 'asset-1', subtitleText: 'subtitle', narration: { audioData: 'audio' } },
      { id: 's2', text: 'next', durationSec: 5 }
    ]
  };
  const record = recordSceneDurationChange(project, {
    sceneId: 's1',
    beforeDurationSec: 5,
    afterDurationSec: 8,
    sceneIndex: 0,
    totalDurationBefore: 10
  }, {
    createId: () => 'decision-duration',
    now: () => '2026-08-31T13:30:00.000Z'
  });

  assert.equal(record.id, 'decision-duration');
  assert.equal(record.decisionType, 'scene-duration');
  assert.equal(record.sceneId, 's1');
  assert.deepEqual(record.proposal, { durationSec: 5 });
  assert.deepEqual(record.finalDecision, { durationSec: 8 });
  assert.equal(record.humanAction.type, 'set-duration');
  assert.equal(record.context.sceneIndex, 0);
  assert.equal(record.context.sceneNumber, 1);
  assert.equal(record.context.sceneText, 'intro');
  assert.equal(record.context.targetDurationSec, 60);
  assert.equal(record.context.projectTotalDurationSecBefore, 10);
  assert.equal(record.source.version, '0.2');
  assert.equal(project.learning.decisions.length, 1);
  assert.equal(project.scenes[0].imageAssetId, 'asset-1');
  assert.equal(project.scenes[0].subtitleText, 'subtitle');
  assert.equal(project.scenes[0].narration.audioData, 'audio');
});

test('scene-duration ignores same or invalid values and does not create noise', () => {
  const project = { id: 'p-duration', targetDurationSec: 60, learning: { decisions: [] }, scenes: [{ id: 's1', text: 'intro', durationSec: 5 }] };
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 5, afterDurationSec: 5, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 0, afterDurationSec: 5, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 5, afterDurationSec: Number.NaN, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: '', beforeDurationSec: 5, afterDurationSec: 8, sceneIndex: 0 }), null);
  assert.equal(project.learning.decisions.length, 0);
});
'''
path.write_text(text, encoding="utf-8")

# 4) Design note
Path("docs/DATASET_CAPTURE_V0_2.md").write_text(r'''# Dataset Capture v0.2 — Scene Duration

## Goal
Dataset Capture v0.1のDecisionRecord基盤を、シーンの表示秒数という次の意味ある編集判断へ拡張する。

## Decision type
`scene-duration`

変更前の確定済み秒数を`proposal.durationSec`、ユーザーが編集後に確定した秒数を`finalDecision.durationSec`へ保存する。

## Capture timing
- focus時に変更前の確定値を保持する
- `oninput`は従来どおりシーン尺・字幕タイミング・合計尺の更新と保存だけを行う
- blur時に、focus時の値と最終値が異なる場合だけ1件記録する
- 同じ値へ戻した場合、空欄や0など無効な入力ではDecisionRecordを追加しない
- 自動分割、復元、内部補正による変更はv0.2では記録しない

この方式により、`5 → 1 → 12`のような入力途中値を学習データへ混ぜず、`5 → 12`という人間の確定判断だけを残す。

## Context
DecisionRecordには以下を保持する。
- projectId / sceneId
- sceneIndex / sceneNumber / sceneText
- targetDurationSec
- projectTotalDurationSecBefore
- timestamp

## Compatibility
- `schemaVersion=4`を維持
- IndexedDB `DB_VERSION=1`を維持
- 新storeなし
- Dataset外部送信なし
- JSON backup/restoreは既存DecisionRecord正規化経路を利用する
- `updateSceneDuration()`の字幕開始・終了補正ロジックは変更しない

## Non-goals
- 字幕・台本文字のキー入力ログ
- 画像/BGM/ナレーション/motion/transitionの判断記録
- 理由入力の強制
- Dataset管理画面
- 外部AI/API送信
- 独自モデル学習開始
''', encoding="utf-8")

print("Dataset Capture v0.2 integration applied")
