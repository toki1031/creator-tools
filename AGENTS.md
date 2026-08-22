# AGENTS.md — Creator OS Autonomous Development Rules

## Primary Objective
`GOAL.md` の Definition of Done を満たすまで、Creator OS の未完成差分を減らす。

## Start-of-Task Routine
作業開始時に必ず次を行う。

1. `GOAL.md` を読む
2. `Creator_OS_設計書_v1.0.md` を読む
3. open Issues を確認する
4. 関連コードと既存テストを確認する
5. 現在の最優先未完成項目を1つ選ぶ
6. 受入条件を明文化してから実装する

## Priority Order
1. データ消失・壊れる操作・回帰バグ
2. MVP Definition of Done を阻害する問題
3. iPhone Safariで主要フローを阻害する問題
4. 出力・保存・同期の信頼性
5. UX改善
6. 将来機能

## Work Loop
各Issueまたは作業単位で以下を繰り返す。

1. 現象または不足を再現・確認する
2. 原因を特定する
3. 最小で安全な変更を実装する
4. 既存挙動を壊していないか確認する
5. テストを実行する
6. 失敗した場合は原因を調べて修正する
7. 受入条件を再確認する
8. 完了したら結果・検証方法・残課題を記録する
9. 次の最優先Issueへ進む

## Issue Rules
Issueは単なるメモではなく、AI作業者間の共有状態として扱う。

各Issueには可能な限り以下を含める。
- Problem
- Why it matters
- Acceptance criteria
- Relevant files / area
- Test plan
- Done record

新しい問題を発見した場合、現在作業の範囲外ならIssue化する。
重複Issueは増やさない。

## Code Change Rules
- 既存の動作を理解せず大規模リファクタリングしない
- 1回の変更範囲を小さく保つ
- データ形式変更時は後方互換・移行を考慮する
- ユーザーデータを暗黙に削除しない
- APIキーや秘密情報をクライアントへ埋め込まない
- 著作権・ライセンス不明素材を組み込まない
- iPhone Safariを最優先端末として扱う

## Testing Rules
可能な限り変更前に再現方法を作り、変更後に同じ手順で確認する。

最低限、変更に関係する以下を確認する。
- 正常系
- 空データ
- 再読込・復元
- 既存プロジェクトとの互換性
- iPhone相当の狭い画面

自動テストが存在しない重要ロジックには、追加可能なら回帰テストを加える。

## Completion Rules
「コードを書いた」だけでは完了ではない。

完了条件：
- 受入条件を満たす
- 関連テストが通る、または手動検証結果が記録される
- 新しい重大な回帰を確認していない
- 必要なIssue/README/進捗記録が更新される

## When Human Approval Is Required
次の場合だけユーザーへ判断を求める。
- 製品の目的を変える重大な仕様判断
- 有料API・課金の開始または増額
- 外部サービスへの秘密情報登録
- 公開/非公開や本番公開範囲の変更
- ユーザーデータを失う可能性のある操作
- 複数案に明確な優劣がなく、後戻りコストが大きい判断

それ以外は `GOAL.md` と設計書から合理的に判断して進める。

## End-of-Task Report
作業終了時は簡潔に以下を残す。
- What changed
- Why
- Tests / verification
- Remaining risks
- Next highest-priority task
