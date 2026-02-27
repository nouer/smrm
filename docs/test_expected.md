# テスト期待結果 — シンプルカルテ管理 (smrm)

## 1. 単体テスト期待結果

### 1.1 年齢計算 (`calcAge`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-AGE-001 | `calcAge('1975-04-15')` | `50` |
| UT-AGE-002 | `calcAge('1975-02-28')` | `51` |
| UT-AGE-003 | `calcAge('1975-03-01')` | `50` |
| UT-AGE-004 | `calcAge('2026-01-15')` | `0` |
| UT-AGE-005 | `calcAge('1930-01-01')` | `96` |

※ 基準日: 2026-02-28

### 1.2 顧客コード生成 (`generateCustomerCode`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-CC-001 | `generateCustomerCode([])` | `'C0001'` |
| UT-CC-002 | `generateCustomerCode(['C0001', 'C0002'])` | `'C0003'` |
| UT-CC-003 | `generateCustomerCode(['C0001', 'C0003'])` | `'C0004'` |
| UT-CC-004 | `generateCustomerCode(['C0009'])` | `'C0010'` |
| UT-CC-005 | `generateCustomerCode(null)` | `'C0001'` |
| UT-CC-006 | `generateCustomerCode(['C0001', 'INVALID', 'C0005'])` | `'C0006'` |
| UT-CC-007 | `generateCustomerCode(['C9999'])` | `throw Error('顧客コードが上限に達しました')` |

### 1.3 顧客バリデーション (`validateCustomer`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-VAL-001 | `validateCustomer({name: '田中太郎'})` | `{valid: true, errors: []}` |
| UT-VAL-002 | `validateCustomer({name: ''})` | `{valid: false, errors: ['氏名を入力してください']}` |
| UT-VAL-003 | `validateCustomer({name: '   '})` | `{valid: false, errors: [...]}` |
| UT-VAL-004 | `validateCustomer({name: 'あ'.repeat(101)})` | `{valid: false, errors: ['氏名は100文字以内で入力してください']}` |
| UT-VAL-005 | `validateCustomer({name: '田中太郎', birthDate: '2099-01-01'})` | `{valid: false, errors: ['生年月日は過去の日付を入力してください']}` |
| UT-VAL-006 | `validateCustomer({name: '田中太郎', birthDate: ''})` | `{valid: true, errors: []}` |
| UT-VAL-007 | `validateCustomer({name: '田中太郎', birthDate: null})` | `{valid: true, errors: []}` |
| UT-VAL-008 | `validateCustomer({name: '田中太郎', gender: ''})` | `{valid: true, errors: []}` |
| UT-VAL-009 | `validateCustomer({name: '田中太郎', gender: 'invalid'})` | `{valid: false, errors: ['性別の値が不正です']}` |
| UT-VAL-010 | `validateCustomer({name: '田中太郎', gender: 'male'})` | `{valid: true, errors: []}` |
| UT-VAL-011 | `validateCustomer({name: '田中太郎', nameKana: 'タナカ'})` | `{valid: false, errors: ['ふりがなはひらがなで入力してください']}` |
| UT-VAL-012 | `validateCustomer({name: '田中太郎', nameKana: 'たなか たろう'})` | `{valid: true, errors: []}` |
| UT-VAL-013 | `validateCustomer({name: '田中太郎', phone: 'abc-1234'})` | `{valid: false, errors: ['電話番号は半角数字とハイフンで入力してください']}` |
| UT-VAL-014 | `validateCustomer({name: '田中太郎', phone: '123'})` | `{valid: false, errors: ['電話番号は7〜15文字で入力してください']}` |
| UT-VAL-015 | `validateCustomer({name: '田中太郎', phone: '090-1234-5678'})` | `{valid: true, errors: []}` |

### 1.4 施術記録バリデーション (`validateTreatmentRecord`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-TR-001 | `validateTreatmentRecord({chiefComplaint: '肩が痛い', bodyFindings: '', treatmentContent: '', afterNotes: ''})` | `{valid: true, errors: []}` |
| UT-TR-002 | `validateTreatmentRecord({chiefComplaint: '', bodyFindings: '', treatmentContent: '', afterNotes: ''})` | `{valid: false, errors: ['主訴/所見/施術内容/施術後メモのいずれか1つ以上を入力してください']}` |
| UT-TR-003 | `validateTreatmentRecord({chiefComplaint: '   ', bodyFindings: '', treatmentContent: '', afterNotes: ''})` | `{valid: false, errors: [...]}` |
| UT-TR-004 | `validateTreatmentRecord({chiefComplaint: '', bodyFindings: '', treatmentContent: '全身もみほぐし60分', afterNotes: ''})` | `{valid: true, errors: []}` |
| UT-TR-005 | `validateTreatmentRecord({chiefComplaint: 'あ'.repeat(2001), ...})` | `{valid: false, errors: ['主訴は2000文字以内で入力してください']}` |
| UT-TR-006 | `validateTreatmentRecord({chiefComplaint: 'あ'.repeat(2000), ...})` | `{valid: true, errors: []}` |

### 1.5 体調レベルバリデーション (`validateBodyCondition`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-BC-001 | `validateBodyCondition({painLevel: 5, stiffnessLevel: 3, fatigueLevel: 7, areas: ['首', '肩']})` | `{valid: true, errors: []}` |
| UT-BC-002 | `validateBodyCondition({painLevel: null, stiffnessLevel: null, fatigueLevel: null})` | `{valid: true, errors: []}` |
| UT-BC-003 | `validateBodyCondition({painLevel: '', stiffnessLevel: '', fatigueLevel: ''})` | `{valid: true, errors: []}` |
| UT-BC-004 | `validateBodyCondition({painLevel: -1, stiffnessLevel: 0, fatigueLevel: 0})` | `{valid: false, errors: ['痛みレベルは0〜10の整数で入力してください']}` |
| UT-BC-005 | `validateBodyCondition({painLevel: 0, stiffnessLevel: 11, fatigueLevel: 0})` | `{valid: false, errors: ['凝りレベルは0〜10の整数で入力してください']}` |
| UT-BC-006 | `validateBodyCondition({painLevel: 0, stiffnessLevel: 0, fatigueLevel: 5.5})` | `{valid: false, errors: ['疲労レベルは0〜10の整数で入力してください']}` |
| UT-BC-007 | `validateBodyCondition({painLevel: 0, stiffnessLevel: 10, fatigueLevel: 5})` | `{valid: true, errors: []}` |
| UT-BC-008 | `validateBodyCondition({painLevel: 0, areas: 'not-an-array'})` | `{valid: false, errors: ['気になる部位の形式が不正です']}` |
| UT-BC-009 | `validateBodyCondition({painLevel: 0, areas: ['首', '腰']})` | `{valid: true, errors: []}` |

### 1.6 インポートデータバリデーション (`validateImportData`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-IMP-001 | `validateImportData({appName: 'smrm', customers: [], treatmentRecords: []})` | `{valid: true}` |
| UT-IMP-002 | `validateImportData({appName: 'emr', customers: [], treatmentRecords: []})` | `{valid: false, error: 'このファイルはsmrm形式ではありません'}` |
| UT-IMP-003 | `validateImportData(null)` | `{valid: false, error: 'JSONオブジェクト形式ではありません'}` |
| UT-IMP-004 | `validateImportData({appName: 'smrm', customers: 'not-array', treatmentRecords: []})` | `{valid: false, error: 'customersフィールドが不正です'}` |
| UT-IMP-005 | `validateImportData({appName: 'smrm', customers: [], treatmentRecords: 'not-array'})` | `{valid: false, error: 'treatmentRecordsフィールドが不正です'}` |
| UT-IMP-006 | `validateImportData({..., treatmentMenus: 'not-array'})` | `{valid: false, error: 'treatmentMenusフィールドが不正です'}` |
| UT-IMP-007 | `validateImportData({appName: 'smrm', customers: [], treatmentRecords: []})` | `{valid: true}` |
| UT-IMP-008 | `validateImportData({..., treatmentMenus: [{id: 'uuid', name: 'テスト', sortOrder: 0}]})` | `{valid: true}` |

### 1.7 施術メニューバリデーション (`validateTreatmentMenu`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-TM-001 | `validateTreatmentMenu({name: '全身もみほぐし 60分'})` | `{valid: true, errors: []}` |
| UT-TM-002 | `validateTreatmentMenu({name: '全身もみほぐし', defaultDuration: 60})` | `{valid: true, errors: []}` |
| UT-TM-003 | `validateTreatmentMenu({name: ''})` | `{valid: false, errors: ['メニュー名を入力してください']}` |
| UT-TM-004 | `validateTreatmentMenu({name: '   '})` | `{valid: false, errors: ['メニュー名を入力してください']}` |
| UT-TM-005 | `validateTreatmentMenu({name: 'あ'.repeat(101)})` | `{valid: false, errors: ['メニュー名は100文字以内で入力してください']}` |
| UT-TM-006 | `validateTreatmentMenu({name: 'あ'.repeat(100)})` | `{valid: true, errors: []}` |
| UT-TM-007 | `validateTreatmentMenu({name: 'テスト', defaultDuration: 0})` | `{valid: false, errors: ['施術時間は1〜480の整数で入力してください']}` |
| UT-TM-008 | `validateTreatmentMenu({name: 'テスト', defaultDuration: 481})` | `{valid: false, errors: ['施術時間は1〜480の整数で入力してください']}` |
| UT-TM-009 | `validateTreatmentMenu({name: 'テスト', defaultDuration: 30.5})` | `{valid: false, errors: ['施術時間は1〜480の整数で入力してください']}` |
| UT-TM-010 | `validateTreatmentMenu({name: 'テスト', defaultDuration: null})` | `{valid: true, errors: []}` |
| UT-TM-011 | `validateTreatmentMenu({name: 'テスト', defaultDuration: ''})` | `{valid: true, errors: []}` |
| UT-TM-012 | `validateTreatmentMenu({name: 'テスト', defaultDuration: 1})` | `{valid: true, errors: []}` |

### 1.8 メニューマージ (`mergeMenusByName`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-MM-001 | `mergeMenusByName([{name:'A'}], [{name:'B'}])` | `[{name:'A'}, {name:'B'}]` (length: 2) |
| UT-MM-002 | `mergeMenusByName([{id:'a', name:'全身もみほぐし'}], [{id:'b', name:'全身もみほぐし'}, {id:'c', name:'新メニュー'}])` | `length: 2, result[0].id: 'a'` |
| UT-MM-003 | `mergeMenusByName([{sortOrder:0}, {sortOrder:1}], [{name:'C'}, {name:'D'}])` | `result[2].sortOrder: 2, result[3].sortOrder: 3` |
| UT-MM-004 | `mergeMenusByName([], [{name:'A'}])` | `length: 1, result[0].sortOrder: 0` |
| UT-MM-005 | `mergeMenusByName([], [{name:'A'}])` | `result[0].id が /^[0-9a-f]{8}-/ にマッチ` |
| UT-MM-006 | `mergeMenusByName(existing, imported)` | `existing.length は変化しない` |

### 1.9 UUID生成 (`generateUUID`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-UUID-001 | `generateUUID()` | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` にマッチ |
| UT-UUID-002 | `generateUUID()` × 2 | `a !== b` |

### 1.10 フォーマット関数

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-FMT-001 | `formatDateTime('2026-02-28T14:30:00')` | `'2026/02/28 14:30'` |
| UT-FMT-002 | `formatDateTime('invalid')` | `'---'` |
| UT-FMT-003 | `formatDateTimeLocal(new Date(2026, 1, 28, 14, 30))` | `'2026-02-28T14:30'` |
| UT-FMT-004 | `formatDate('2026-02-28')` | `'2026/02/28'` |
| UT-FMT-005 | `formatDate('invalid')` | `'---'` |

### 1.11 HTMLエスケープ (`escapeHtml`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-ESC-001 | `escapeHtml('<script>alert("XSS")</script>')` | `'&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'` |
| UT-ESC-002 | `escapeHtml('A & B')` | `'A &amp; B'` |
| UT-ESC-003 | `escapeHtml("it's")` | `"it&#039;s"` |
| UT-ESC-004 | `escapeHtml(null)` / `escapeHtml(undefined)` / `escapeHtml(123)` | `''` |
| UT-ESC-005 | `escapeHtml('こんにちは')` | `'こんにちは'` |

### 1.12 画像圧縮プリセット (`resolveImagePreset`)

| テストID | 関数呼出し | 戻り値 |
|---------|-----------|--------|
| UT-IP-001 | `resolveImagePreset('high')` | `{maxLongSide: 2048, jpegQuality: 0.92}` |
| UT-IP-002 | `resolveImagePreset('standard')` | `{maxLongSide: 1200, jpegQuality: 0.80}` |
| UT-IP-003 | `resolveImagePreset('compact')` | `{maxLongSide: 800, jpegQuality: 0.60}` |
| UT-IP-004 | `resolveImagePreset('unknown')` | `{maxLongSide: 1200, jpegQuality: 0.80}` |
| UT-IP-005 | `resolveImagePreset(undefined)` | `{maxLongSide: 1200, jpegQuality: 0.80}` |

---

## 2. E2Eテスト期待結果

### 2.1 基本表示

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-001 | `page.title()` | 「シンプルカルテ管理」を含む |
| E2E-001 | `.app-header h1` テキスト | 「シンプルカルテ管理」を含む |
| E2E-001 | `.tab-nav button` の数 | `4` |
| E2E-002 | `.tab-nav button.active` の `data-tab` | `'customers'` |
| E2E-002 | `#tab-customers` の表示状態 | 表示（visible） |

### 2.2 顧客管理

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-003 | 保存後のモーダル | 非表示 |
| E2E-003 | `#customer-list` テキスト | 「テスト太郎」を含む |
| E2E-004 | 「テスト太郎」検索後 | テキストに「テスト太郎」を含む |
| E2E-004 | 「ZZZZNOTEXIST」検索後 | `.customer-card` が 0個 |

### 2.3 施術記録

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-005 | `#treatment-content` 表示状態 | 表示 |
| E2E-005 | `#record-message` テキスト | 「保存」を含む |

### 2.4 履歴タブ

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-006 | `#history-content` 表示状態 | 表示 |
| E2E-006 | `#timeline-container` | 存在する（not null） |

### 2.5 エラーチェック・UI

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-007 | `pageErrors.length` | `0` |
| E2E-008 | `#app-version-info` テキスト長 | `> 0` |
| E2E-009 | `#scroll-to-top-btn` の position | `'fixed'` |
| E2E-010 | ヘッダークリック後の `scrollY` | `0` |

### 2.6 エクスポート/インポート

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-011 | ダウンロードフォルダ内 `.json` ファイル数 | `>= 1` |
| E2E-012 | エクスポートデータの `appName` | `'smrm'` |
| E2E-012 | `customers` / `treatmentRecords` | `Array.isArray() === true` |

### 2.7 PWA

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-PWA-001 | `link[rel="manifest"]` href | `'manifest.json'` を含む |
| E2E-PWA-002 | Service Worker 登録状態 | `true` |
| E2E-PWA-003 | `meta[name="theme-color"]` content | `'#92400e'` |
| E2E-PWA-003 | `meta[name="apple-mobile-web-app-capable"]` content | `'yes'` |
| E2E-PWA-004 | `pageErrors.length` | `0` |
| E2E-PWA-005 | `#update-banner` 存在 | `true` |
| E2E-PWA-005 | `#update-banner` 表示状態 | 非表示 |
| E2E-PWA-006 | `#check-update-btn` 表示状態 | 表示 |

### 2.8 レスポンシブ

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-020 | 375x667 でヘッダー表示 | `true` |
| E2E-020 | 375x667 でタブナビ表示 | `true` |
| E2E-020 | 375x667 でタブ数 | `4` |
| E2E-020 | タブナビの `scrollWidth` ≤ `window.innerWidth + 5` | `true` |
| E2E-021 | 768x1024 でヘッダー・タブナビ表示 | `true` |
| E2E-022 | 375x667 で顧客登録後 `#customer-list` テキスト | 「モバイル花子」を含む |

### 2.9 表示設定・顧客切り替え・アレルギー・ヒント

| テストID | 検証項目 | 期待値 |
|---------|---------|--------|
| E2E-030 | `[data-display-key]` 全チェックボックス | 全て checked |
| E2E-031 | 顧客切り替え後の `#input-chief-complaint` 値 | `''`（空） |
| E2E-032 | `#allergy-warning` | 存在する（not null） |
| E2E-033 | `#prev-after-notes-hint` | 存在する（not null） |

---

## 3. テスト実行結果

### 3.1 単体テスト

```
テストスイート: 12 passed, 12 total
テストケース:  67 passed, 67 total

カバレッジ:
  Statements:  100%
  Branches:    100%
  Functions:   100%
  Lines:       100%
```

### 3.2 E2Eテスト

```
テストスイート: 1 passed, 1 total
テストケース:  21 passed, 21 total
```
