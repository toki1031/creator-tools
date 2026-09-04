# Dataset Capture v0.5 — Scene motionの最終選択

## 対象

シーン編集のmotion selectを人間が変更し、変更前後の値が異なる操作だけを `project.learning.decisions[]` に `scene-motion` として記録する。

## 受入条件

- `none`、`zoom-in`、`zoom-out`、`pan-left`、`pan-right` 間の実変更を `proposal` / `finalDecision` に残す。
- 同じ値への再代入、初期描画、再描画、復元、migration、自動分割、内部補正、自動処理では記録しない。
- scene本文、index、duration、platform、aspect ratioをcontextとして記録する。
- Sceneが有効な画像素材を参照している場合だけ、その素材IDと既存rightsを記録し、権利情報を推測しない。
- 既存のmotion保存、Preview、動画renderer、Scene構造は変更しない。
- `schemaVersion = 4`、`DB_VERSION = 1`を維持する。

## 検証記録

- pure helperでmotion変更、変更前後、scene context、同値操作の無視、schemaVersion維持を回帰テストする。
- 全自動テスト、production build、`git diff --check`を実行する。
