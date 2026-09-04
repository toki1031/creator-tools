# Dataset Capture v0.4 — Scene画像素材の最終選択

## 対象

シーン編集の画像素材ライブラリで、人間が「このシーンで使う」を押し、`scene.imageAssetId` が実際に別の値へ変わった操作だけを `project.learning.decisions[]` に `scene-image-selection` として記録する。

## 受入条件

- 変更直前と変更後の有効な画像素材IDを `proposal` / `finalDecision` に残す。
- 同じ素材の再選択、アップロード、自動分割、復元、初期描画、プレビュー、resolverでは記録しない。
- 画面に実際に表示された候補だけを `alternatives` と `assetIds` の候補にする。
- `assetIds` からnull、存在しないID、不正画像、重複を除外する。
- 採用素材に既存の権利・ライセンス・出典メタデータがある場合だけ `rights` にコピーし、推測しない。
- `schemaVersion = 4`、`DB_VERSION = 1`、既存の画像参照・legacy fallback・backup/restore形式を維持する。

## 検証記録

- pure helperで未選択からの採用、素材差し替え、同値操作の無視、scene context、ID正規化、権利情報を回帰テストする。
- 全自動テストとproduction buildを実行する。
