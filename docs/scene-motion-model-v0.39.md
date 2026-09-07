# Scene Motion Model v0.39

Creator OS内の`scene-motion` DecisionRecordから作ったv0.38教師データを使う、最初の小規模Original AI分類モデル。

- 外部AI/APIなし
- 追加費用なし
- JavaScriptのみ
- sceneTextの文字unigram/bigramと、platform・aspectRatio・duration帯・sceneIndex帯を特徴量にする
- multinomial Naive Bayesで学習
- modelはJSON保存可能
- 同じデータから同じmodel/predictionを得る
- UI・DB・schema・rendererにはまだ接続しない

この段階では「学習・予測できる基礎モデル」を完成させる。Creator OS画面から提案として使う統合は、評価後の別Issueで行う。
