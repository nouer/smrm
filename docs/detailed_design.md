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
2. `validateImportData()` でフォーマット検証（`appName: 'smrm'` 必須、`customers`/`treatmentRecords` 配列必須）
3. 顧客データをマージ（同一IDはスキップ）
4. 施術記録をマージ（同一IDはスキップ）
5. メディアをマージ（同一IDはスキップ）
6. 施術メニューを `mergeMenusByName()` でマージ
7. 表示設定をインポート（存在する場合）
8. 成功メッセージを表示

**エラー処理**: 各ストアへの書き込みは個別のトランザクションで実行。途中でエラーが発生した場合、それ以前のストアへの書き込みはコミット済みとなる（部分インポート状態）。エラー時はトーストで失敗メッセージを表示する。

**設計上の前提**: 本アプリのインポートは「マージ」方式（既存データを保持し、新規データのみ追加）であり、「完全復元」方式ではない。完全復元が必要な場合は、先に全データ削除を行ってからインポートする運用を想定している。

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
- `select._menuCache` にメニュー配列をメモリ上に保持し、`refreshMenuDropdowns()` で更新。DOM操作を最小化する

### 6.5 トースト通知

| 項目 | 値 |
|------|-----|
| コンテナ | `#toast-container` |
| 表示関数 | `showMessage(elementId, text, type)` |
| タイプ | `success`, `info`, `error` |
| 自動消去 | `success`/`info`: 3000ms 後に自動消去、`error`: 手動閉じまで表示 |
| 閉じるボタン | 各トーストに×ボタン付き |

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

---

## 9. 顧客詳細表示（読み取り専用オーバーレイ）

### 9.1 オーバーレイ構成

| 項目 | 値 |
|------|-----|
| 要素ID | `customer-detail-overlay` |
| CSSクラス | `overlay` |
| コンテンツ部 | `.overlay-content.overlay-content-wide` (max-width: 700px) |
| タイトル | 「顧客詳細」(`<h3>`) |
| 本文コンテナ | `#customer-detail-body` |

### 9.2 アクセスポイント

| # | トリガー | 要素 | 呼び出し |
|---|---------|------|---------|
| 1 | 顧客カードの「詳細」ボタン | `.btn.btn-sm.btn-secondary` | `openCustomerDetail(customerId)` |
| 2 | 施術記録タブの顧客情報バークリック | `#selected-customer-bar` | `openCustomerDetail(selectedCustomerId)` |
| 3 | 履歴タブの顧客情報バークリック | `#history-customer-bar` | `openCustomerDetail(selectedCustomerId)` |

※ 顧客情報バーのクリックハンドラでは、`<img>` 要素のクリックは除外される。

### 9.3 表示セクション

`openCustomerDetail(customerId)` がIndexedDBから顧客データを取得し、以下の8セクションのHTMLを構築して `#customer-detail-body` に挿入する。

| # | セクション | CSSクラス | 表示項目 |
|---|-----------|----------|---------|
| 1 | 基本情報 | `detail-section` | 顧客コード、氏名、ふりがな、生年月日（年齢自動計算）、性別 |
| 2 | 連絡先 | `detail-section` | 電話番号、メール、住所 |
| 3 | 利用情報 | `detail-section` | 職業、紹介元、利用動機、初回施術日、担当施術者 |
| 4 | 備考 | `detail-section` | 備考テキスト（未入力時は「---」） |
| 5 | アレルギー情報 | `detail-section` | アレルゲン名・重症度バッジ・備考の一覧（未登録時は「登録なし」） |
| 6 | 既往歴 | `detail-section` | 疾患名・備考の一覧（未登録時は「登録なし」） |
| 7 | 写真 | `detail-section` | 登録済みメディアのサムネイル一覧（クリックでライトボックス表示） |
| 8 | メタ情報 | `detail-meta-section` | 登録日、更新日 |

各セクションの表示/非表示は `applyDisplaySettings()` により表示設定に従って制御される。

### 9.4 ヘルパー関数

#### `detailRow(label, value, fieldKey)`

| 項目 | 値 |
|------|-----|
| 役割 | 読み取り専用の行（ラベル＋値）HTMLを生成 |
| 引数 `label` | 表示ラベル文字列 |
| 引数 `value` | 表示値（空の場合は「---」をミュート表示） |
| 引数 `fieldKey` | 任意。`data-field-key` 属性に設定し、表示設定によるフィルタリングに使用 |
| 出力 | `<div class="detail-row">` を含むHTML文字列 |
| セキュリティ | `escapeHtml()` でラベル・値をエスケープ |

### 9.5 操作ボタン

| ボタン | 要素ID | CSSクラス | 動作 |
|-------|--------|----------|------|
| 閉じる | `customer-detail-close` | `btn btn-secondary` | オーバーレイの `.show` クラスを除去して閉じる |
| 編集 | `customer-detail-edit` | `btn btn-primary` | オーバーレイを閉じ、顧客編集モーダル（`openEditCustomerForm`）を開く |
| 背景クリック | (オーバーレイ要素自体) | — | `e.target === el` 判定で即座に閉じる（読み取り専用のため確認不要） |

### 9.6 レスポンシブ対応

| ブレークポイント | 対象 | 変更内容 |
|----------------|------|---------|
| ≤768px | `.overlay-content-wide` | `max-width: 100%` |
| ≤480px | `.overlay-content` | `padding: 16px`、`max-height: 95vh` |
| ≤480px | `.detail-row` | グリッド列: `100px 1fr`（通常時 `120px 1fr`）、gap: `4px` |
| ≤480px | `.detail-meta-section` | `flex-direction: column`、gap: `4px` |
| ≤480px | `.overlay` | `padding: 10px` |

### 9.7 オーバーレイ閉じ動作

#### 読み取り専用オーバーレイ（顧客詳細・施術記録詳細）

背景クリックで即座に閉じる。`e.target === el` で背景判定し、コンテンツ内のクリックでは閉じない。

#### 編集系オーバーレイ（顧客登録/編集・施術記録編集）

背景クリックまたはキャンセルボタンで `closeEditOverlayWithConfirm(overlayId)` を呼び出す。

| 項目 | 値 |
|------|-----|
| 確認ダイアログタイトル | 「確認」 |
| 確認メッセージ | 「編集中の内容が失われます。閉じますか？」 |
| OKボタンテキスト | 「閉じる」 |
| OKボタンクラス | `btn-danger` |
| confirm-overlay z-index | `210`（編集オーバーレイ `z-index: 200` の上に表示） |

#### 確認ダイアログ共通関数

`showConfirm(title, message, okText, okClass)` で表示。各操作で以下のようにカスタマイズされる。

| 操作 | title | message | okText | okClass |
|------|-------|---------|--------|---------|
| 編集キャンセル/背景クリック | 確認 | 編集中の内容が失われます。閉じますか？ | 閉じる | btn-danger |
| 顧客削除 | 顧客の削除 | （顧客名）を削除しますか？… | 実行 | btn-danger |
| 施術記録削除 | 記録の削除 | この施術記録を削除しますか？ | 削除 | btn-danger |
| 全データ削除 | 全データ削除 | 全てのデータを削除します。… | 実行 | btn-danger |
| インポート確認 | データのインポート | データをインポートします。… | インポート | btn-primary |

#### 編集時の体調レベル値復元

`openEditRecord()` で既存値をフォームに復元する際、body condition の各レベル（pain/stiffness/fatigue）は `|| ''` で空文字デフォルトを設定。保存時に `Number()` で数値化。気になる部位のチェックボックスは既存の `areas` 配列に基づいて復元。

#### ボタンレイアウト

アクションボタン（詳細・編集・削除）は右寄せで配置。削除ボタンは誤操作防止のため `margin-left: 8px` で間隔を確保。

| コンテナ | 右寄せ手法 |
|---------|-----------|
| `.record-actions` | `margin-left: auto`（既存） |
| `.timeline-actions` | `justify-content: flex-end` |
| `.customer-card-actions` | `margin-left: auto` |

### 9.8 顧客カードのイニシャル表示

写真が未登録の顧客カードでは、写真サムネイルの代わりに顧客名の先頭1文字（イニシャル）を表示する。

| 項目 | 値 |
|------|-----|
| 対象 | 顧客カード（`renderCustomerList` 内） |
| 条件 | 顧客に紐づくメディアが存在しない場合 |
| 表示 | 氏名の先頭1文字（氏名が空の場合は「?」） |
| 要素 | `<span class="customer-card-thumb customer-card-initial">` |
| サイズ | 32×32px、円形（`border-radius: 50%`） |
| スタイル | 背景: `var(--primary-light)`（#fef3c7）、文字色: `var(--primary)`（#92400e）、太字 |

---

## 10. 履歴タイムライン仕様

### 10.1 ページネーション

| 項目 | 値 |
|------|-----|
| 1ページあたり件数 | `HISTORY_PAGE_SIZE = 20` |
| 現在ページ管理 | `historyCurrentPage` 変数 |
| 並び順 | `historySortDesc` フラグ（デフォルト: 新着順） |
| 切り替えUI | `#sort-toggle-btn`（並び替えボタン） |

### 10.2 月別グループ化

タイムラインのエントリは `YYYY年M月` の見出しでグループ化される。`renderTimeline()` で `visitedAt` の年月をキーとしてグループ分けし、各グループの先頭にヘッダーを表示。

### 10.3 エントリの展開/折りたたみ

| 操作 | 動作 |
|------|------|
| エントリクリック | `.expanded` クラスのトグル |
| 展開時 | `.timeline-entry-body` が表示される（主訴・施術内容・アクションボタン） |
| 折りたたみ時 | ヘッダー部のみ表示（日時・メニュー名） |

---

## 11. アプリケーション初期化仕様

### 11.1 3フェーズ初期化 (`initApp()`)

```
Phase 0（同期）:
  - DOM要素の取得・イベントハンドラ登録
  - Service Worker 登録
  - 更新バナー・スクロールトップボタンの初期化

Phase 1（並列IDB読取）:
  - Promise.all で以下を並列実行:
    - 表示設定の読み込み（display_settings）
    - 施術メニューの読み込み（treatment_menus）
    - 顧客リストのレンダリング（renderCustomerList）
    - 画像圧縮設定の読み込み（image_settings）
    - エクスポート通知設定の読み込み
    - お知らせ通知の確認

Phase 2（同期処理）:
  - Phase 1 の結果を反映
  - メニュードロップダウンの初期化
  - data-app-ready="true" をセット（E2Eテスト連携用）
  - 初期化完了ログ出力
```
