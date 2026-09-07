# Dataset Aggregate v0.31

Purpose: Phase Bを進め、v0.30 Dataset exportを複数まとめて件数・decisionType分布を安全に点検できるpure helperを追加する。

Acceptance:
- v0.30 exportを検証できる
- 複数exportのtotal decisionsを集計できる
- decisionType別件数を集計できる
- 不正entryを安全に無視できる
- 元データを変更しない
- UI/DB/schema/renderer変更なし
- 外部送信なし
- tests/build/Quality Gates PASS
