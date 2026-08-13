Creator OS Sprint 3.1.8 VoiceLab ONNX Safariブリッジ診断版

目的:
- Sprint 3.1.7で STEP 2 onnxruntime-web のES Module読込失敗まで原因を特定したため、
  ONNX Runtime Webだけ読み込み方式を変更する。
- iPhone SafariでES Module版 ort.min.mjs を直接importせず、公式ブラウザbundle
  ort.min.jsを通常<script>として読み込む。
- Creator OS側の ort-shim.js で window.ort をES Moduleへ橋渡しし、Piper Plusから
  `onnxruntime-web` として解決できるようにする。
- WASM取得先をONNX Runtime 1.24.0のdistへ固定、iOS向けに1 threadで試験する。

診断段階:
1. @piper-plus/g2p
2A. ONNX Runtime通常script（window.ort）
2B. ONNX Runtime ES Moduleブリッジ（ort-shim.js）
3. Piper Plus本体
4. 音声モデル初期化

既存の動画生成/BGM/ナレーション合成機能は変更しない。
