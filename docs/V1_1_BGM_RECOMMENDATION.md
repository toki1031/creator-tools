# v1.1 BGM Recommendation

端末内BGM Libraryの登録曲だけを候補にし、動画のgenre/mood/用途/尺と、曲に保存されたmetadataを照合して上位候補を返す。

- 外部AI/APIなし
- 音源の再配布なし
- 商用利用可否、ライセンス、配布元情報がある曲を優先可能
- 自動適用しない
- Datasetが増えたら人の採用履歴を追加特徴として学習する余地を残す
