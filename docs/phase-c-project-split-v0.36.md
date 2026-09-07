# Phase C v0.36: project-level train/validation split

v0.35のpairwise ranking examplesをprojectId単位でtrain/validationへ分割するpure helper。

目的は同じproject由来の例がtrainとvalidationを跨ぐデータ漏洩を防ぐこと。

- deterministic hash + seed
- validationRatio指定可
- 同一projectは必ず同一split
- 入力不変
- UI/DB/schema/renderer/network/training実行なし
