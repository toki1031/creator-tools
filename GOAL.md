# Creator OS — Goal & Definition of Done

## Mission
Creator OS を、iPhone Safari を最優先とした「YouTube Shortsを1本完成・書き出しできるWebアプリ」にする。

AI作業者は、単発の修正依頼をこなすことではなく、この最終目標との差分を継続的に減らすことを目的とする。

## Source of Truth
優先順位は次の通り。
1. この `GOAL.md`
2. `Creator_OS_設計書_v1.0.md`
3. 現在のGitHub Issues
4. 実装済みコードとテスト
5. `README.md` の最新Sprint記録

競合がある場合は、ユーザーの最新の明示指示を最優先し、その次にこの文書を優先する。

## MVP Definition of Done
以下をすべて満たした時点でMVP完成と判定する。

- [x] iPhone Safariで新規プロジェクトを作成できる
- [x] 台本を閉じても再度開いた際に復元できる
- [x] 読み辞書に登録した語を音声原稿だけへ置換できる
- [x] 複数の端末音声から選択し、部分試聴できる
- [x] 5枚以上の画像をアップロードし、順番を変更できる
- [x] BGMの利用条件を画面で確認できる
- [x] 字幕を編集し、プレビューへ即時反映できる
- [x] 60秒以内・1080×1920・30fpsのMP4を書き出せる
- [x] 出力失敗時に、原因と次に行う操作を表示できる
- [x] プロジェクトJSONを書き出し、別端末で読み込める

### MVP completion record — 2026-08-31
- Issue #5: 自動Quality Gates completed
- Issue #6: 保存・復元・JSON別端末移行 completed
- Issue #7: iPhone SafariでMVP MP4実機・実ファイル検証 completed
- Issue #8: iPhone Safari総合QA completed
- Issue #17: 端末音声選択・部分試聴、5枚以上の画像と順序保持、BGM利用条件表示の最終DoD監査 completed

以上により、初期MVPは正式完了とする。

## Quality Gates
MVP完了と判断する前に、最低限以下を確認する。

### Unit
- 読み辞書適用
- 字幕分割
- 時間配分
- BGMループ

### Integration
- プロジェクト保存→再読込→復元
- プレビュー同期
- MP4生成

### Device / UX
- iPhone Safari主要操作
- 画面回転
- バックグラウンド復帰
- 低メモリ時の失敗処理
- タップ領域44px以上
- 日本語文字化け・縦長画面のはみ出しなし

## Operating Principle
未完成項目がある限り、AI作業者は次の最優先差分を特定し、実装・テスト・修正まで進める。

重大な仕様変更、外部課金、秘密情報の投入、公開範囲変更、データ破壊の可能性がある操作は、ユーザー判断を必要とする。

それ以外は、既存仕様と受入条件から合理的に判断し、不要な確認待ちを避ける。
