# Creator OS Sprint 3.2.3 — Piper配布元切り分け診断版

目的:
- Sprint 3.2.2 で STEP 4A が HTTP 502 だったため、Piper Plus本体の「取得失敗」と
  「取得後のES Module解決失敗」を分離して診断する。
- G2P / ONNX Runtime の成功経路は維持する。
- Piper本体は unpkg → jsDelivr → esm.sh の順に取得可否を検査し、
  HTTP status / MIME / 内容サイズを確認する。
- 取得できた配布元だけを import し、STEP 4Bでモジュール解決を診断する。

注意:
この版は「完全ローカル同梱」を装う版ではありません。
物理同梱には npm 配布物と依存WASMを正しく取得・固定する必要があるため、
まず現在の502が特定CDN由来か、Piperパッケージ自体のブラウザ解決由来かを確定します。
