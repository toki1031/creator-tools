# Phase C v0.37: pairwise ranking evaluator

validation pairwise examplesに対して任意の同期scorerを共通指標で評価するpure helper。

集計:
- evaluated
- correct
- incorrect
- ties
- skipped
- pairwiseAccuracy

非数値scoreやscorer例外はskipし、入力を変更しない。学習実行やUI/network変更は含まない。
