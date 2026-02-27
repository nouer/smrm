/**
 * smrm.calc.test.js - シンプルカルテ管理 計算ロジックの単体テスト
 */
const {
    calcAge,
    validateCustomer,
    validateTreatmentRecord,
    validateBodyCondition,
    validateImportData,
    validateTreatmentMenu,
    mergeMenusByName,
    generateCustomerCode,
    generateUUID,
    formatDateTime,
    formatDateTimeLocal,
    formatDate,
    escapeHtml,
    resolveImagePreset
} = require('./smrm.calc');

// ============================================================
// 1.1 年齢計算
// ============================================================
describe('calcAge - 年齢計算', () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-28'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('UT-AGE-001: 誕生日前 (1975-04-15 → 50歳)', () => {
        expect(calcAge('1975-04-15')).toBe(50);
    });

    test('UT-AGE-002: 誕生日当日 (1975-02-28 → 51歳)', () => {
        expect(calcAge('1975-02-28')).toBe(51);
    });

    test('UT-AGE-003: 誕生日翌日 (1975-03-01 → 50歳)', () => {
        expect(calcAge('1975-03-01')).toBe(50);
    });

    test('UT-AGE-004: 0歳児 (2026-01-15 → 0歳)', () => {
        expect(calcAge('2026-01-15')).toBe(0);
    });

    test('UT-AGE-005: 高齢 (1930-01-01 → 96歳)', () => {
        expect(calcAge('1930-01-01')).toBe(96);
    });
});

// ============================================================
// 1.2 顧客コード生成
// ============================================================
describe('generateCustomerCode - 顧客コード生成', () => {
    test('UT-CC-001: 顧客なし（初回） → "C0001"', () => {
        expect(generateCustomerCode([])).toBe('C0001');
    });

    test('UT-CC-002: 既存顧客あり ["C0001","C0002"] → "C0003"', () => {
        expect(generateCustomerCode(['C0001', 'C0002'])).toBe('C0003');
    });

    test('UT-CC-003: 飛び番あり ["C0001","C0003"] → "C0004"（最大値+1）', () => {
        expect(generateCustomerCode(['C0001', 'C0003'])).toBe('C0004');
    });

    test('UT-CC-004: 4桁ゼロ埋め ["C0009"] → "C0010"', () => {
        expect(generateCustomerCode(['C0009'])).toBe('C0010');
    });

    test('UT-CC-005: null入力 → "C0001"', () => {
        expect(generateCustomerCode(null)).toBe('C0001');
    });

    test('UT-CC-006: 不正コード混在 ["C0001","INVALID","C0005"] → "C0006"', () => {
        expect(generateCustomerCode(['C0001', 'INVALID', 'C0005'])).toBe('C0006');
    });

    test('UT-CC-007: 上限超過でエラー ["C9999"]', () => {
        expect(() => generateCustomerCode(['C9999'])).toThrow('顧客コードが上限に達しました');
    });
});

// ============================================================
// 1.3 顧客バリデーション
// ============================================================
describe('validateCustomer - 顧客情報バリデーション', () => {
    test('UT-VAL-001: 正常な入力（氏名のみ）', () => {
        const result = validateCustomer({ name: '田中太郎' });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('UT-VAL-002: 氏名が空', () => {
        const result = validateCustomer({ name: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('氏名を入力してください');
    });

    test('UT-VAL-003: 氏名がスペースのみ', () => {
        const result = validateCustomer({ name: '   ' });
        expect(result.valid).toBe(false);
    });

    test('UT-VAL-004: 氏名が100文字超過', () => {
        const result = validateCustomer({ name: 'あ'.repeat(101) });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('氏名は100文字以内で入力してください');
    });

    test('UT-VAL-005: 生年月日が未来日 (2099-01-01)', () => {
        const result = validateCustomer({ name: '田中太郎', birthDate: '2099-01-01' });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([expect.stringContaining('過去の日付')])
        );
    });

    test('UT-VAL-006: 生年月日が空は許可', () => {
        const result = validateCustomer({ name: '田中太郎', birthDate: '' });
        expect(result.valid).toBe(true);
    });

    test('UT-VAL-007: 生年月日がnullは許可', () => {
        const result = validateCustomer({ name: '田中太郎', birthDate: null });
        expect(result.valid).toBe(true);
    });

    test('UT-VAL-008: 性別が空は許可', () => {
        const result = validateCustomer({ name: '田中太郎', gender: '' });
        expect(result.valid).toBe(true);
    });

    test('UT-VAL-009: 性別が不正', () => {
        const result = validateCustomer({ name: '田中太郎', gender: 'invalid' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('性別の値が不正です');
    });

    test('UT-VAL-010: 正常な性別値 (male/female/other)', () => {
        expect(validateCustomer({ name: '田中太郎', gender: 'male' }).valid).toBe(true);
        expect(validateCustomer({ name: '田中太郎', gender: 'female' }).valid).toBe(true);
        expect(validateCustomer({ name: '田中太郎', gender: 'other' }).valid).toBe(true);
    });

    test('UT-VAL-011: ふりがなにカタカナはNG', () => {
        const result = validateCustomer({ name: '田中太郎', nameKana: 'タナカ' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('ふりがなはひらがなで入力してください');
    });

    test('UT-VAL-012: ふりがなにひらがなはOK', () => {
        const result = validateCustomer({ name: '田中太郎', nameKana: 'たなか たろう' });
        expect(result.valid).toBe(true);
    });

    test('UT-VAL-013: 電話番号のフォーマット不正', () => {
        const result = validateCustomer({ name: '田中太郎', phone: 'abc-1234' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('電話番号は半角数字とハイフンで入力してください');
    });

    test('UT-VAL-014: 電話番号が短すぎ', () => {
        const result = validateCustomer({ name: '田中太郎', phone: '123' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('電話番号は7〜15文字で入力してください');
    });

    test('UT-VAL-015: 正常な電話番号', () => {
        const result = validateCustomer({ name: '田中太郎', phone: '090-1234-5678' });
        expect(result.valid).toBe(true);
    });
});

// ============================================================
// 1.4 施術記録バリデーション
// ============================================================
describe('validateTreatmentRecord - 施術記録バリデーション', () => {
    test('UT-TR-001: 主訴のみ入力で有効', () => {
        const result = validateTreatmentRecord({
            chiefComplaint: '肩が痛い',
            bodyFindings: '',
            treatmentContent: '',
            afterNotes: ''
        });
        expect(result.valid).toBe(true);
    });

    test('UT-TR-002: 全フィールド空で無効', () => {
        const result = validateTreatmentRecord({
            chiefComplaint: '',
            bodyFindings: '',
            treatmentContent: '',
            afterNotes: ''
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('主訴/所見/施術内容/施術後メモのいずれか1つ以上を入力してください');
    });

    test('UT-TR-003: スペースのみで無効', () => {
        const result = validateTreatmentRecord({
            chiefComplaint: '   ',
            bodyFindings: '',
            treatmentContent: '',
            afterNotes: ''
        });
        expect(result.valid).toBe(false);
    });

    test('UT-TR-004: 施術内容のみ入力で有効', () => {
        const result = validateTreatmentRecord({
            chiefComplaint: '',
            bodyFindings: '',
            treatmentContent: '全身もみほぐし60分',
            afterNotes: ''
        });
        expect(result.valid).toBe(true);
    });

    test('UT-TR-005: 2000文字超過で無効', () => {
        const result = validateTreatmentRecord({
            chiefComplaint: 'あ'.repeat(2001),
            bodyFindings: '',
            treatmentContent: '',
            afterNotes: ''
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('主訴は2000文字以内で入力してください');
    });

    test('UT-TR-006: 2000文字ちょうどは有効', () => {
        const result = validateTreatmentRecord({
            chiefComplaint: 'あ'.repeat(2000),
            bodyFindings: '',
            treatmentContent: '',
            afterNotes: ''
        });
        expect(result.valid).toBe(true);
    });
});

// ============================================================
// 1.5 体調レベルバリデーション
// ============================================================
describe('validateBodyCondition - 体調レベルバリデーション', () => {
    test('UT-BC-001: 正常な入力', () => {
        const result = validateBodyCondition({
            painLevel: 5,
            stiffnessLevel: 3,
            fatigueLevel: 7,
            areas: ['首', '肩'],
            notes: ''
        });
        expect(result.valid).toBe(true);
    });

    test('UT-BC-002: 全てnullで有効', () => {
        const result = validateBodyCondition({
            painLevel: null,
            stiffnessLevel: null,
            fatigueLevel: null
        });
        expect(result.valid).toBe(true);
    });

    test('UT-BC-003: 全て空文字で有効', () => {
        const result = validateBodyCondition({
            painLevel: '',
            stiffnessLevel: '',
            fatigueLevel: ''
        });
        expect(result.valid).toBe(true);
    });

    test('UT-BC-004: 範囲外（負の値）', () => {
        const result = validateBodyCondition({ painLevel: -1, stiffnessLevel: 0, fatigueLevel: 0 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('痛みレベルは0〜10の整数で入力してください');
    });

    test('UT-BC-005: 範囲外（11）', () => {
        const result = validateBodyCondition({ painLevel: 0, stiffnessLevel: 11, fatigueLevel: 0 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('凝りレベルは0〜10の整数で入力してください');
    });

    test('UT-BC-006: 小数は無効', () => {
        const result = validateBodyCondition({ painLevel: 0, stiffnessLevel: 0, fatigueLevel: 5.5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('疲労レベルは0〜10の整数で入力してください');
    });

    test('UT-BC-007: 境界値（0と10）', () => {
        const result = validateBodyCondition({ painLevel: 0, stiffnessLevel: 10, fatigueLevel: 5 });
        expect(result.valid).toBe(true);
    });

    test('UT-BC-008: areasが配列でない場合', () => {
        const result = validateBodyCondition({ painLevel: 0, areas: 'not-an-array' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('気になる部位の形式が不正です');
    });

    test('UT-BC-009: areasが配列の場合', () => {
        const result = validateBodyCondition({ painLevel: 0, areas: ['首', '腰'] });
        expect(result.valid).toBe(true);
    });
});

// ============================================================
// 1.6 インポートデータバリデーション
// ============================================================
describe('validateImportData - インポートデータバリデーション', () => {
    test('UT-IMP-001: 正常なインポートデータ', () => {
        const result = validateImportData({
            appName: 'smrm',
            customers: [],
            treatmentRecords: []
        });
        expect(result.valid).toBe(true);
    });

    test('UT-IMP-002: appNameが不一致', () => {
        const result = validateImportData({
            appName: 'emr',
            customers: [],
            treatmentRecords: []
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('smrm形式ではありません');
    });

    test('UT-IMP-003: null入力', () => {
        const result = validateImportData(null);
        expect(result.valid).toBe(false);
    });

    test('UT-IMP-004: customersが配列でない', () => {
        const result = validateImportData({
            appName: 'smrm',
            customers: 'not-array',
            treatmentRecords: []
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('customersフィールドが不正');
    });

    test('UT-IMP-005: treatmentRecordsが配列でない', () => {
        const result = validateImportData({
            appName: 'smrm',
            customers: [],
            treatmentRecords: 'not-array'
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('treatmentRecordsフィールドが不正');
    });

    test('UT-IMP-006: treatmentMenusが配列でない場合エラー', () => {
        const result = validateImportData({
            appName: 'smrm',
            customers: [],
            treatmentRecords: [],
            treatmentMenus: 'not-array'
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('treatmentMenusフィールドが不正');
    });

    test('UT-IMP-007: treatmentMenusがundefinedは許可', () => {
        const result = validateImportData({
            appName: 'smrm',
            customers: [],
            treatmentRecords: []
        });
        expect(result.valid).toBe(true);
    });

    test('UT-IMP-008: treatmentMenusが配列の場合は有効', () => {
        const result = validateImportData({
            appName: 'smrm',
            customers: [],
            treatmentRecords: [],
            treatmentMenus: [{ id: 'uuid', name: 'テスト', sortOrder: 0 }]
        });
        expect(result.valid).toBe(true);
    });
});

// ============================================================
// 1.6b 施術メニューバリデーション
// ============================================================
describe('validateTreatmentMenu - 施術メニューバリデーション', () => {
    test('UT-TM-001: 正常な入力（名前のみ）', () => {
        const result = validateTreatmentMenu({ name: '全身もみほぐし 60分' });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('UT-TM-002: 正常な入力（名前＋時間）', () => {
        const result = validateTreatmentMenu({ name: '全身もみほぐし', defaultDuration: 60 });
        expect(result.valid).toBe(true);
    });

    test('UT-TM-003: 名前が空', () => {
        const result = validateTreatmentMenu({ name: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('メニュー名を入力してください');
    });

    test('UT-TM-004: 名前がスペースのみ', () => {
        const result = validateTreatmentMenu({ name: '   ' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('メニュー名を入力してください');
    });

    test('UT-TM-005: 名前が100文字超過', () => {
        const result = validateTreatmentMenu({ name: 'あ'.repeat(101) });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('メニュー名は100文字以内で入力してください');
    });

    test('UT-TM-006: 名前が100文字ちょうどは有効', () => {
        const result = validateTreatmentMenu({ name: 'あ'.repeat(100) });
        expect(result.valid).toBe(true);
    });

    test('UT-TM-007: 時間が範囲外（0）', () => {
        const result = validateTreatmentMenu({ name: 'テスト', defaultDuration: 0 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('施術時間は1〜480の整数で入力してください');
    });

    test('UT-TM-008: 時間が範囲外（481）', () => {
        const result = validateTreatmentMenu({ name: 'テスト', defaultDuration: 481 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('施術時間は1〜480の整数で入力してください');
    });

    test('UT-TM-009: 時間が小数', () => {
        const result = validateTreatmentMenu({ name: 'テスト', defaultDuration: 30.5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('施術時間は1〜480の整数で入力してください');
    });

    test('UT-TM-010: 時間がnullは許可', () => {
        const result = validateTreatmentMenu({ name: 'テスト', defaultDuration: null });
        expect(result.valid).toBe(true);
    });

    test('UT-TM-011: 時間が空文字は許可', () => {
        const result = validateTreatmentMenu({ name: 'テスト', defaultDuration: '' });
        expect(result.valid).toBe(true);
    });

    test('UT-TM-012: 境界値（1と480）', () => {
        expect(validateTreatmentMenu({ name: 'テスト', defaultDuration: 1 }).valid).toBe(true);
        expect(validateTreatmentMenu({ name: 'テスト', defaultDuration: 480 }).valid).toBe(true);
    });
});

// ============================================================
// 1.6c メニューマージ
// ============================================================
describe('mergeMenusByName - メニューマージ', () => {
    test('UT-MM-001: 重複なしマージ', () => {
        const existing = [
            { id: 'a', name: 'メニューA', defaultDuration: 60, sortOrder: 0 }
        ];
        const imported = [
            { id: 'b', name: 'メニューB', defaultDuration: 90, sortOrder: 0 }
        ];
        const result = mergeMenusByName(existing, imported);
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('メニューA');
        expect(result[1].name).toBe('メニューB');
    });

    test('UT-MM-002: 名前重複はスキップ', () => {
        const existing = [
            { id: 'a', name: '全身もみほぐし', defaultDuration: 60, sortOrder: 0 }
        ];
        const imported = [
            { id: 'b', name: '全身もみほぐし', defaultDuration: 90, sortOrder: 0 },
            { id: 'c', name: '新メニュー', defaultDuration: 30, sortOrder: 1 }
        ];
        const result = mergeMenusByName(existing, imported);
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('全身もみほぐし');
        expect(result[0].id).toBe('a');
        expect(result[1].name).toBe('新メニュー');
    });

    test('UT-MM-003: sortOrder連番', () => {
        const existing = [
            { id: 'a', name: 'メニューA', defaultDuration: 60, sortOrder: 0 },
            { id: 'b', name: 'メニューB', defaultDuration: 30, sortOrder: 1 }
        ];
        const imported = [
            { id: 'c', name: 'メニューC', defaultDuration: 90, sortOrder: 0 },
            { id: 'd', name: 'メニューD', defaultDuration: 45, sortOrder: 1 }
        ];
        const result = mergeMenusByName(existing, imported);
        expect(result).toHaveLength(4);
        expect(result[2].sortOrder).toBe(2);
        expect(result[3].sortOrder).toBe(3);
    });

    test('UT-MM-004: 空の既存にマージ', () => {
        const result = mergeMenusByName([], [
            { id: 'a', name: 'メニューA', defaultDuration: 60, sortOrder: 0 }
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].sortOrder).toBe(0);
    });

    test('UT-MM-005: IDなしのインポートにはUUIDが割当', () => {
        const result = mergeMenusByName([], [
            { name: 'メニューA', defaultDuration: 60 }
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toMatch(/^[0-9a-f]{8}-/);
    });

    test('UT-MM-006: 元の配列は変更されない', () => {
        const existing = [{ id: 'a', name: 'A', sortOrder: 0 }];
        const imported = [{ id: 'b', name: 'B', sortOrder: 0 }];
        mergeMenusByName(existing, imported);
        expect(existing).toHaveLength(1);
    });
});

// ============================================================
// 1.7 UUID生成
// ============================================================
describe('generateUUID - UUID生成', () => {
    test('UT-UUID-001: UUID形式に一致', () => {
        const uuid = generateUUID();
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test('UT-UUID-002: 2回呼び出しで異なる値', () => {
        const a = generateUUID();
        const b = generateUUID();
        expect(a).not.toBe(b);
    });
});

// ============================================================
// 1.8 フォーマット関数
// ============================================================
describe('formatDateTime - 日時フォーマット', () => {
    test('UT-FMT-001: 正常な日時', () => {
        const result = formatDateTime('2026-02-28T14:30:00');
        expect(result).toBe('2026/02/28 14:30');
    });

    test('UT-FMT-002: 不正な日時', () => {
        expect(formatDateTime('invalid')).toBe('---');
    });
});

describe('formatDateTimeLocal - datetime-local フォーマット', () => {
    test('UT-FMT-003: 正常なDateオブジェクト', () => {
        const result = formatDateTimeLocal(new Date(2026, 1, 28, 14, 30));
        expect(result).toBe('2026-02-28T14:30');
    });
});

describe('formatDate - 日付フォーマット', () => {
    test('UT-FMT-004: 正常な日付', () => {
        expect(formatDate('2026-02-28')).toBe('2026/02/28');
    });

    test('UT-FMT-005: 不正な日付', () => {
        expect(formatDate('invalid')).toBe('---');
    });
});

// ============================================================
// 1.9 HTMLエスケープ
// ============================================================
describe('escapeHtml - HTMLエスケープ', () => {
    test('UT-ESC-001: 特殊文字のエスケープ', () => {
        expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
            '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
        );
    });

    test('UT-ESC-002: アンパサンドのエスケープ', () => {
        expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    test('UT-ESC-003: シングルクォートのエスケープ', () => {
        expect(escapeHtml("it's")).toBe("it&#039;s");
    });

    test('UT-ESC-004: 非文字列入力', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(123)).toBe('');
    });

    test('UT-ESC-005: 通常文字列はそのまま', () => {
        expect(escapeHtml('こんにちは')).toBe('こんにちは');
    });
});

// ============================================================
// 1.10 画像圧縮プリセット
// ============================================================
describe('resolveImagePreset - 画像圧縮プリセット', () => {
    test('UT-IP-001: highプリセット', () => {
        const result = resolveImagePreset('high');
        expect(result).toEqual({ maxLongSide: 2048, jpegQuality: 0.92 });
    });

    test('UT-IP-002: standardプリセット', () => {
        const result = resolveImagePreset('standard');
        expect(result).toEqual({ maxLongSide: 1200, jpegQuality: 0.80 });
    });

    test('UT-IP-003: compactプリセット', () => {
        const result = resolveImagePreset('compact');
        expect(result).toEqual({ maxLongSide: 800, jpegQuality: 0.60 });
    });

    test('UT-IP-004: 未知のプリセットはstandardにフォールバック', () => {
        const result = resolveImagePreset('unknown');
        expect(result).toEqual({ maxLongSide: 1200, jpegQuality: 0.80 });
    });

    test('UT-IP-005: undefinedはstandardにフォールバック', () => {
        const result = resolveImagePreset(undefined);
        expect(result).toEqual({ maxLongSide: 1200, jpegQuality: 0.80 });
    });
});
