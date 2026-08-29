# Creator OS MVP 保存・復元 QA

対象: GitHub Issue #6「保存・復元・JSON移行をMVP基準で検証する」

## 自動確認で保証する範囲

- project backup payloadをJSONへ変換し、再解析・正規化・新規project復元まで通る
- 表示台本 / 音声台本
- scene本文 / 尺 / 動画Data URL
- 画像素材ライブラリ / `scene.imageAssetId`
- scene別ナレーション
- 字幕本文 / scene別字幕位置
- BGM本体 / ライセンス情報
- 出力設定
- 投稿準備情報
- AI workspace / Prompt Library
- 読み方辞書
- `finalReview`は復元時に解除
- `schemaVersion = 4`を維持
- `updatedAt`がない旧projectを一覧表示用に安全に並べ替えられる

## Preview / iPhone Safari 手動確認

### A. 自動保存 → 再読込
1. 既存projectを開く。
2. 台本の末尾へテスト文字を追加する。
3. 「保存済み」表示を確認する。
4. Safariを通常の再読み込みにする。
5. 追加した文字が残ることを確認する。

※ Safariの「Webサイトデータを削除」は行わない。IndexedDBのproject自体が消える可能性がある。

### B. 制作データ保持
1. 画像素材を1枚登録する。
2. 別sceneから「素材から選ぶ」で同じ画像を割り当てる。
3. 字幕本文とscene別字幕位置を変更する。
4. scene別ナレーションがあるprojectでは音声が残ることを確認する。
5. BGMを登録済みの場合は設定・音源が残ることを確認する。
6. 一度Studio Hubへ戻り、projectを開き直す。
7. 上記がすべて維持されていることを確認する。

### C. JSON書き出し → 新規復元
1. 「プロジェクトバックアップJSON」を書き出す。
2. Studio Hubから「バックアップから復元」を選ぶ。
3. JSONを指定し、復元前サマリーの件数を確認する。
4. 新しい名前で復元する。
5. 元projectが上書きされず、元projectと復元projectの2件が存在することを確認する。
6. 復元projectで台本、画像、字幕、ナレーション、BGM、投稿情報を確認する。
7. 最終素材チェック済み状態が引き継がれていないことを確認する。

### D. 旧データ互換
旧 `scene.imageData` を持つprojectがある場合:
1. projectを開く。
2. 画像が表示されることを確認する。
3. JSONを書き出して復元する。
4. 復元後も画像が表示されることを確認する。

### E. 別端末移行（MVP最終確認）
1. 端末Aでproject JSONを書き出す。
2. AirDrop / Files / iCloud Drive等で端末Bへ渡す。
3. 端末BのCreator OSで「バックアップから復元」を実行する。
4. 台本、画像、字幕、ナレーション、BGM、投稿情報を確認する。
5. 端末Aのproject IDとは別の新規projectとして保存されることを確認する。

## PASS条件

A〜DがPreviewでPASSし、Eを実端末間で1回PASSしたらIssue #6を完了扱いにできる。
自動テストだけでは「Safari再読込」と「実端末間移行」は完了扱いにしない。
