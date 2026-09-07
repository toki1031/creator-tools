# Scene Motion Training Data v0.38

Phase Cの最初の分類学習対象として、`scene-motion` DecisionRecordをcompactな教師データへ変換する。

- label: `none`, `zoom-in`, `zoom-out`, `pan-left`, `pan-right`
- invalid record / unknown label / blocked URLは除外
- contextはsceneText, sceneIndex, durationSec, platform, aspectRatioのみ
- 入力DecisionRecordは変更しない
- UI / DB / schema / renderer / networkは変更しない
