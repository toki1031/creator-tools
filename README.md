# Creator OS — Sprint 0

Creator Tools v2を、拡張可能なVite + TypeScript構成へ移行した開発基盤です。

## 実装済み

- ハッシュルーティング
- プロジェクト新規作成・一覧・編集・削除
- IndexedDBへの自動保存
- 表示用原稿と音声用原稿の分離
- JSONエクスポート
- iPhone Safariを想定したレスポンシブUI
- 旧v2を `legacy/v2/` に保存

## ローカル起動

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

Cloudflare Pages:
- Build command: `npm run build`
- Build output directory: `dist`

## 次のSprint

Sprint 1では、読み方辞書・部分試聴・自然な語り口変換・既存Web Speech API機能の移植を行います。
