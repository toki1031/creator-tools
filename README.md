# Creator OS Sprint 3.3.1 — 公式WASMデモ差分切り分け版

## 方針
これまでのCreator OS側は、
- piper-plus npm版の存在しない/不一致バージョン
- OpenJTalk辞書22.6MB
- JapaneseG2P / openjtalkModule 手動接続
を追っていた。

しかし公式の現行WebAssemblyデモは:
- 完全ブラウザ内
- 日本語: Rust WASM jpreprocess
- built-in dictionary
- ONNX Runtime Web
で動作している。

## このSprintの目的
同じiPhone Safariで公式デモを動かし、
「Safari自体が非対応」なのか
「Creator OS側の実装が公式構成とズレている」のか
を確定する。

Voice Labに:
- 公式WebAssemblyデモを開く
- 「音声が出た」
- 「公式デモでも失敗した」
を追加。

## 次
公式デモで成功した場合:
Creator OSの旧OpenJTalk手動経路を廃止し、
jpreprocess WASM + built-in dictionary の公式構成へ移植する。
