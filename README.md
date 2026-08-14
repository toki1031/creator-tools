# Creator OS Sprint 3.3.0 — Piper現行WebAssembly経路再構築版

## 方針変更
Sprint 3.2.8〜3.2.9では、旧piper-plus 0.6.0に対して
JapaneseG2P / OpenJTalk moduleをCreator OS側で手動注入しようとしていた。

実機診断で:
- 辞書22.6MBの端末保存は成功
- @piper-plus/g2p 0.4.1のexportにはJapaneseG2Pはある
- しかしOpenJTalk初期化exportはG2Pトップレベルには存在しない

公式の現在のversion pinでは:
- npm synthesis piper-plus: 0.7.x
- npm @piper-plus/g2p: 0.4.x

また日本語ではbundled OpenJTalk WASMを使う構成。

そのため3.3.0では、手動G2P/OpenJTalk注入をやめ、
現行piper-plus 0.7.xのブラウザWASM統合をそのまま使う。

## 維持するもの
- ONNX Runtime Safari対策
- Creator OSのVoice Lab UI
- 動画用ナレーション登録
- 端末保存済みOpenJTalk辞書（将来のローカル化用として保持可能）

## 診断順
1. G2P 0.4.1
2. ONNX Runtime
3. Piper Plus 0.7.x配布取得
4. ES Module import
5. PiperPlus export
6. モデル初期化
7. 日本語音声生成

## テスト
Voice Lab → 音声エンジンを準備
→ 「こんにちは。今日はいい天気ですね。本田宗一郎。」
→ 音声を生成
