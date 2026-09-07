# Scene Motion AI Suggestion UI v0.41

Creator OSのシーン編集画面で、蓄積済み`scene-motion` DecisionRecordからブラウザ内学習したv0.39モデルの提案を補助表示する。

- 5件未満、またはlabelが1種類のみの場合は `AI提案：学習中（n件）`
- 十分なデータがある場合は `AI提案：ズームイン` 等を表示
- 現在設定と予測が一致する場合は一致表示
- AIは`動き`の値を自動変更しない
- 採否は既存selectを操作するユーザーが決める
- 既存の保存・`scene-motion` DecisionRecord記録は変更しない
- 外部API・外部送信・追加費用なし

UI変更のため、Quality GatesとCloudflare Preview成功後にiPhone Safari実機QAを行ってからmergeする。
