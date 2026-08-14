# Creator OS Sprint 3.2.7 — 日本語辞書ロード経路診断版

## 直前の実機結果
Sprint 3.2.6:
STEP 1C 日本語G2P初期化失敗: Load failed

Piper Plus / ONNX Runtime / G2P module本体の読み込みは維持し、
日本語OpenJTalk辞書の `loadJaDict()` だけを診断する。

## 追加した診断
`loadJaDict()` 実行中だけ `window.fetch` を監視し、以下を記録する。

- 実際に要求したURL
- HTTP status
- Content-Type
- Content-Length
- 所要時間
- fetch自体が失敗した場合のエラー

辞書ロードが失敗すると、STEP 1Cに取得ログを併記する。

## 目的
次の対策を推測で決めず、
辞書ファイルURLの404/502、CORS、MIME、Safariの通信失敗などを実データで確定する。
