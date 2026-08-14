# Creator OS Sprint 3.3.2 — Build / Cache 診断版

目的:
- 古いSprintの一部残存やSafariキャッシュ混在を切り分ける。
- diagnostics.html で現在配信中のBuild ID、主要ファイル、Service Worker、Cache Storageを確認する。

手順:
1. ZIPの中身をGitHubへ全部上書き
2. Cloudflare Pagesデプロイ完了後 `/diagnostics.html` を開く
3. `Creator OS Sprint 3.3.2` を確認
4. 古いCache Storage / Service Workerが残っていれば削除
5. Voice Labへ進む
