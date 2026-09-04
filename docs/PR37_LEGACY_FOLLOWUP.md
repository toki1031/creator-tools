# PR #37 follow-up: legacy image proposal accuracy

PR #37のレビューで確認した非破壊のDataset精度課題。

legacy `scene.imageData` が残るSceneで別assetを選択する場合、現行PRでは `beforeAssetId` を `promoteLegacySceneImage()` より前に取得するため、DecisionRecordの `proposal.imageAssetId` が `null` になる可能性がある。

既存画像表示・保存機能自体は壊れないが、Datasetのbefore状態が不正確になるため、後続Issueで以下の最小修正を行う。

- `promoteLegacySceneImage()` 後に `beforeAssetId` を取得
- promotion自体ではDecisionRecordを生成しない
- 通常の `scene.imageAssetId` ありSceneは挙動を変えない
- legacyケースの回帰テストを追加
- schemaVersion=4 / DB_VERSION=1を維持
