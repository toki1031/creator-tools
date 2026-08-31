# Dataset Capture v0.1

## Goal
Creator OSの制作中に生まれる「現在状態／システム提案 → 人間の変更 → 最終状態」を、将来の独自AI学習に使えるDecisionRecordとして残す。

v0.1では全操作ログを集めない。最初の対象は、意味が明確で回数も限定されるシーン順序変更とする。

## Storage
最初はproject内に保存する。

```js
project.learning = {
  decisions: []
}
```

IndexedDBの新storeは作らない。`DB_VERSION=1`を維持する。
`schemaVersion=4`も維持する。

既存projectは破壊的migrationを行わず、DecisionRecord helperを使う時に空状態へ安全補完する。

## DecisionRecord
v0.1の基本形：

```js
{
  id,
  decisionType,
  projectId,
  sceneId,
  context,
  proposal,
  alternatives,
  humanAction,
  finalDecision,
  reasonCode,
  reasonNote,
  source,
  assetIds,
  rights,
  timestamp
}
```

最初の`decisionType`は`scene-order`。

変更前のscene順を`proposal`、変更後を`finalDecision`として保存する。
`reasonCode` / `reasonNote`はv0.1では空でもよい。理由入力を毎回強制しない。

## Privacy / data flow
Dataset Capture v0.1は端末内projectデータに保存するだけで、外部AI・API・クラウドへ自動送信しない。

## Compatibility
`createProjectBackupPayload()`はproject全体をsafe cloneするため、追加fieldはバックアップpayloadへ含まれる。
復元時の明示的なDecisionRecord正規化は、実際のcapture接続と同じPR内または続く小変更で追加する。

## First implementation steps
1. `decisionLog.js`でDecisionRecordの正規化・追加・scene順snapshotをpure helper化
2. 新規projectへ`learning.decisions=[]`を追加
3. unit testを追加
4. scene上へ／下へ操作へcaptureを接続
5. backup/restore時にmalformed decisionを安全に補正
6. iPhone Safari Previewで従来の並び替え操作が壊れていないことを確認

## Non-goals
- 全クリックログ
- 入力キー単位ログ
- 外部送信
- 独自AI学習開始
- Python training pipeline
- Dataset管理画面
- 理由入力の強制
- schemaVersion 5
- IndexedDB新store
