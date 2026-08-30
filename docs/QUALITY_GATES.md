# Creator OS Quality Gates

Creator OSの主要ロジック変更では、PRをマージする前に以下をすべて成功させます。

## ローカル実行

```bash
npm install
npm test
npm run build
```

`npm test` は `node --test tests/*.test.mjs` を実行します。

## 現在の回帰テスト範囲

- JSONバックアップ／復元・schema正規化・読み辞書マージ
- 読み辞書による実際の本文置換（長い語を優先）
- 字幕位置計算
- 字幕カード／字幕フレーズ分割（1回改行と空行の意味）
- 台本からのシーン分割と時間配分
- BGMループ回数計算
- 画像素材ライブラリ
- IndexedDB一覧の安全な並び替え
- 動画プロジェクトvalidation・MVP Shorts条件
- 動画生成開始時のAudioContext順序とキャンセル

## CI

GitHub Actionsの `Quality Gates` をmainへのpushとPull Requestで実行します。Node.js 22で `npm install` → `npm test` → `npm run build` を実行し、失敗した場合は原因を確認してからマージします。

## 実機QAとの役割分担

自動テストは純粋ロジックやデータ変換の回帰検知を担当します。iPhone SafariのMediaRecorder、Web Audio、メモリ挙動、実MP4の再生・保存は実機QAで確認します。
