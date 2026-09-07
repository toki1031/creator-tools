# Creator OS

Creator OSは、台本・シーン・画像・字幕・ナレーション・BGM・動画出力を一つの制作フローで扱うブラウザアプリです。iPhone Safariを優先し、YouTube Shortsを中心に制作・保存・MP4書き出しまでを一つの流れで扱います。

## v1.0完成ライン

Creator OS v1.0では、次の主要経路を完成対象とします。

`台本 → シーン分割 → 画像素材 → AI提案 → ナレーション → 字幕 → BGM → 保存/再読込 → MP4出力 → 公開情報`

AI提案は補助機能です。motion・transition・画像選択の提案は、人の判断を置き換えず、自動適用しません。学習・画像特徴量解析は端末内で行い、Datasetや画像を外部へ送信しません。

最終完成判定は `docs/CREATOR_OS_V1_FINAL_QA.md` に従い、自動Quality GatesとiPhone Safari実機QAを組み合わせて行います。

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

テストは読み辞書、字幕分割、シーン時間配分、BGMループ計算、保存・復元、画像素材ライブラリ、動画MVP validation、Dataset、ローカルAI学習・評価などを対象にしています。GitHub Pull Requestでも `Quality Gates` workflowで同じテストとproduction buildを自動実行します。詳細は `docs/QUALITY_GATES.md` を参照してください。

## 実機QA

MediaRecorder / Web Audio / iPhone Safariのメモリや実MP4品質は自動テストだけでは保証しません。細かなPRごとに止めず、v1.0完成候補では主要経路をまとめて実機確認します。
