# 基本設計書 — シンプルカルテ管理 (smrm)

## 1. アーキテクチャ概要

smrm はブラウザ完結型のSPA（Single Page Application）として設計されている。

```
┌──────────────────────────────────────┐
│            ブラウザ (Client)          │
│                                      │
│  ┌────────────────────────────────┐  │
│  │         index.html (SPA)       │  │
│  │  ┌──────────┐ ┌─────────────┐ │  │
│  │  │script.js │ │smrm.calc.js │ │  │
│  │  │(UI+DB)   │ │(純粋関数)    │ │  │
│  │  └──────────┘ └─────────────┘ │  │
│  └────────────────────────────────┘  │
│            ↕                         │
│  ┌────────────────────────────────┐  │
│  │         IndexedDB (smrm_db)    │  │
│  │  customers | treatment_records │  │
│  │  media     | app_settings      │  │
│  └────────────────────────────────┘  │
│            ↕                         │
│  ┌────────────────────────────────┐  │
│  │    Service Worker (sw.js)      │  │
│  │    キャッシュ + オフライン対応  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
            ↕ HTTP (初回のみ)
┌──────────────────────────────────────┐
│     nginx (静的ファイル配信)          │
│     Docker コンテナ                   │
└──────────────────────────────────────┘
```

### 設計方針

- **外部ライブラリ不使用**: vanilla JavaScript のみで実装
- **サーバーレス**: データ処理はすべてクライアント側で完結
- **2ファイル分離**: UI/DB操作（`script.js`）と純粋関数（`smrm.calc.js`）を分離

---

## 2. ディレクトリ構成

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
├── docs/                   # ドキュメント
├── nginx/default.conf      # nginx 設定
├── docker-compose.yml      # Docker Compose 構成
├── Dockerfile              # アプリ用 Dockerfile
├── Dockerfile.test         # テスト用 Dockerfile
├── package.json            # npm 設定
└── CLAUDE.md               # プロジェクト規約
```

---

## 3. データモデル

### 3.1 IndexedDB 構成

- **データベース名**: `smrm_db`
- **バージョン**: 1

| オブジェクトストア | keyPath | インデックス | 用途 |
|-------------------|---------|-------------|------|
| `customers` | `id` | name, nameKana, customerCode | 顧客情報 |
| `treatment_records` | `id` | customerId, visitedAt | 施術記録 |
| `media` | `id` | parentId, parentType | 写真データ |
| `app_settings` | `id` | (なし) | アプリ設定 |

### 3.2 レコード構造

#### customers

```json
{
  "id": "uuid",
  "customerCode": "C0001",
  "name": "山田 花子",
  "nameKana": "やまだ はなこ",
  "birthDate": "1985-04-15",
  "gender": "female",
  "phone": "090-1234-5678",
  "email": "hanako@example.com",
  "address": "東京都渋谷区...",
  "occupation": "会社員",
  "referralSource": "ホットペッパー",
  "visitMotivation": "肩こり",
  "firstVisitDate": "2024-01-15",
  "practitioner": "田中",
  "memo": "強い圧が苦手",
  "allergies": [
    { "allergen": "スギ花粉", "severity": "mild", "note": "季節性鼻炎" }
  ],
  "medicalHistory": [
    { "condition": "高血圧症", "note": "内服加療中" }
  ],
  "createdAt": "2024-01-15T09:00:00.000Z",
  "updatedAt": "2024-06-01T10:30:00.000Z"
}
```

#### treatment_records

```json
{
  "id": "uuid",
  "customerId": "uuid (customers.id)",
  "visitedAt": "2024-06-01T10:00:00.000Z",
  "chiefComplaint": "肩こりがひどく、首まで張っている",
  "bodyFindings": "僧帽筋上部の硬結著明",
  "treatmentContent": "僧帽筋・肩甲挙筋を中心に指圧・揉捏",
  "afterNotes": "施術後、肩の可動域改善。次回2週間後。",
  "treatmentMenuId": "uuid",
  "treatmentMenu": "全身もみほぐし 60分",
  "duration": 60,
  "bodyCondition": {
    "painLevel": 5,
    "stiffnessLevel": 7,
    "fatigueLevel": 3,
    "areas": ["首", "右肩", "左肩"],
    "notes": "右側に偏った痛み"
  },
  "createdAt": "2024-06-01T10:00:00.000Z",
  "updatedAt": "2024-06-01T11:00:00.000Z"
}
```

#### media

```json
{
  "id": "uuid",
  "parentId": "uuid (customers.id または treatment_records.id)",
  "parentType": "customer | treatment_record",
  "fileName": "photo_001.jpg",
  "mimeType": "image/jpeg",
  "dataUrl": "data:image/jpeg;base64,...",
  "thumbnail": "data:image/jpeg;base64,...",
  "memo": "",
  "createdAt": "2024-06-01T10:00:00.000Z"
}
```

#### app_settings

設定タイプごとに異なる構造を持つ。

**表示設定 (id: `display_settings`)**:

```json
{
  "id": "display_settings",
  "fields": {
    "customer": {
      "code": true, "kana": true, "phone": true,
      "email": true, "address": true, "occupation": true,
      "firstVisit": true, "practitioner": true, "memo": true,
      "allergies": true, "histories": true, "photo": true
    },
    "treatment": {
      "menu": true, "duration": true,
      "bodyCondition": true, "photo": true
    }
  }
}
```

**画像圧縮設定 (id: `image_settings`)**:

```json
{
  "id": "image_settings",
  "preset": "standard"
}
```

**施術メニュー (id: `treatment_menus`)**:

```json
{
  "id": "treatment_menus",
  "menus": [
    {
      "id": "uuid",
      "name": "全身もみほぐし 60分",
      "defaultDuration": 60,
      "sortOrder": 0
    }
  ]
}
```

---

## 4. 画面設計

### 4.1 タブ構成

| # | タブID | ラベル | 内容 |
|---|--------|--------|------|
| 1 | `customers` | 顧客 | 顧客検索・一覧・新規登録 |
| 2 | `treatment` | 施術記録 | 施術記録入力（顧客選択が前提） |
| 3 | `history` | 履歴 | 訪問履歴タイムライン（顧客選択が前提） |
| 4 | `settings` | 設定 | データ管理・メニュー管理・表示設定・画像設定 |

### 4.2 画面フロー

```
[顧客タブ]
  ├── 顧客検索バー
  ├── 顧客カード一覧
  │     ├── カードクリック → 顧客選択 → 施術記録タブへ自動遷移
  │     └── 詳細ボタン → 顧客詳細オーバーレイ
  └── ＋新規顧客登録ボタン → 顧客登録モーダル

[施術記録タブ] (顧客選択が前提)
  ├── 顧客情報バー（クリックで顧客詳細オーバーレイを表示）
  ├── アレルギー警告（該当時）
  ├── 施術記録入力フォーム
  │     ├── 来店日時
  │     ├── 主訴/所見/施術内容/施術後メモ
  │     ├── 前回施術後メモヒント
  │     ├── 施術メニュー・時間
  │     ├── 体調レベル（スライダー）
  │     ├── 気になる部位（チェックボックス）
  │     └── 写真添付
  ├── 保存ボタン
  └── 直近の記録サマリー

[履歴タブ] (顧客選択が前提)
  ├── 顧客情報バー（クリックで顧客詳細オーバーレイを表示）
  ├── 並び替えボタン
  ├── タイムライン表示
  └── ページネーション

[設定タブ]
  ├── データ管理（エクスポート/インポート/全削除）
  ├── 施術メニュー管理
  ├── 表示設定
  ├── 画像圧縮設定
  ├── アプリ情報
  └── サンプルデータインポート
```

### 4.3 モーダル一覧

| モーダル | トリガー | 内容 |
|---------|---------|------|
| 顧客登録/編集モーダル | 新規登録ボタン / 編集ボタン | 顧客フォーム全項目 |
| 施術記録編集モーダル | タイムライン内の編集ボタン | 施術記録全項目 |
| 確認ダイアログ | 削除操作等 | タイトル・メッセージ・確認ボタン |
| 顧客詳細オーバーレイ | 詳細ボタン / 顧客情報バークリック | 顧客情報の読み取り専用表示（8セクション）、閉じる・編集ボタン |
| 写真ライトボックス | サムネイルクリック | 拡大画像表示 |

---

## 5. レスポンシブ対応

| ブレークポイント | 対象 | 特記事項 |
|----------------|------|---------|
| 〜375px | モバイル | タブナビが画面幅内に収まること |
| 376px〜768px | タブレット | フォーム2カラム→1カラム |
| 769px〜 | デスクトップ | フォーム2カラムレイアウト |

---

## 6. PWA構成

### 6.1 Service Worker (`sw.js`)

- **キャッシュ戦略**: プリキャッシュ + ネットワークフォールバック
- **プリキャッシュ対象**: index.html, style.css, script.js, smrm.calc.js, version.js, manifest.json, アイコン群
- **install**: 全アセットをキャッシュに追加、即座に `skipWaiting()`
- **activate**: 旧キャッシュを削除、即座に `clients.claim()`
- **fetch**: キャッシュ優先、キャッシュミス時はネットワークからフェッチしてキャッシュに追加
- **SKIP_WAITING メッセージ**: クライアントからの指示で即座に更新

### 6.2 Web App Manifest (`manifest.json`)

| 項目 | 値 |
|------|-----|
| name | シンプルカルテ管理 |
| short_name | カルテ管理 |
| display | standalone |
| orientation | portrait |
| theme_color | #92400e |
| background_color | #ffffff |
| start_url | /index.html |

### 6.3 PWA ショートカット

| ショートカット名 | URL |
|----------------|-----|
| 顧客一覧 | /index.html?tab=customers |
| 施術記録 | /index.html?tab=treatment |
