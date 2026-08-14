# Creator OS Sprint 3.2.5 — 日本語G2P修正版

実機で Sprint 3.2.4 はエンジン準備に成功したが、日本語生成時に:
G2P: language "ja" is not initialised.
Available languages: [en, es, fr, pt]
が発生。

原因:
Sprint 3.2.4 で @piper-plus/g2p を 0.4.0 に固定していた。
Piper Plus 0.6.0 の依存仕様は @piper-plus/g2p ^0.4.1。
日本語(OpenJTalk/WASM)を含む依存側を 0.4.1 に戻す。

変更:
- piper-plus: 0.6.0 維持
- @piper-plus/g2p: 0.4.0 → 0.4.1
- ONNX/Safari対策: 成功済み経路を維持
- synthesize(..., { language: 'ja' }) は維持

テスト:
1. GitHubへ上書き
2. SafariでVoice Labを再読み込み
3. 「音声エンジンを準備」
4. 「こんにちは。いい天気ですね。」で「音声を生成」
