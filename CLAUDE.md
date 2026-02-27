# SMRM - シンプルカルテ管理

個人サロン・治療院（マッサージ・整体・鍼灸・エステ等）向けのブラウザ完結型カルテ管理アプリケーション。

## アーキテクチャ

- **フロントエンド**: HTML + vanilla JS（フレームワークなし）
- **データストア**: IndexedDB（ブラウザ内、サーバー不要）
- **PWA**: Service Worker によるオフライン対応
- **外部ライブラリ**: なし
- **デプロイ**: Docker + nginx

## ファイル構成

```
smrm/
├── local_app/
│   ├── index.html          # SPA エントリポイント
│   ├── script.js           # メインロジック（DB操作・UI・イベント処理）
│   ├── smrm.calc.js        # 計算・バリデーション（純粋関数、DOM依存なし）
│   ├── smrm.calc.test.js   # ユニットテスト（Jest）
│   ├── e2e.test.js         # E2Eテスト（Puppeteer）
│   ├── style.css           # スタイル
│   ├── version.js          # ビルド時自動生成（バージョン・ビルド日時）
│   ├── sw.js               # Service Worker
│   ├── manifest.json       # PWAマニフェスト
│   └── icons/              # アプリアイコン
├── scripts/
│   ├── build.sh            # Docker ビルド＆起動
│   ├── rebuild.sh          # 強制リビルド＆起動
│   └── generate_version.sh # version.js 生成
├── tools/
│   └── generate_sample_data.js  # サンプルデータ生成
├── nginx/default.conf
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.test
└── package.json
```

## IndexedDB スキーマ (`smrm_db`, version 1)

| Store | keyPath | 用途 |
|-------|---------|------|
| `customers` | `id` | 顧客情報 |
| `treatment_records` | `id` | 施術記録 |
| `media` | `id` | 写真 |
| `app_settings` | `id` | 設定 |

## UIタブ構成

| # | タブID | 内容 |
|---|--------|------|
| 1 | customers | 顧客検索・一覧・新規登録 |
| 2 | treatment | 施術記録（主訴/所見/施術内容/施術後メモ + 体調レベル + 写真） |
| 3 | history | 訪問履歴タイムライン |
| 4 | settings | エクスポート/インポート・表示設定・アプリ情報 |

## 開発コマンド

```bash
# Docker ビルド＆起動（ポート 8085）
bash scripts/build.sh

# 強制リビルド
bash scripts/rebuild.sh

# ユニットテスト
npm test

# E2Eテスト（Docker内で実行）
docker compose run --rm smrm-test
```

## コーディング規約

- `smrm.calc.js` には純粋関数のみ（DOM操作・IndexedDB操作禁止）
- `script.js` にUI操作・DB操作を集約
- 外部ライブラリ追加禁止（vanilla JSのみ）
- HTML特殊文字は必ず `escapeHtml()` でエスケープ

## Commit Message Guidelines

- コミットメッセージは常に日本語で記述
- プレフィックス: `feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `perf:` / `test:` / `chore:`
- 箇条書き（- ）で変更点をリストアップ
