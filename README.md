Creator OS Sprint 3.2.1 VoiceLab Piper同一オリジン診断版

目的:
- Sprint 3.2.0でONNX Runtime初期化まで到達し、STEP 4 piper-plus のES Module読込で停止した問題を切り分ける。
- Piper Plus 0.7.0本体と @piper-plus/g2p 0.4.1 を、SafariのES ModuleローダーへCDN直URLで渡さず、Service Worker経由の同一オリジン仮想URLとして配信する。

診断:
STEP 1A G2P取得
STEP 1B G2P import
STEP 2A ONNX JS
STEP 2B ONNX WASM
STEP 3 ONNX初期化
STEP 4A Piper本体取得
STEP 4B Piper module import
STEP 4C PiperPlus export
STEP 4D 主要依存接続
STEP 5 日本語モデル初期化

注意:
- 初回は外部vendorファイル取得が必要。以後Cache Storageを優先。
- 既存の動画生成/BGM/ナレーション合成コードは変更していない。
