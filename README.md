# Creator OS Sprint 3.2.9 — OpenJTalk WASM接続診断版

## 直前の実機結果
Sprint 3.2.8:
- OpenJTalk辞書 22.6MB の端末保存成功
- IndexedDBからの辞書利用経路は構築済み
- 日本語G2P初期化時に:
  `openjtalkModule is required`

## 今回の修正
日本語G2Pへ必要なOpenJTalk WASMモジュールを明示的に初期化し、
`G2P.create({... openjtalkModule })` へ必ず渡す。

診断:
- STEP 1B2 OpenJTalk WASM初期化
- 成功後、日本語辞書と組み合わせてG2Pスモークテスト
- export形状が違う場合は、実際の公開export一覧をエラーに表示

既存の:
- Piper Plus 0.6.0
- ONNX Runtime Safari対策
- G2P 0.4.1
- IndexedDB辞書保存
は維持。
