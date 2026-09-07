# Dataset Phase B v0.31

Dataset Export v0.30で書き出したJSONを、外部送信せずローカル処理するための最小集計層。

## Scope
- v0.30 export shapeの点検
- 複数exportのDecisionRecord件数集計
- decisionType別件数集計

## Safety
- 元Datasetを変更しない
- 素材Data URLを扱わない
- 外部送信しない
- schemaVersion / DB_VERSIONを変更しない
- UIを変更しない

## Next
この集計結果を使い、学習対象として十分な件数・偏りがあるdecisionTypeを選定してPhase Cの小規模ランキング/スコアリング実験へ進む。
