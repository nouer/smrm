# テスト仕様書 — シンプルカルテ管理 (smrm)

## 1. テスト構成

| テスト種別 | ファイル | 環境 | フレームワーク |
|-----------|---------|------|--------------|
| 単体テスト | `smrm.calc.test.js` | jsdom | Jest |
| E2Eテスト | `e2e.test.js` | Docker (node + Puppeteer) | Jest + Puppeteer |

### 実行コマンド

```bash
# 単体テスト
npm test

# E2Eテスト
docker compose run --rm smrm-test
```

---

## 2. 単体テスト仕様

テスト対象: `smrm.calc.js` の全エクスポート関数

### 2.1 年齢計算 (`calcAge`)

基準日: 2026-02-28（`jest.setSystemTime` で固定）

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-AGE-001 | 誕生日前 | `'1975-04-15'` | `50` |
| UT-AGE-002 | 誕生日当日 | `'1975-02-28'` | `51` |
| UT-AGE-003 | 誕生日翌日 | `'1975-03-01'` | `50` |
| UT-AGE-004 | 0歳児 | `'2026-01-15'` | `0` |
| UT-AGE-005 | 高齢 | `'1930-01-01'` | `96` |

### 2.2 顧客コード生成 (`generateCustomerCode`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-CC-001 | 顧客なし（初回） | `[]` | `'C0001'` |
| UT-CC-002 | 既存顧客あり | `['C0001', 'C0002']` | `'C0003'` |
| UT-CC-003 | 飛び番あり | `['C0001', 'C0003']` | `'C0004'` |
| UT-CC-004 | 4桁ゼロ埋め | `['C0009']` | `'C0010'` |
| UT-CC-005 | null入力 | `null` | `'C0001'` |
| UT-CC-006 | 不正コード混在 | `['C0001', 'INVALID', 'C0005']` | `'C0006'` |
| UT-CC-007 | 上限超過でエラー | `['C9999']` | `throw '顧客コードが上限に達しました'` |

### 2.3 顧客バリデーション (`validateCustomer`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-VAL-001 | 正常な入力（氏名のみ） | `{name: '田中太郎'}` | `valid: true, errors.length: 0` |
| UT-VAL-002 | 氏名が空 | `{name: ''}` | `valid: false, errors に '氏名を入力してください'` |
| UT-VAL-003 | 氏名がスペースのみ | `{name: '   '}` | `valid: false` |
| UT-VAL-004 | 氏名が100文字超過 | `{name: 'あ'.repeat(101)}` | `valid: false, errors に '氏名は100文字以内で入力してください'` |
| UT-VAL-005 | 生年月日が未来日 | `{name: '田中太郎', birthDate: '2099-01-01'}` | `valid: false, errors に '過去の日付' 含む` |
| UT-VAL-006 | 生年月日が空は許可 | `{name: '田中太郎', birthDate: ''}` | `valid: true` |
| UT-VAL-007 | 生年月日がnullは許可 | `{name: '田中太郎', birthDate: null}` | `valid: true` |
| UT-VAL-008 | 性別が空は許可 | `{name: '田中太郎', gender: ''}` | `valid: true` |
| UT-VAL-009 | 性別が不正 | `{name: '田中太郎', gender: 'invalid'}` | `valid: false, errors に '性別の値が不正です'` |
| UT-VAL-010 | 正常な性別値 | `gender: 'male'/'female'/'other'` | 各 `valid: true` |
| UT-VAL-011 | ふりがなにカタカナはNG | `{name: '田中太郎', nameKana: 'タナカ'}` | `valid: false, errors に 'ふりがなはひらがなで入力してください'` |
| UT-VAL-012 | ふりがなにひらがなはOK | `{name: '田中太郎', nameKana: 'たなか たろう'}` | `valid: true` |
| UT-VAL-013 | 電話番号のフォーマット不正 | `{name: '田中太郎', phone: 'abc-1234'}` | `valid: false, errors に '半角数字とハイフン'` |
| UT-VAL-014 | 電話番号が短すぎ | `{name: '田中太郎', phone: '123'}` | `valid: false, errors に '7〜15文字'` |
| UT-VAL-015 | 正常な電話番号 | `{name: '田中太郎', phone: '090-1234-5678'}` | `valid: true` |

### 2.4 施術記録バリデーション (`validateTreatmentRecord`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-TR-001 | 主訴のみ入力で有効 | `{chiefComplaint: '肩が痛い', ...空}` | `valid: true` |
| UT-TR-002 | 全フィールド空で無効 | `{全フィールド空}` | `valid: false, errors に 'いずれか1つ以上'` |
| UT-TR-003 | スペースのみで無効 | `{chiefComplaint: '   ', ...空}` | `valid: false` |
| UT-TR-004 | 施術内容のみ入力で有効 | `{treatmentContent: '全身もみほぐし60分', ...空}` | `valid: true` |
| UT-TR-005 | 2000文字超過で無効 | `{chiefComplaint: 'あ'.repeat(2001)}` | `valid: false, errors に '主訴は2000文字以内'` |
| UT-TR-006 | 2000文字ちょうどは有効 | `{chiefComplaint: 'あ'.repeat(2000)}` | `valid: true` |

### 2.5 体調レベルバリデーション (`validateBodyCondition`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-BC-001 | 正常な入力 | `{painLevel: 5, stiffnessLevel: 3, fatigueLevel: 7, areas: ['首', '肩']}` | `valid: true` |
| UT-BC-002 | 全てnullで有効 | `{painLevel: null, stiffnessLevel: null, fatigueLevel: null}` | `valid: true` |
| UT-BC-003 | 全て空文字で有効 | `{painLevel: '', stiffnessLevel: '', fatigueLevel: ''}` | `valid: true` |
| UT-BC-004 | 範囲外（負の値） | `{painLevel: -1, ...}` | `valid: false, errors に '痛みレベルは0〜10の整数'` |
| UT-BC-005 | 範囲外（11） | `{stiffnessLevel: 11, ...}` | `valid: false, errors に '凝りレベルは0〜10の整数'` |
| UT-BC-006 | 小数は無効 | `{fatigueLevel: 5.5, ...}` | `valid: false, errors に '疲労レベルは0〜10の整数'` |
| UT-BC-007 | 境界値（0と10） | `{painLevel: 0, stiffnessLevel: 10, fatigueLevel: 5}` | `valid: true` |
| UT-BC-008 | areasが配列でない | `{painLevel: 0, areas: 'not-an-array'}` | `valid: false, errors に '気になる部位の形式が不正'` |
| UT-BC-009 | areasが配列の場合 | `{painLevel: 0, areas: ['首', '腰']}` | `valid: true` |

### 2.6 インポートデータバリデーション (`validateImportData`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-IMP-001 | 正常なインポートデータ | `{appName: 'smrm', customers: [], treatmentRecords: []}` | `valid: true` |
| UT-IMP-002 | appNameが不一致 | `{appName: 'emr', ...}` | `valid: false, error に 'smrm形式ではありません'` |
| UT-IMP-003 | null入力 | `null` | `valid: false` |
| UT-IMP-004 | customersが配列でない | `{appName: 'smrm', customers: 'not-array', ...}` | `valid: false, error に 'customersフィールドが不正'` |
| UT-IMP-005 | treatmentRecordsが配列でない | `{..., treatmentRecords: 'not-array'}` | `valid: false, error に 'treatmentRecordsフィールドが不正'` |
| UT-IMP-006 | treatmentMenusが配列でない | `{..., treatmentMenus: 'not-array'}` | `valid: false, error に 'treatmentMenusフィールドが不正'` |
| UT-IMP-007 | treatmentMenusがundefined | `{appName: 'smrm', customers: [], treatmentRecords: []}` | `valid: true` |
| UT-IMP-008 | treatmentMenusが配列 | `{..., treatmentMenus: [{...}]}` | `valid: true` |

### 2.7 施術メニューバリデーション (`validateTreatmentMenu`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-TM-001 | 正常な入力（名前のみ） | `{name: '全身もみほぐし 60分'}` | `valid: true, errors.length: 0` |
| UT-TM-002 | 正常な入力（名前＋時間） | `{name: '全身もみほぐし', defaultDuration: 60}` | `valid: true` |
| UT-TM-003 | 名前が空 | `{name: ''}` | `valid: false, errors に 'メニュー名を入力してください'` |
| UT-TM-004 | 名前がスペースのみ | `{name: '   '}` | `valid: false, errors に 'メニュー名を入力してください'` |
| UT-TM-005 | 名前が100文字超過 | `{name: 'あ'.repeat(101)}` | `valid: false, errors に 'メニュー名は100文字以内'` |
| UT-TM-006 | 名前が100文字ちょうど | `{name: 'あ'.repeat(100)}` | `valid: true` |
| UT-TM-007 | 時間が範囲外（0） | `{name: 'テスト', defaultDuration: 0}` | `valid: false, errors に '施術時間は1〜480の整数'` |
| UT-TM-008 | 時間が範囲外（481） | `{name: 'テスト', defaultDuration: 481}` | `valid: false, errors に '施術時間は1〜480の整数'` |
| UT-TM-009 | 時間が小数 | `{name: 'テスト', defaultDuration: 30.5}` | `valid: false, errors に '施術時間は1〜480の整数'` |
| UT-TM-010 | 時間がnullは許可 | `{name: 'テスト', defaultDuration: null}` | `valid: true` |
| UT-TM-011 | 時間が空文字は許可 | `{name: 'テスト', defaultDuration: ''}` | `valid: true` |
| UT-TM-012 | 境界値（1と480） | `defaultDuration: 1 / 480` | 各 `valid: true` |

### 2.8 メニューマージ (`mergeMenusByName`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-MM-001 | 重複なしマージ | 既存:[A], インポート:[B] | `length: 2, [A, B]` |
| UT-MM-002 | 名前重複はスキップ | 既存:[全身もみほぐし], インポート:[全身もみほぐし, 新メニュー] | `length: 2, 既存IDが維持` |
| UT-MM-003 | sortOrder連番 | 既存:[sortOrder:0,1], インポート:[C,D] | `C.sortOrder: 2, D.sortOrder: 3` |
| UT-MM-004 | 空の既存にマージ | 既存:[], インポート:[A] | `length: 1, sortOrder: 0` |
| UT-MM-005 | IDなしにはUUID割当 | インポート:[{name: 'A', id: undefined}] | `id が UUID形式` |
| UT-MM-006 | 元の配列は変更されない | — | `existing.length は変化しない` |

### 2.9 UUID生成 (`generateUUID`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-UUID-001 | UUID形式に一致 | — | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` |
| UT-UUID-002 | 2回呼び出しで異なる値 | — | `a !== b` |

### 2.10 フォーマット関数

| テストID | テスト名 | 関数 | 入力 | 期待結果 |
|---------|---------|------|------|---------|
| UT-FMT-001 | 正常な日時 | `formatDateTime` | `'2026-02-28T14:30:00'` | `'2026/02/28 14:30'` |
| UT-FMT-002 | 不正な日時 | `formatDateTime` | `'invalid'` | `'---'` |
| UT-FMT-003 | 正常なDateオブジェクト | `formatDateTimeLocal` | `new Date(2026, 1, 28, 14, 30)` | `'2026-02-28T14:30'` |
| UT-FMT-004 | 正常な日付 | `formatDate` | `'2026-02-28'` | `'2026/02/28'` |
| UT-FMT-005 | 不正な日付 | `formatDate` | `'invalid'` | `'---'` |

### 2.11 HTMLエスケープ (`escapeHtml`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-ESC-001 | 特殊文字のエスケープ | `'<script>alert("XSS")</script>'` | `'&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'` |
| UT-ESC-002 | アンパサンドのエスケープ | `'A & B'` | `'A &amp; B'` |
| UT-ESC-003 | シングルクォートのエスケープ | `"it's"` | `"it&#039;s"` |
| UT-ESC-004 | 非文字列入力 | `null / undefined / 123` | `''` |
| UT-ESC-005 | 通常文字列はそのまま | `'こんにちは'` | `'こんにちは'` |

### 2.12 画像圧縮プリセット (`resolveImagePreset`)

| テストID | テスト名 | 入力 | 期待結果 |
|---------|---------|------|---------|
| UT-IP-001 | highプリセット | `'high'` | `{maxLongSide: 2048, jpegQuality: 0.92}` |
| UT-IP-002 | standardプリセット | `'standard'` | `{maxLongSide: 1200, jpegQuality: 0.80}` |
| UT-IP-003 | compactプリセット | `'compact'` | `{maxLongSide: 800, jpegQuality: 0.60}` |
| UT-IP-004 | 未知のプリセット | `'unknown'` | `{maxLongSide: 1200, jpegQuality: 0.80}` |
| UT-IP-005 | undefinedはstandardにフォールバック | `undefined` | `{maxLongSide: 1200, jpegQuality: 0.80}` |

---

## 3. E2Eテスト仕様

テスト環境: Docker コンテナ内 Puppeteer (Chromium headless)
テスト対象: `http://smrm-app:80` (nginx)

### 3.1 基本表示テスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-001 | ページ表示 | ページにアクセス | タイトルに「シンプルカルテ管理」、ヘッダー表示、タブボタン4個 |
| E2E-002 | 初期表示で顧客タブがアクティブ | ページにアクセス | 顧客タブが active、`#tab-customers` が表示 |

### 3.2 顧客管理テスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-003 | 顧客を新規登録 | 新規登録ボタン → フォーム入力（テスト太郎） → 保存 | モーダルが閉じ、顧客リストに「テスト太郎」が表示 |
| E2E-004 | 顧客検索 | 検索バーに「テスト太郎」入力 → 存在しない文字列で検索 | 検索結果にテスト太郎表示 → 該当なしで0件 |

### 3.3 施術記録テスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-005 | 施術記録を保存 | 顧客選択 → 施術記録タブ → 主訴/施術内容入力 → 保存 | 「保存」を含むメッセージ表示 |

### 3.4 履歴タブテスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-006 | タイムライン表示 | 顧客選択 → 履歴タブ | `#history-content` 表示、`#timeline-container` が存在 |

### 3.5 エラーチェック

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-007 | 全タブ巡回でエラーなし | 全4タブを順番にクリック | `pageErrors.length === 0` |

### 3.6 バージョン情報テスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-008 | バージョン情報表示 | 設定タブへ移動 | `#app-version-info` のテキストが空でない |

### 3.7 UIテスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-009 | スクロールトップボタン | — | `#scroll-to-top-btn` が `position: fixed` |
| E2E-010 | ヘッダークリックでページ先頭へ | スクロール → ヘッダークリック | `scrollY === 0` |

### 3.8 エクスポート/インポートテスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-011 | エクスポートでダウンロード | 設定タブ → エクスポートボタン | `.json` ファイルがダウンロードされる |
| E2E-012 | エクスポートJSONの構造検証 | ブラウザ内でDB読み取り | `appName: 'smrm'`, `customers` / `treatmentRecords` が配列 |

### 3.9 PWAテスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-PWA-001 | manifest.json読み込み | — | `link[rel="manifest"]` の href に `manifest.json` |
| E2E-PWA-002 | Service Worker登録 | ページ読み込み後3秒待機 | `navigator.serviceWorker.getRegistration()` が truthy |
| E2E-PWA-003 | PWA metaタグ | — | `theme-color: #92400e`, `apple-mobile-web-app-capable: yes` |
| E2E-PWA-004 | 全タブ巡回でpageerrorなし | 全4タブ巡回 | `pageErrors.length === 0` |
| E2E-PWA-005 | 更新バナー初期状態 | — | `#update-banner` が存在し非表示 |
| E2E-PWA-006 | 更新確認ボタン | 設定タブへ移動 | `#check-update-btn` が表示 |

### 3.10 レスポンシブテスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-020 | モバイルビューポート (375x667) | ビューポート設定 | ヘッダー・タブナビ表示、タブ4個、タブナビが画面幅内 |
| E2E-021 | タブレットビューポート (768x1024) | ビューポート設定 | ヘッダー・タブナビ表示 |
| E2E-022 | モバイルで顧客登録 | 375x667で新規登録 → フォーム入力 → 保存 | 「モバイル花子」が顧客リストに表示 |

### 3.11 表示設定テスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-030 | 表示設定デフォルト状態 | 設定タブへ移動 | 全チェックボックスがチェック済み |

### 3.12 顧客切り替えテスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-031 | 顧客切り替えでフォームリセット | 顧客A選択 → 施術記録入力 → 顧客B選択 → 施術記録タブ確認 | 主訴フィールドが空にリセット |

### 3.13 アレルギー警告テスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-032 | アレルギー警告表示 | アレルギー付き顧客を登録 → 選択 → 施術記録タブ | `#allergy-warning` が存在 |

### 3.14 前回施術後メモヒントテスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-033 | 前回施術後メモヒント | 施術記録保存済み顧客を選択 → 施術記録タブ | `#prev-after-notes-hint` が存在 |

### 3.15 顧客詳細表示テスト

| テストID | テスト名 | 操作 | 期待結果 |
|---------|---------|------|---------|
| E2E-040 | 詳細ボタンでオーバーレイ表示 | 顧客登録 → 顧客カードの「詳細」ボタンをクリック | `#customer-detail-overlay` に `.show` クラスが付与される |
| E2E-041 | 顧客詳細に基本情報が表示される | 顧客登録 → 詳細ボタンクリック | `#customer-detail-body` に顧客名・顧客コードが含まれる |
| E2E-042 | 閉じるボタンでオーバーレイが閉じる | 詳細オーバーレイ表示 → 「閉じる」ボタンクリック | `#customer-detail-overlay` から `.show` クラスが除去される |
| E2E-043 | 編集ボタンで編集モーダルが開く | 詳細オーバーレイ表示 → 「編集」ボタンクリック | 詳細オーバーレイが閉じ、顧客編集モーダルが表示される |
| E2E-044 | 施術記録タブの顧客情報バーから詳細表示 | 顧客選択 → 施術記録タブ → 顧客情報バークリック | `#customer-detail-overlay` に `.show` クラスが付与される |
| E2E-045 | 履歴タブの顧客情報バーから詳細表示 | 顧客選択 → 履歴タブ → 顧客情報バークリック | `#customer-detail-overlay` に `.show` クラスが付与される |
| E2E-046 | 写真未登録時にイニシャルが表示される | 写真なしで顧客登録 | 顧客カードに `.customer-card-initial` 要素が存在し、顧客名の先頭1文字が表示される |
