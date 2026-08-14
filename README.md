# Creator OS Sprint 3.2.4 — Piper npm公開版0.6.0準拠

## この版で直したこと
Sprint 3.2.3 の診断で、piper-plus@0.7.0 は unpkg / jsDelivr / esm.sh の3系統で取得できず、
jsDelivr と esm.sh では 404 になった。

公開npmパッケージの package.json を確認した結果:
- piper-plus 公開版: 0.6.0
- ES Module正式入口: src/index.js
- @piper-plus/g2p 依存: ^0.4.0
- onnxruntime-web peer dependency: >=1.21.0

このため Sprint 3.2.4 では 0.7.0 前提を完全撤去し、
公開npm仕様に合わせて以下を固定した。

- piper-plus@0.6.0/src/index.js
- @piper-plus/g2p@0.4.0/src/index.js
- ONNX Runtime Web: Sprint 3.2.0以降で実機突破済みのSafari対策経路を維持

## 診断順
STEP 1  G2P
STEP 2  ONNX JS/WASM
STEP 3  ONNX初期化
STEP 4A Piper Plus 0.6.0取得
STEP 4B Piper Plus ES Module読込
STEP 4C PiperPlus export確認
STEP 4D G2P / ONNX接続確認
STEP 5  日本語モデル初期化
STEP 6  日本語WAV生成

## テスト
GitHubへ中身を上書きし、
Voice Lab → 「音声エンジンを準備」を実行する。

次に失敗した場合は、STEP番号と全文をそのまま記録する。
