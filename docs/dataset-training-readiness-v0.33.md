# Dataset Training Readiness v0.33

Phase Bで蓄積・export・aggregate・auditしたDecisionRecordを、Phase Cの小規模学習候補として扱えるかdecisionTypeごとに評価するpure helper。

既定の準備度は `insufficient` / `collect-more` / `candidate` の3段階。

既定threshold:
- collect-more: valid 20件以上、2 project以上
- candidate: valid 100件以上、5 project以上、source 1種類以上、invalid率5%以下

thresholdは呼び出し側で上書き可能。入力Datasetは変更せず、学習自体は実行しない。
