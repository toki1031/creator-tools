# Creator OS v1.5 Media Storage Separation

## 目的
project JSONに直接埋め込まれている画像・音声Data URLを段階的に外部化し、保存・読込・動画生成時のメモリ負荷を下げる。

## 現状の埋め込み箇所
- `mediaLibrary[].data`: 画像Data URL
- `scene.imageData`: 旧Scene画像Data URL
- `scene.narration.audioData`: Scene別ナレーションData URL
- `bgm.audioData`: BGM Data URL
- `narration.audioData`: 旧全文ナレーションData URL

## 安全方針
1. 旧Data URLは移行成功確認前に削除しない。
2. `DB_VERSION` / `schemaVersion` をP1/P2初期段階では変更しない。
3. 既存projectを一括変換しない。
4. 新形式はMediaRefを持ち、旧Data URLとのdual-readを維持する。
5. 保存失敗時は既存projectを壊さない。
6. v1.4 Render Job / 独立生成ページを維持する。

## MediaRef v1
project側に保持する参照情報は次の最小項目とする。
- `version`
- `id`
- `kind`
- `mimeType`
- `bytes`
- `fileName`

MediaRef自体にはBlob/Data URLを含めない。

## P2a: ローカルメディアストア基盤
`mediaStore.js` にOPFSベースの保存APIを追加した。

- `saveMediaBlob()`
- `readMediaBlob()`
- `mediaBlobExists()`
- `deleteMediaBlob()`
- `supportsLocalMediaStore()`

保存先はブラウザ内の `creator-os-media-v1/<projectId>/`。外部APIやクラウドへ素材を送らない。

この段階では既存UIや既存projectの保存方式はまだ変更しない。まずBlob保存・再読込・削除を単体テストで確認し、その後に新規Scene画像アップロードのみを最初の実利用箇所として接続する。

## 次の統合順
1. 新規Scene画像アップロード
2. Scene別ナレーション
3. BGM
4. 既存projectのlazy migration
5. 素材込みバックアップ/復元

旧projectはすべてdual-readで維持する。