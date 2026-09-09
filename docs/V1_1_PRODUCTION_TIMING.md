# v1.1 Production Timing

制作時間ログはAI Datasetとは分離する。

- route単位の滞在時間だけを測る
- sessionStorageで現在Stageを保持する
- 台本本文、画像、音声、個人情報はログへ入れない
- 目的は「どの工程で時間がかかるか」を把握し、次の改修優先順位へ使うこと
- 自動保存競合を避けるため、Stage遷移helperと永続化を分離する
