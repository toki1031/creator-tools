# Creator OS Sprint 3.2.0 — VoiceLab ONNX cdnjs同一オリジン固定版

## 目的
Sprint 3.1.9で STEP 2A が HTTP 502 となったため、ONNX Runtime Web の上流取得先と読み込み構成を変更。

## 変更
- jsDelivr依存を停止
- ONNX Runtime Web 1.23.2（Piper Plusの peer >=1.21.0 を満たす）をcdnjsから初回取得
- Service Worker + Cache Storageで同一オリジンURLに固定
- WASM専用エントリ `ort.wasm.bundle.min.mjs` を使用
- `ort-wasm-simd-threaded.wasm` を同一オリジンとして配信
- `numThreads=1`, `proxy=false` を継続しiPhone Safari向けに単純化

## 実機確認
Voice Lab → 音声エンジンを準備。
失敗時は STEP 番号とエラー全文のスクリーンショットを共有してください。

※既存の動画生成/BGM/ナレーション合成経路は変更していません。
