# v1.1 Production AI Context

Creator OSの次段階のAI提案は、まず実制作プロジェクトを小さな構造化contextへ変換して扱う。

- raw画像/Data URL/WAVはcontextへ入れない
- genre/platform/aspect ratio/Scene数/尺/本文の短い抜粋/素材有無/現在のmotion・transitionだけを使う
- Datasetの人間判断と組み合わせる場合もadvisory-onlyを維持する
- evidence不足では自動適用しない
- 外部API送信は行わない

このcontextは画像・motion・transition・Scene構成の提案精度改善を共通化するための基盤であり、既存のDecisionRecordを置き換えない。
