# アルゴリズム・ロジック仕様 — シンプルカルテ管理 (smrm)

## 1. 年齢計算アルゴリズム

### 関数: `calcAge(birthDate)`

**ファイル**: `smrm.calc.js`

#### アルゴリズム

```
入力: birthDate (string, "YYYY-MM-DD" 形式)
出力: age (integer)

1. today = 現在日付
2. birth = birthDate をパース
3. age = today.year - birth.year
4. IF today.month < birth.month THEN age -= 1
5. IF today.month == birth.month AND today.day < birth.day THEN age -= 1
6. RETURN age
```

#### 仕様

- 誕生日当日は「誕生日を迎えた」として加齢する
- 誕生日前日までは前の年齢を返す
- 日本の年齢計算（満年齢）に準拠

#### 計算例（基準日: 2026-02-28）

| 生年月日 | 計算 | 結果 |
|---------|------|------|
| 1975-04-15 | 誕生日前 | 50歳 |
| 1975-02-28 | 誕生日当日 | 51歳 |
| 1975-03-01 | 誕生日翌日（未到来） | 50歳 |
| 2026-01-15 | 0歳児 | 0歳 |
| 1930-01-01 | 高齢者 | 96歳 |

---

## 2. 顧客コード自動生成アルゴリズム

### 関数: `generateCustomerCode(existingCodes)`

**ファイル**: `smrm.calc.js`

#### アルゴリズム

```
入力: existingCodes (string[], 既存顧客コードの配列)
出力: nextCode (string, "C" + 4桁ゼロ埋め)

1. IF existingCodes が null/空 THEN RETURN "C0001"
2. numbers = existingCodes から /^C\d{4}$/ にマッチするものを数値化
3. IF numbers が空 THEN RETURN "C0001"
4. maxNum = numbers の最大値
5. nextNum = maxNum + 1
6. IF nextNum > 9999 THEN THROW "顧客コードが上限に達しました"
7. RETURN "C" + nextNum を4桁ゼロ埋め
```

#### 仕様

- コード形式: `C` + 4桁数字（`C0001` 〜 `C9999`）
- 最大値+1 方式（飛び番は再利用しない）
- 不正形式のコードは無視してフィルタリング
- 上限 C9999 を超える場合はエラーをスロー

#### 計算例

| 既存コード | 結果 | 備考 |
|-----------|------|------|
| `[]` | `C0001` | 初回 |
| `["C0001", "C0002"]` | `C0003` | 連番 |
| `["C0001", "C0003"]` | `C0004` | 飛び番あり（最大値+1） |
| `["C0009"]` | `C0010` | 桁上がり |
| `["C0001", "INVALID", "C0005"]` | `C0006` | 不正コード無視 |
| `null` | `C0001` | null入力 |
| `["C9999"]` | Error | 上限超過 |

---

## 3. エクスポートデータバリデーションアルゴリズム

### 関数: `validateImportData(data)`

**ファイル**: `smrm.calc.js`

#### アルゴリズム

```
入力: data (any)
出力: { valid: boolean, error?: string }

1. IF typeof data !== 'object' OR data === null
     RETURN { valid: false, error: 'JSONオブジェクト形式ではありません' }
2. IF data.appName !== 'smrm'
     RETURN { valid: false, error: 'このファイルはsmrm形式ではありません' }
3. IF !Array.isArray(data.customers)
     RETURN { valid: false, error: 'customersフィールドが不正です' }
4. IF !Array.isArray(data.treatmentRecords)
     RETURN { valid: false, error: 'treatmentRecordsフィールドが不正です' }
5. IF data.treatmentMenus !== undefined AND !Array.isArray(data.treatmentMenus)
     RETURN { valid: false, error: 'treatmentMenusフィールドが不正です' }
6. RETURN { valid: true }
```

#### 検証順序

1. 型チェック（オブジェクトであること）
2. アプリ識別子チェック（`appName === 'smrm'`）
3. 必須配列チェック（customers, treatmentRecords）
4. オプション配列チェック（treatmentMenus）

---

## 4. 施術メニューマージアルゴリズム

### 関数: `mergeMenusByName(existing, imported)`

**ファイル**: `smrm.calc.js`

#### アルゴリズム

```
入力: existing (Array, 既存メニュー), imported (Array, インポートメニュー)
出力: merged (Array, マージ済みメニュー)

1. result = existing の浅いコピー
2. existingNames = result のメニュー名の Set
3. maxSortOrder = result 内の最大 sortOrder（空なら -1）
4. FOR EACH imp IN imported:
     a. IF existingNames に imp.name が存在 THEN CONTINUE (スキップ)
     b. maxSortOrder += 1
     c. result に追加:
        - id: imp.id または generateUUID()
        - name: imp.name
        - defaultDuration: imp.defaultDuration または null
        - sortOrder: maxSortOrder
     d. existingNames に imp.name を追加
5. RETURN result
```

#### 仕様

- **名前ベースの重複判定**: 同名メニューはスキップ（IDではなく名前で比較）
- **sortOrder の連番維持**: 既存の最大 sortOrder に続けて採番
- **元配列の非破壊**: 既存配列はコピーされ、元の配列は変更されない
- **IDなしインポート対応**: IDが未指定の場合は新規 UUID を自動生成

#### マージ例

既存: `[{name: "全身もみほぐし", sortOrder: 0}]`
インポート: `[{name: "全身もみほぐし", ...}, {name: "新メニュー", ...}]`

結果: `[{name: "全身もみほぐし", sortOrder: 0}, {name: "新メニュー", sortOrder: 1}]`
→ 「全身もみほぐし」はスキップ、「新メニュー」のみ追加

---

## 5. UUID生成

### 関数: `generateUUID()`

**ファイル**: `smrm.calc.js`

#### アルゴリズム

```
1. IF crypto.randomUUID が利用可能
     RETURN crypto.randomUUID()
2. ELSE (フォールバック)
     テンプレート "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" の各文字を:
     - 'x': ランダムな16進数 (0-f)
     - 'y': ランダムな16進数 (8, 9, a, b のいずれか)
     - '4': 固定値4 (UUID v4 識別子)
     に置換して返す
```

#### 仕様

- UUID v4 形式（`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`）
- モダンブラウザでは `crypto.randomUUID()` を使用（暗号論的擬似乱数）
- 非対応環境では `Math.random()` ベースのフォールバック
- 出力形式: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`

---

## 6. 画像圧縮プリセット解決ロジック

### 関数: `resolveImagePreset(preset)`

**ファイル**: `smrm.calc.js`

#### アルゴリズム

```
入力: preset (string, "high" | "standard" | "compact")
出力: { maxLongSide: number, jpegQuality: number }

プリセット定義:
  high:     { maxLongSide: 2048, jpegQuality: 0.92 }
  standard: { maxLongSide: 1200, jpegQuality: 0.80 }
  compact:  { maxLongSide:  800, jpegQuality: 0.60 }

1. IF preset がプリセット定義に存在
     RETURN 対応するプリセット値
2. ELSE
     RETURN standard のプリセット値（フォールバック）
```

#### プリセット詳細

| プリセット | 長辺(px) | JPEG品質 | 用途 | 目安サイズ |
|-----------|---------|----------|------|-----------|
| `high` | 2048 | 0.92 | 肌の状態など詳細な記録 | 300〜800KB/枚 |
| `standard` | 1200 | 0.80 | 通常の記録（デフォルト） | 100〜400KB/枚 |
| `compact` | 800 | 0.60 | ストレージ容量の節約 | 50〜200KB/枚 |

#### フォールバック動作

未知のプリセット名（`undefined` を含む）が指定された場合、`standard` の値を返す。

---

## 7. HTMLエスケープ

### 関数: `escapeHtml(str)`

**ファイル**: `smrm.calc.js`

#### アルゴリズム

```
入力: str (any)
出力: エスケープ済み文字列

1. IF typeof str !== 'string' THEN RETURN ''
2. 以下の置換を順番に適用:
   '&' → '&amp;'
   '<' → '&lt;'
   '>' → '&gt;'
   '"' → '&quot;'
   "'" → '&#039;'
3. RETURN 置換済み文字列
```

#### 置換対象

| 文字 | エスケープ後 |
|------|------------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#039;` |

#### 重要な仕様

- 非文字列（null, undefined, number等）が入力された場合は空文字列 `''` を返す
- XSS防止のため、ユーザー入力をHTMLに埋め込む際は必ずこの関数を使用する

---

## 8. 日時フォーマット

### 関数: `formatDateTime(dateStr)`

```
入力: dateStr (string | Date)
出力: "YYYY/MM/DD HH:MM" 形式の文字列、不正な場合は "---"
```

### 関数: `formatDateTimeLocal(date)`

```
入力: date (Date)
出力: "YYYY-MM-DDTHH:MM" 形式の文字列（datetime-local input 用）
```

### 関数: `formatDate(dateStr)`

```
入力: dateStr (string | Date)
出力: "YYYY/MM/DD" 形式の文字列、不正な場合は "---"
```

#### 共通仕様

- 月・日・時・分は2桁ゼロ埋め
- `formatDateTime` / `formatDate` は不正な日付入力に対して `"---"` を返す
