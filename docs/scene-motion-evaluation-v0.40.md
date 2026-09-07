# Scene Motion Evaluation v0.40

v0.39のscene-motion分類モデルをproject単位でtrain/validationに分離して評価する。

- 同じprojectはtrainとvalidationを跨がない
- validation accuracy / correct / incorrect / skippedを集計
- label別confusion matrixを返す
- model本体ではなく評価summaryのみ返す
- deterministic seed対応
- UI・DB・schema・renderer・networkは変更しない

実UI統合は、この評価基盤の後に別Issueで行う。
