# 詳細設計書 — シンプルカルテ管理 (smrm)

## 1. 固定UI要素

### 1.1 スクロールトップボタン

| 項目 | 値 |
|------|-----|
| 要素ID | `scroll-to-top-btn` |
| 位置 | `position: fixed`、左上 |
| 機能 | クリックでページ先頭へスクロール |
| CSS クラス | `scroll-to-top-btn no-print` |

### 1.2 バージョン情報表示

| 項目 | 値 |
|------|-----|
| 要素ID | `app-info-display` |
| 位置 | `position: fixed`、右上 |
| 表示内容 | `version.js` から読み込んだバージョン・ビルド日時 |
| CSS クラス | `app-info-display no-print` |

### 1.3 ヘッダー

| 項目 | 値 |
|------|-----|
| 要素 | `header.app-header` |
| 表示内容 | 「シンプルカルテ管理」 |
| 機能 | クリックで `window.scrollTo(0, 0)` |

### 1.4 更新バナー

| 項目 | 値 |
|------|-----|
| 要素ID | `update-banner` |
| 位置 | ヘッダー直下 |
| 初期状態 | `display: none` |
| 表示条件 | Service Worker が新バージョンを検知した場合 |
| ボタン | 「今すぐ更新」→ SKIP_WAITING メッセージ送信 + リロード |

---

## 2. IndexedDB CRUD操作一覧

### 2.1 汎用操作関数

| 関数名 | 操作 | 引数 | 戻り値 |
|--------|------|------|--------|
| `openDB()` | DB接続 | なし | `Promise<IDBDatabase>` |
| `addToStore(storeName, record)` | 新規追加 | ストア名, レコード | `Promise<string>` (id) |
| `updateInStore(storeName, record)` | 更新 (put) | ストア名, レコード | `Promise<void>` |
| `getFromStore(storeName, id)` | 1件取得 | ストア名, id | `Promise<object>` |
| `getAllFromStore(storeName)` | 全件取得 | ストア名 | `Promise<object[]>` |
| `deleteFromStore(storeName, id)` | 1件削除 | ストア名, id | `Promise<void>` |
| `clearStore(storeName)` | 全件削除 | ストア名 | `Promise<void>` |
| `getByIndex(storeName, indexName, value)` | インデックス検索 | ストア名, インデックス名, 値 | `Promise<object[]>` |

### 2.2 ドメインヘルパー関数

| 関数名 | 操作 | 対象ストア |
|--------|------|-----------|
| `getAllCustomers()` | 全顧客取得 | `customers` |
| `addCustomer(customer)` | 顧客追加 | `customers` |
| `getRecord(id)` | 施術記録取得 | `treatment_records` |
| `addRecord(record)` | 施術記録追加 | `treatment_records` |
| `getRecordsByCustomer(customerId)` | 顧客別施術記録取得 | `treatment_records` |
| `saveMedia(mediaRecord)` | メディア保存 | `media` |
| `getMediaByParent(parentId)` | 親ID別メディア取得 | `media` |
| `deleteMedia(mediaId)` | メディア削除 | `media` |
| `deleteMediaByParent(parentId)` | 親ID別メディア全削除 | `media` |

### 2.3 設定操作関数

| 関数名 | 操作 |
|--------|------|
| `loadDisplaySettings()` | 表示設定読み込み（未設定時デフォルト値を返す） |
| `saveDisplaySettings(settings)` | 表示設定保存 |
| `loadImageSettings()` | 画像圧縮設定読み込み |
| `saveImageSettings(settings)` | 画像圧縮設定保存 |
| `loadTreatmentMenus()` | 施術メニュー読み込み |
| `saveTreatmentMenus(menus)` | 施術メニュー保存 |

---

## 3. バリデーション仕様

### 3.1 顧客バリデーション (`validateCustomer`)

| フィールド | ルール | エラーメッセージ |
|-----------|--------|----------------|
| name | 必須、1〜100文字 | 「氏名を入力してください」/「氏名は100文字以内で入力してください」 |
| birthDate | 任意、過去日付、0〜150歳 | 「生年月日の形式が不正です」/「生年月日は過去の日付を入力してください」/「生年月日が有効範囲外です（0〜150歳）」 |
| gender | 任意、male/female/other | 「性別の値が不正です」 |
| nameKana | 任意、ひらがな+長音記号+スペース、100文字以内 | 「ふりがなはひらがなで入力してください」/「ふりがなは100文字以内で入力してください」 |
| phone | 任意、半角数字+ハイフン、7〜15文字 | 「電話番号は半角数字とハイフンで入力してください」/「電話番号は7〜15文字で入力してください」 |

### 3.2 施術記録バリデーション (`validateTreatmentRecord`)

| ルール | エラーメッセージ |
|--------|----------------|
| 主訴/所見/施術内容/施術後メモのいずれか1つ以上が必須 | 「主訴/所見/施術内容/施術後メモのいずれか1つ以上を入力してください」 |
| 各フィールド2000文字以内 | 「{フィールド名}は2000文字以内で入力してください」 |

### 3.3 体調レベルバリデーション (`validateBodyCondition`)

| フィールド | ルール | エラーメッセージ |
|-----------|--------|----------------|
| painLevel | 任意、0〜10の整数 | 「痛みレベルは0〜10の整数で入力してください」 |
| stiffnessLevel | 任意、0〜10の整数 | 「凝りレベルは0〜10の整数で入力してください」 |
| fatigueLevel | 任意、0〜10の整数 | 「疲労レベルは0〜10の整数で入力してください」 |
| areas | 任意、配列であること | 「気になる部位の形式が不正です」 |

### 3.4 インポートデータバリデーション (`validateImportData`)

| ルール | エラーメッセージ |
|--------|----------------|
| オブジェクト形式であること | 「JSONオブジェクト形式ではありません」 |
| `appName === 'smrm'` | 「このファイルはsmrm形式ではありません」 |
| `customers` が配列 | 「customersフィールドが不正です」 |
| `treatmentRecords` が配列 | 「treatmentRecordsフィールドが不正です」 |
| `treatmentMenus` が配列またはundefined | 「treatmentMenusフィールドが不正です」 |

### 3.5 施術メニューバリデーション (`validateTreatmentMenu`)

| フィールド | ルール | エラーメッセージ |
|-----------|--------|----------------|
| name | 必須、1〜100文字 | 「メニュー名を入力してください」/「メニュー名は100文字以内で入力してください」 |
| defaultDuration | 任意、1〜480の整数 | 「施術時間は1〜480の整数で入力してください」 |

---

## 4. 計算ロジック（smrm.calc.js）

### 4.1 関数一覧

| 関数名 | 分類 | 引数 | 戻り値 | 説明 |
|--------|------|------|--------|------|
| `calcAge(birthDate)` | 計算 | 生年月日文字列 | 年齢(int) | 誕生日ベースの年齢計算 |
| `validateCustomer(customer)` | バリデーション | 顧客オブジェクト | `{valid, errors[]}` | 顧客情報の入力検証 |
| `validateTreatmentRecord(record)` | バリデーション | 施術記録オブジェクト | `{valid, errors[]}` | 施術記録の入力検証 |
| `validateBodyCondition(condition)` | バリデーション | 体調レベルオブジェクト | `{valid, errors[]}` | 体調レベルの入力検証 |
| `validateImportData(data)` | バリデーション | インポートデータ | `{valid, error?}` | インポートデータの形式検証 |
| `validateTreatmentMenu(menu)` | バリデーション | メニューオブジェクト | `{valid, errors[]}` | 施術メニューの入力検証 |
| `mergeMenusByName(existing, imported)` | マージ | 既存配列, インポート配列 | マージ済み配列 | 名前ベースのメニューマージ |
| `generateUUID()` | ユーティリティ | なし | UUID文字列 | UUID v4 生成 |
| `generateCustomerCode(existingCodes)` | ユーティリティ | 既存コード配列 | コード文字列 | 顧客コード自動生成 |
| `formatDateTime(dateStr)` | フォーマット | 日時文字列/Date | 表示用文字列 | "YYYY/MM/DD HH:MM" 形式 |
| `formatDateTimeLocal(date)` | フォーマット | Dateオブジェクト | input用文字列 | "YYYY-MM-DDTHH:MM" 形式 |
| `formatDate(dateStr)` | フォーマット | 日付文字列/Date | 表示用文字列 | "YYYY/MM/DD" 形式 |
| `escapeHtml(str)` | セキュリティ | 文字列 | エスケープ済み文字列 | HTML特殊文字エスケープ |
| `resolveImagePreset(preset)` | 設定 | プリセット名 | 設定オブジェクト | 画像圧縮パラメータ解決 |

---

## 5. エクスポート/インポート仕様

### 5.1 エクスポートデータ形式

```json
{
  "version": "1.0.0",
  "appName": "smrm",
  "exportedAt": "2024-06-01T10:00:00.000Z",
  "customers": [ ... ],
  "treatmentRecords": [ ... ],
  "media": [ ... ],
  "treatmentMenus": [ ... ],
  "displaySettings": { ... }
}
```

### 5.2 エクスポート処理フロー

1. 全ストアからデータ取得（customers, treatment_records, media, app_settings）
2. JSON オブジェクトを構築
3. `Blob` を生成し `URL.createObjectURL` でダウンロード
4. ファイル名: `smrm_backup_YYYYMMDD_HHMMSS.json`

### 5.3 インポート処理フロー

1. JSONファイルを `FileReader` で読み込み
2. `validateImportData()` でフォーマット検証
3. 顧客データをマージ（同一IDはスキップ）
4. 施術記録をマージ（同一IDはスキップ）
5. メディアをマージ（同一IDはスキップ）
6. 施術メニューを `mergeMenusByName()` でマージ
7. 表示設定をインポート（存在する場合）
8. 成功メッセージを表示

---

## 6. 入力フォームUX

### 6.1 顧客切り替え時のリセット

顧客カードクリック時:

1. `selectedCustomerId` / `selectedCustomer` を更新
2. 施術記録入力フォームの全フィールドをクリア
3. 体調レベルスライダーを0にリセット
4. 気になる部位チェックボックスをすべてOFF
5. メディアステージングバッファをクリア
6. 施術記録タブに自動遷移

### 6.2 アレルギー警告

- 選択した顧客にアレルギー情報がある場合、施術記録タブの顧客情報バー直下に警告バーを表示
- 要素ID: `allergy-warning`
- アレルゲン名・重症度を一覧表示

### 6.3 前回施術後メモヒント

- 顧客の最新施術記録の `afterNotes` を取得
- 内容がある場合、施術記録フォーム下部にヒントとして表示
- 要素ID: `prev-after-notes-hint`
- 施術の継続性を保つための参照情報

### 6.4 メニュー選択時のデフォルト時間自動入力

- 施術メニュードロップダウンで選択変更時
- 施術時間フィールドが空の場合のみ、選択メニューの `defaultDuration` を自動入力
- 既に時間が入力されている場合は上書きしない

---

## 7. メディア処理

### 7.1 画像リサイズ (`resizeImage`)

```
入力: File オブジェクト, 最大長辺(px), JPEG品質(0-1)

処理:
1. Image オブジェクトに読み込み
2. 長辺が最大値を超える場合、アスペクト比を維持して縮小
3. Canvas に描画
4. canvas.toDataURL('image/jpeg', quality) で Data URL に変換

出力: JPEG Data URL 文字列
```

### 7.2 サムネイル生成

| パラメータ | 値 |
|-----------|-----|
| 最大長辺 | 200px (`MEDIA_THUMB_SIZE`) |
| JPEG品質 | 0.6 (`MEDIA_THUMB_QUALITY`) |

### 7.3 メディアステージング

写真添付は「ステージング→コミット」の2段階で処理される。

1. **ステージング**: ファイル選択/ドロップ時に `mediaStagingBuffers` にメモリ上で保持
2. **プレビュー**: サムネイルをグリッド表示、個別削除可能
3. **コミット**: レコード保存時に `commitStagedMedia()` で IndexedDB に永続化

ステージングバッファ:

| キー | 用途 |
|------|------|
| `treatment_record` | 施術記録の新規作成時 |
| `customer` | 顧客登録/編集時 |
| `edit_treatment_record` | 施術記録の編集時 |

### 7.4 ライトボックス

- サムネイルクリックで全画面表示
- ステージング中の画像: `mediaStagingBuffers` から Data URL を取得
- 保存済み画像: IndexedDB `media` ストアから Data URL を取得
- オーバーレイクリックまたは×ボタンで閉じる

---

## 8. PWA更新メカニズム

### 8.1 更新検知フロー

```
1. ページ読み込み時に Service Worker を登録
2. ブラウザが sw.js の変更を検知
3. 新 Service Worker が install → waiting 状態に
4. アプリが updatefound / statechange を検知
5. 更新バナーを表示
```

### 8.2 更新適用フロー

```
1. ユーザーが「今すぐ更新」ボタンをクリック
2. waiting 中の Service Worker に SKIP_WAITING メッセージを送信
3. Service Worker が skipWaiting() を実行
4. controllerchange イベントで ページリロード
```

### 8.3 手動更新確認

- 設定タブの「更新を確認」ボタン
- `registration.update()` を呼び出し
- 結果を `#update-check-status` に表示
