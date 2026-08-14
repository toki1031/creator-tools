# Creator OS Sprint 3.4.2 — Kokoroナレーション動画接続版

## 実コード確認結果
現行 `videoRenderer.js` には既に以下が実装済み:
- `project.narration.audioData` の取得
- ArrayBuffer化
- Web Audio `decodeAudioData`
- ナレーションGain
- BGMとのミックス
- ナレーション中のBGMダッキング
- MediaRecorder音声トラックへの追加
- MP4生成

したがって動画レンダラーの大改造は不要。

## Sprint 3.4.2の修正
Voice Labの「この音声を動画用ナレーションに登録」で、
Kokoro生成WAVを以下へ正式保存する。

`creator-os` IndexedDB
→ projects
→ 対象project
→ `project.narration.audioData`

同時に:
- fileName: `Kokoro_<voice>.wav`
- mimeType: `audio/wav`
- source: `kokoro-js-jp`
- voiceId
- speechScript

も保存。

従来の `creator-os-audio / narrations` へのBlob保存も再利用・診断用として維持。

## 実機テスト
1. Voice LabでKokoro音声を生成
2. 「この音声を動画用ナレーションに登録」
3. 「project.narration.audioData 保存済み」を確認
4. Creator OSへ戻る
5. 出力画面の素材チェックで `✓ ナレーション：Kokoro_...wav`
6. BGM ONのまま10秒動画を生成
7. 動画でナレーションとBGM両方が聞こえるか確認

成功したら、ナレーション生成→登録→動画合成の基本経路は完成。
