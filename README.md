# Creator OS Sprint 3.2.2 VoiceLab G2P経路固定診断版

目的: Sprint 3.2.1で発生した `text/html is not a valid JavaScript MIME type` を切り分ける。

変更点:
- G2Pの仮想vendor URLを廃止。
- Sprint 3.1.7でiPhone Safari実機上の読み込み成功を確認した `@piper-plus/g2p@0.4.1/src/index.js` の直接ES Module経路へ固定。
- import前にHTTP status / Content-Typeを検証し、HTML応答ならimport前に停止。
- ONNX Runtimeの成功経路は維持。
- Piper Plus本体の同一オリジン診断は継続。

テスト: GitHubへ全ファイルを上書きし、Voice Lab → 音声エンジンを準備。
