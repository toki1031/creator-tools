# Creator OS Sprint 3.4.0 — Kokoro日本語TTS実証版

## 目的
Piper PlusのiPhone Safari問題を追い続けず、最短で
「無料日本語ナレーション → WAV取得」まで通す。

## 採用
kokoro-js-jp 0.2.0
- ブラウザ専用
- 日本語/英語対応
- kokoro-js + Transformers.js/ONNX + Open JTalk WASM
- CDN向け自己完結ESM
- サーバー不要
- Apache-2.0

## 新ページ
/kokoro-lab.html

## テスト
1. GitHubへ全ファイル上書き
2. /diagnostics.html で Sprint 3.4.0確認
3. /kokoro-lab.html
4. 「Kokoro音声エンジンを準備」
5. 「こんにちは。今日はいい天気ですね。本田宗一郎。」を jf_alpha で生成
6. 音声再生
7. WAV保存

成功後はSprint 3.4.1でVoice Lab/動画用ナレーション欄へ統合する。
