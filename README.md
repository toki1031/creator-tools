# Creator OS Sprint 3.2.6 — 日本語G2P明示初期化修正版

## 実機で確認されたエラー
G2P: language "ja" is not initialised.
Available languages: [en, es, fr, pt].
Pass the language in G2P.create({ languages: [...] }) to enable it.

## 根本修正
@piper-plus/g2p の日本語利用手順に合わせて:

1. `DictLoader` を生成
2. `await loader.loadJaDict()` で日本語OpenJTalk辞書を準備
3. `G2P.create()` をラップ
4. Piper Plus内部からG2P.create()が呼ばれた場合でも
   `languages` に必ず `ja` を追加
5. `jaDict` を必ず渡す
6. Piper初期化前に「こんにちは」で日本語G2Pのスモークテスト

既存の英語・スペイン語・フランス語・ポルトガル語などの languages は削除せず維持する。

## テスト
- Voice LabをSafariで再読み込み
- 「音声エンジンを準備」
- STEP 1C 日本語G2P準備成功を確認
- 「こんにちは。いい天気ですね。」で「音声を生成」
