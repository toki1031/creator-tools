# Creator OS Sprint 3.2.8 — OpenJTalk辞書 端末ローカル版

## 直前の実機結果
Sprint 3.2.7で `loadJaDict()` が以下へfetchして失敗:
`https://github.com/ayutaz/piper-plus/releases/download/dict-v1.0.0/open_jtalk_dic_utf_8-1.11.tar.gz`

Piper Plus公式のiOS統合ガイドでは、日本語辞書として
`r9y9/open_jtalk v1.11.1` の `open_jtalk_dic_utf_8-1.11.tar.gz`
を取得し、アプリ側へバンドルする方式を案内している。

## Sprint 3.2.8
ブラウザ版でも同じ思想に変更。

1. Voice Labの「OpenJTalk辞書を取得」からtar.gzを一度だけ取得
2. ファイル選択でCreator OSへ登録
3. IndexedDBへBlobとして永続保存
4. `DictLoader.loadJaDict()` が辞書URLを要求した瞬間だけ、IndexedDBのBlobをResponseとして返す
5. 以後はGitHub Releasesへfetchしない

Piper / ONNX / G2Pの成功済み経路は維持。

## テスト
- GitHubへ上書き
- Voice Labを開く
- 初回のみ辞書を取得・選択・端末へ保存
- 「音声エンジンを準備」
- 「こんにちは。今日はいい天気ですね。本田宗一郎。」で生成
