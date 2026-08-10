# Creator OS Sprint 3.1.1 BGM安全修正版

Sprint 3.1を基準に、BGM不具合の実データ診断を反映した最小修正版です。

変更点：
- BGM登録時にMOV / MP4などの動画ファイルを拒否
- MP3 / M4A / AAC / WAVを案内
- 既存プロジェクトにvideo/*のBGMがある場合、素材チェックで警告
- 動画生成直前にも動画BGMを検出して停止
- 不正BGMをdecodeAudioData()へ渡さない

今回の目的は、まず純粋な音声ファイルでBGM入りMP4が安定生成できるかを確認することです。
動画から音声だけを取り出してBGM化する機能は、このテスト成功後の次段階で追加します。

## Sprint 3.1.3 ナレーション合成基盤
- 台本・音声画面に「動画用ナレーション」音声ファイル登録を追加
- MP3 / M4A / AAC / WAV をナレーションとして保存・試聴
- MOV / MP4など動画ファイルはナレーション登録時に拒否
- 出力前素材チェックにナレーション状態を追加
- Web AudioでナレーションとBGMを同一MediaStreamへ合成
- ナレーション再生中はBGMダッキング（既存ducking設定が有効な場合）
- 既存のSpeechSynthesis試聴・読み方辞書は維持
- 将来の無料Voice Libraryは narration.audioData へ生成音声を渡す形で接続できる設計
