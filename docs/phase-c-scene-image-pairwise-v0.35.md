# Phase C v0.35: scene-image-selection pairwise training prep

`scene-image-selection` DecisionRecordを、ランキング学習で扱いやすい `chosen` / `rejected` のpairwise例へ変換するpure helper。

保持するcontext:
- sceneText
- sceneIndex
- platform
- aspectRatio

除外:
- quality auditでinvalidなrecord
- chosenが空のrecord
- rejected候補がないrecord
- chosenと同じ候補
- data:/blob: URL

画像本体は扱わず、学習自体もまだ実行しない。入力Datasetは変更しない。
