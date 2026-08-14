# Creator OS Sprint 3.4.1 — Kokoro正式Voice Lab統合

Sprint 3.4.0でiPhone Safari実機合格したKokoro日本語TTSをVoice Labの正式経路へ統合。

## 今回完成
- Kokoro日本語TTSをVoice Labへ統合
- 女性4声 / 男性1声
- 日本語台本→生成→試聴→WAV保存
- 「動画用ナレーションに登録」
- 登録音声をIndexedDB `creator-os-audio / narrations` にprojectId単位で保存
- Piper Plus旧経路をVoice Labから撤去

## テスト
1. 全ファイルをGitHubへ上書き
2. `voice-lab?project=...` を開く
3. 音声エンジンを準備
4. 音声を生成
5. 再生確認
6. 「この音声を動画用ナレーションに登録」
7. 「登録完了 ✓」を確認

## 次
Sprint 3.4.2: videoRenderer.js が登録済みWAVを読み込み、動画音声トラックへ合成。
