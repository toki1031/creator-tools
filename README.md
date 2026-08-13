Creator OS Sprint 3.1.9 VoiceLab ONNX同一オリジンキャッシュ版

目的:
- Sprint 3.1.8でONNX Runtimeのclassic scriptを読み込んでも window.ort が現れないことを確認。
- CDN上のONNX ES ModuleをSafariが直接importする経路をやめる。
- Service Workerを使い、ONNX Runtime公式npm配布物を初回だけCDNから取得しCache Storageへ保存。
- Voice Labからは ./vendor/onnxruntime/... という同一オリジンURLとして読み込む。
- GitHubへ約13MBのWASMを毎回アップロードしなくても、端末側ではローカルキャッシュとして保持する。

公式ONNX Runtime Webのデプロイ要件に合わせ、以下を同一オリジン経由で供給:
- ort.wasm.min.mjs
- ort-wasm-simd-threaded.mjs
- ort-wasm-simd-threaded.wasm

診断段階:
STEP 0 Service Worker / same-origin cache bridge
STEP 1 @piper-plus/g2p
STEP 2A ONNX Runtime JS asset
STEP 2B ONNX WASM helper MJS
STEP 2C ONNX WASM binary
STEP 3 ONNX Runtime ES Module import
STEP 4 Piper Plus import
STEP 5 Piper/voice model initialization

注意:
- 初回はONNX Runtime WASM（十数MB）とPiper音声モデルの通信が必要。
- 2回目以降はONNX資産をCache Storageから再利用する。
- 既存の動画生成/BGM/ナレーション合成コードは変更しない。
