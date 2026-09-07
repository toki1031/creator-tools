# Dataset Quality Audit v0.32

Phase BのDatasetを学習前に点検するpure helper。

- missing/duplicate id、invalid decisionType、invalid timestamp、data:/blob: URL混入をinvalidとして検出
- projectId、sceneId、humanAction、finalDecision、sourceの不足をwarningとして検出
- 自動削除・自動修正はしない
- 入力Datasetは変更しない
- UI/DB/schema/renderer/networkには触れない
