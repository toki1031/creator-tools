# Creator OS Sprint 3.5.0 — シーン別ナレーション＆字幕同期

## 新機能
Voice Labに「全シーンの音声を生成して同期」を追加。

処理:
1. Creator OSのシーンを読み込む
2. 各シーンの speechText / subtitleText / text をKokoroで順番に音声化
3. 各WAVの実時間をWeb Audioで測定
4. scene.narration.audioData にシーン別WAVを保存
5. scene.durationSec を「音声実尺 + 0.15秒」に自動設定
6. subtitleStartSec=0 / subtitleEndSec=scene.durationSec に同期
7. 動画レンダラーが各シーン開始時刻に対応WAVを自動再生
8. ナレーション中だけBGMダッキング

## 重要
従来の「全文1本ナレーション」もフォールバックとして維持。
シーン別音声が存在する場合はシーン別音声を優先。

## 実機テスト
- 2シーン以上を用意
- Voice Lab → 音声エンジン準備
- 「全シーンの音声を生成して同期」
- Creator OS → 2.シーン で各カードに「✓ シーン音声 X.XX秒」
- 4.出力 → 「✓ ナレーション：シーン別 N/N件」
- 動画生成
- シーン切替・字幕切替・ナレーション開始が同時になることを確認
