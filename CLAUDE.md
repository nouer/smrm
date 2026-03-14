# SMRM - シンプルカルテ管理

個人サロン・治療院（マッサージ・整体・鍼灸・エステ等）向けのブラウザ完結型カルテ管理アプリケーション。

## プロジェクト構成

```
smrm/
├── local_app/              # メインアプリケーション (SPA)
│   ├── index.html          # メインHTML
│   ├── script.js           # UI・DB操作 (~2500行)
│   ├── smrm.calc.js        # 純粋計算関数
│   ├── style.css           # レスポンシブCSS
│   ├── sw.js               # Service Worker (オフライン対応)
│   ├── version.js          # バージョン情報（自動生成）
│   ├── manifest.json       # PWA マニフェスト
│   ├── icons/              # PWAアイコン (6ファイル)
│   ├── docs-images/        # ドキュメント用画像
│   ├── smrm.calc.test.js   # ユニットテスト (Jest)
│   ├── e2e.test.js         # E2Eテスト (Puppeteer)
│   ├── sample_data.json    # サンプルデータ
│   ├── notify.html         # お知らせ通知ページ
│   ├── manual.html         # マニュアルHTML
│   └── promotion.html      # プロモーションHTML
├── docs/                   # ドキュメント (要件定義・設計・テスト仕様・マニュアル)
├── scripts/                # ビルド・ユーティリティスクリプト
├── tools/                  # 開発ツール (サンプルデータ生成・スクリーンショット)
├── nginx/                  # Nginx設定
├── tasks/                  # タスク管理 (todo.md, lessons.md)
├── Dockerfile              # アプリ用コンテナ
├── Dockerfile.test         # テスト用コンテナ
├── docker-compose.yml      # 3サービス: app, app-public, test
└── package.json            # Jest + Puppeteer (devDeps only)
```

## 開発コマンド

```bash
# Docker ビルド＆起動（ポート 8086）
bash scripts/build.sh

# 強制リビルド
bash scripts/rebuild.sh

# ユニットテスト（smrm.calc.test.js のみ）
npx jest --selectProjects unit

# 全テスト（ユニット + E2E）
npm test

# E2Eテスト（Docker内で実行）
docker compose run --rm smrm-test

# ドキュメント生成
bash scripts/build-docs.sh        # マニュアル・プロモーションHTML生成
python3 scripts/md-to-pdf.py      # Markdown→PDF変換
python3 scripts/md-to-html.py     # Markdown→HTML変換
bash scripts/generate_version.sh  # バージョン情報生成（version.js）
```

## コーディング規約

- `smrm.calc.js` には純粋関数のみ（DOM操作・IndexedDB操作禁止）
- `script.js` にUI操作・DB操作を集約
- 外部ライブラリ追加禁止（vanilla JSのみ）
- HTML特殊文字は必ず `escapeHtml()` でエスケープ

## コミットメッセージ規約

- 日本語で記述（プレフィックスは英語: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:`）
- 変更内容を具体的に箇条書きで記述
- 大きな変更は複数コミットに分割

## 環境変数

| 変数 | デフォルト | 用途 |
|------|-----------|------|
| `SMRM_PORT` | `8086` | ブラウザアクセス用ポート |
| `SMRM_APP_IP` | `172.32.0.10` | Docker内部ネットワークIP |
| `E2E_APP_IP` | `172.32.0.10` | E2Eテスト接続先IP |
