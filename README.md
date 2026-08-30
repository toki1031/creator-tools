# Creator OS

Creator OSは、台本・シーン・画像・字幕・ナレーション・BGM・動画出力を一つの制作フローで扱うブラウザアプリです。現行MVPではiPhone Safariを優先し、YouTube Shortsの制作・保存・MP4書き出しを検証しています。

## 開発

```bash
npm install
npm run dev
```

## Quality Gate

主要ロジックを変更した場合は、マージ前に次を実行します。

```bash
npm test
npm run build
```

テストは読み辞書、字幕分割、シーン時間配分、BGMループ計算、保存・復元、画像素材ライブラリ、動画MVP validationなどを対象にしています。GitHub Pull Requestでも `Quality Gates` workflowで同じテストとproduction buildを自動実行します。詳細は `docs/QUALITY_GATES.md` を参照してください。

## 実機QA

MediaRecorder / Web Audio / iPhone Safariのメモリや実MP4品質は自動テストだけでは保証しません。実機QAと生成ファイル解析を併用します。
