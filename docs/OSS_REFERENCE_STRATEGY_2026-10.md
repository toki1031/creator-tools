# Creator OS｜参考OSS採用方針（2026-10）

## 目的
Creator OSをすべて自作せず、既存OSSの良い設計・実装を安全に参考にして開発速度と品質を上げる。

この資料は「何を参考にするか」「何を直接取り込まないか」を明確にし、今後の実装判断を揃えるためのもの。

## 基本ルール
- Creator OS本体の目的・iPhone Safari優先・無料/低コスト方針を優先する。
- OSSだからといって丸ごと置換しない。
- MIT等の許容ライセンスでも、直接コードを使う場合は著作権表示・ライセンス条件を守る。
- GPL系は原則としてコードをコピーせず、設計思想・UX・責務分割だけ参考にする。
- 大規模なレンダラー置換や新WASM導入は、実機QA前に行わない。
- 「既存機能を壊さず段階導入」を優先する。

---

## 1. MoneyPrinterTurbo
Repository: harry0703/MoneyPrinterTurbo  
License: MIT

### Creator OSと近い点
- テーマから台本・素材・音声・字幕・BGM・動画まで一連で生成する。
- タスク単位で制作を管理する。
- 完成動画を明示的な成果物として扱う。
- 複数の素材/音声/AIサービスを差し替え可能な構成。

### 採用
**採用済み：成果物の責務**

Creator OSでは、完成動画をページ内の一時Blobだけにせず、Media Storeへ「最新完成動画」として保持する設計を採用した。

### 今後参考にする
- 途中失敗時の再開単位
- タスク履歴
- provider差し替え構造

### 取り込まない
- PC/サーバー前提のファイルパス保存方式
- 有料APIを前提とした構成

理由：Creator OSはiPhone Safariとローカル保存を優先するため。

---

## 2. OpenReel Video
Repository: Augani/openreel-video  
License: MIT

### Creator OSと近い点
- ブラウザ内で動画編集・プレビュー・書き出し。
- ローカル処理を中心にする。
- タイムライン、字幕、音声、ducking、undo/redo、autosaveを持つ。
- core / ui / agent を分離している。
- AI Editor / MCP連携を持つ。

### 優先して参考にする
**A. 自動制作後の「最後の10%だけ直す」UI**
- Scene順序
- 字幕
- 音量
- 画像差し替え
- タイミング
を1画面で確認しやすくする。

**B. crash recovery / autosave**
現状Creator OSにも自動保存はあるが、「直前の安全な状態」へ戻れる復旧設計は強化余地がある。

**C. core / ui / agent分離**
AIから操作する機能をmain.jsへ追加し続けず、編集操作のpure command層を作る際の参考にする。

### 今は取り込まない
- WebCodecs / WebGPU / FFmpeg.wasm中心へのレンダラー全面移行
- 高度なカラー補正、マスク、クロマキー
- デスクトップ向け高負荷機能

理由：iPhone Safariのメモリ/対応差を増やすため。

---

## 3. Revideo
Repository: midrender/revideo  
License: MIT

### Creator OSと近い点
- Scene定義からブラウザpreviewと最終renderを作る。
- 音声・映像を時間軸で同期する。
- previewとfinal renderが同じproject/scene定義を共有する。

### 優先して参考にする
**「1つのRender Planをpreviewとexportで共有する」思想**

Creator OSはすでに drawProjectFrame をpreview/exportで共有しているため、丸ごとRevideoへ置換する必要はない。

今後は以下をpure dataとして明確化する方向を参考にする。
- Scene開始/終了時刻
- 使用画像
- motion
- transition
- subtitle timing/style
- narration timing
- BGM timing

これを「Render Plan」として一度確定し、preview/exportの両方が同じPlanを読む構造へ寄せる。

### 今は取り込まない
- Node/headless browserレンダラー
- cloud/serverless render
- Revideo本体への依存

理由：Creator OSのローカル・ブラウザ優先方針と異なるため。

---

## 4. SynthCut
Repository: Relo-video/SynthCut  
License: GPL-3.0-or-later

### Creator OSと近い点
- AIが動画編集ソフトを操作することを前提にしている。
- 編集操作をMCP toolとして外部AIへ公開する。
- inspect → plan → edit → verify → export の流れ。
- 長時間処理をjob化し、進捗・取消・復旧を扱う。

### 優先して参考にする
**「AIが押すボタンを増やす」のではなく「編集操作をToolとして定義する」設計**

Creator OS独自のcommand例：
- set_scene_image
- change_scene_duration
- set_subtitle_text
- set_subtitle_position
- set_bgm
- regenerate_narration
- validate_production
- render_video

UI操作とAI操作が同じcommand関数を使う構造を目標にする。

### コードは直接取り込まない
GPL-3.0-or-laterのため、Creator OSへコードをコピー・移植する場合はライセンス影響が大きい。

**設計思想のみ参考にする。**

---

## 5. whisper.cpp
Repository: ggml-org/whisper.cpp  
License: MIT

### 参考にできる点
- ローカル音声認識。
- iOS対応。
- WebAssembly対応。
- 実音声からタイムスタンプを取得できる。

### 現時点の判断
**Creator OS本体には今すぐ入れない。**

理由：
- browser WASM exampleではtinyモデルでも約74MBのモデルデータが必要。
- whisper.cpp本体の目安ではtinyでもメモリ使用量が約273MB。
- Creator OSは既にiPhone Safariのメモリ制約と戦っている。
- Creator OSでは読み上げる文章自体を既に知っているため、字幕同期だけのためにASRを再実行するのはコストが大きい。

### 将来候補
- PC/デスクトップ版
- ユーザーが外部動画/音声を読み込む機能
- ナレーション原稿が不明な素材の字幕起こし

---

## 採用優先度

### P0：現在の完成優先
1. iPhone production-request最終通しQA
2. Media Storage Separation残件
3. 既存の保存・復元・レンダリングを安定化

### P1：OpenReelから参考
**自動制作後の最終確認/微修正画面**
- Sceneを一覧で確認
- 画像・字幕・音量・尺を少ない操作で修正
- Undo/Redoを維持
- 自動保存と復旧を強化

### P2：SynthCutから参考
**Creator OS独自の編集Command層**
- UIとAIが同じ編集commandを呼ぶ
- commandはpureに近くし、自動テスト可能にする
- GPLコードは使わない

### P3：Revideoから参考
**Render Planの明示化**
- preview/exportの入力を完全に共通化
- previewと完成動画の差を減らす

### 保留
- whisper.cpp：iPhone本体への常設導入
- OpenReel rendererへの置換
- Revideo rendererへの置換
- SynthCutコード直接利用
- ffmpeg.wasm全面採用

---

## 次の判断
今は新しい大型機能を追加するより、まずproduction-requestの最終iPhone QAをPASSさせる。

QA完了後の最初の新機能候補は、
**「自動制作後の最終確認・微修正画面」**
とする。

その実装時はOpenReelのtimeline/autosave/undo-redo構成を詳しく調べ、Creator OSではiPhone向けに必要最小限へ縮小して実装する。
