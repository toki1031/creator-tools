# Dataset Capture v0.2 — Scene Duration

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
