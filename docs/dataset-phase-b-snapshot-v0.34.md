# Dataset Phase B Snapshot v0.34

v0.30〜v0.33のPhase B helperを1つの機械可読reportにまとめるpure helper。

含むもの:
- export shape inspection
- 複数export aggregate
- DecisionRecord quality audit
- decisionType別 training readiness

含まないもの:
- UI
- DB/schema migration
- 外部送信
- 自動学習
- Dataset自動修正

将来のCLI、分析画面、Phase C pipelineから再利用できる形を維持する。
