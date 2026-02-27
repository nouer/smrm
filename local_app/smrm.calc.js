/**
 * smrm.calc.js - シンプルカルテ管理 計算・ユーティリティロジック（純粋関数）
 * ブラウザ依存なし（DOM操作禁止、IndexedDB禁止）
 */

// ============================================================
// 年齢計算
// ============================================================

/**
 * 生年月日から現在の年齢を計算
 * @param {string} birthDate - "YYYY-MM-DD"形式の生年月日
 * @returns {number} 年齢（整数）
 */
function calcAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age;
}

// ============================================================
// バリデーション関数
// ============================================================

/**
 * 顧客情報バリデーション
 * @param {object} customer - 顧客情報
 * @returns {object} { valid, errors[] }
 */
function validateCustomer(customer) {
    const errors = [];

    // name: 必須、1-100文字
    if (!customer.name || typeof customer.name !== 'string' || customer.name.trim().length === 0) {
        errors.push('氏名を入力してください');
    } else if (customer.name.length > 100) {
        errors.push('氏名は100文字以内で入力してください');
    }

    // birthDate: 任意、入力された場合は過去日付、0-150歳
    if (customer.birthDate != null && customer.birthDate !== '') {
        const birth = new Date(customer.birthDate);
        const today = new Date();
        if (isNaN(birth.getTime())) {
            errors.push('生年月日の形式が不正です');
        } else {
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (customer.birthDate > todayStr) {
                errors.push('生年月日は過去の日付を入力してください');
            } else {
                const age = calcAge(customer.birthDate);
                if (age < 0 || age > 150) {
                    errors.push('生年月日が有効範囲外です（0〜150歳）');
                }
            }
        }
    }

    // gender: 任意、入力された場合は "male"/"female"/"other"
    if (customer.gender != null && customer.gender !== '') {
        if (!['male', 'female', 'other'].includes(customer.gender)) {
            errors.push('性別の値が不正です');
        }
    }

    // nameKana: 任意、ひらがな+長音記号+スペースのみ
    if (customer.nameKana != null && customer.nameKana !== '') {
        if (!/^[\u3040-\u309F\u30FC\u3000\s]+$/.test(customer.nameKana)) {
            errors.push('ふりがなはひらがなで入力してください');
        } else if (customer.nameKana.length > 100) {
            errors.push('ふりがなは100文字以内で入力してください');
        }
    }

    // phone: 任意、半角数字+ハイフン
    if (customer.phone != null && customer.phone !== '') {
        if (!/^[\d-]+$/.test(customer.phone)) {
            errors.push('電話番号は半角数字とハイフンで入力してください');
        } else if (customer.phone.length < 7 || customer.phone.length > 15) {
            errors.push('電話番号は7〜15文字で入力してください');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * 施術記録バリデーション
 * @param {object} record - { chiefComplaint, bodyFindings, treatmentContent, afterNotes }
 * @returns {object} { valid, errors[] }
 */
function validateTreatmentRecord(record) {
    const errors = [];
    const fields = ['chiefComplaint', 'bodyFindings', 'treatmentContent', 'afterNotes'];
    const labels = {
        chiefComplaint: '主訴',
        bodyFindings: '所見',
        treatmentContent: '施術内容',
        afterNotes: '施術後メモ'
    };

    // いずれか1つ以上必須
    const hasAny = fields.some(f => record[f] != null && record[f] !== '' && record[f].trim().length > 0);
    if (!hasAny) {
        errors.push('主訴/所見/施術内容/施術後メモのいずれか1つ以上を入力してください');
    }

    // 各最大2000文字
    for (const f of fields) {
        if (record[f] != null && record[f].length > 2000) {
            errors.push(`${labels[f]}は2000文字以内で入力してください`);
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * 体調レベルバリデーション
 * @param {object} condition - { painLevel, stiffnessLevel, fatigueLevel, areas, notes }
 * @returns {object} { valid, errors[] }
 */
function validateBodyCondition(condition) {
    const errors = [];

    const levels = [
        { key: 'painLevel', label: '痛みレベル' },
        { key: 'stiffnessLevel', label: '凝りレベル' },
        { key: 'fatigueLevel', label: '疲労レベル' }
    ];

    for (const { key, label } of levels) {
        if (condition[key] != null && condition[key] !== '') {
            const v = Number(condition[key]);
            if (isNaN(v) || v < 0 || v > 10 || !Number.isInteger(v)) {
                errors.push(`${label}は0〜10の整数で入力してください`);
            }
        }
    }

    // areas: 任意、配列
    if (condition.areas != null && !Array.isArray(condition.areas)) {
        errors.push('気になる部位の形式が不正です');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * インポートデータバリデーション
 * @param {object} data - インポートデータ
 * @returns {object} { valid, error? }
 */
function validateImportData(data) {
    if (typeof data !== 'object' || data === null) {
        return { valid: false, error: 'JSONオブジェクト形式ではありません' };
    }
    if (data.appName !== 'smrm') {
        return { valid: false, error: 'このファイルはsmrm形式ではありません' };
    }
    if (!Array.isArray(data.customers)) {
        return { valid: false, error: 'customersフィールドが不正です' };
    }
    if (!Array.isArray(data.treatmentRecords)) {
        return { valid: false, error: 'treatmentRecordsフィールドが不正です' };
    }
    if (data.treatmentMenus !== undefined && !Array.isArray(data.treatmentMenus)) {
        return { valid: false, error: 'treatmentMenusフィールドが不正です' };
    }
    return { valid: true };
}

/**
 * 施術メニューバリデーション
 * @param {object} menu - { name, defaultDuration }
 * @returns {object} { valid, errors[] }
 */
function validateTreatmentMenu(menu) {
    const errors = [];

    if (!menu.name || typeof menu.name !== 'string' || menu.name.trim().length === 0) {
        errors.push('メニュー名を入力してください');
    } else if (menu.name.length > 100) {
        errors.push('メニュー名は100文字以内で入力してください');
    }

    if (menu.defaultDuration != null && menu.defaultDuration !== '') {
        const d = Number(menu.defaultDuration);
        if (isNaN(d) || !Number.isInteger(d) || d < 1 || d > 480) {
            errors.push('施術時間は1〜480の整数で入力してください');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * メニューを名前ベースでマージ（インポート用）
 * @param {Array} existing - 既存メニュー配列
 * @param {Array} imported - インポートされたメニュー配列
 * @returns {Array} マージ済みメニュー配列
 */
function mergeMenusByName(existing, imported) {
    const result = existing.map(m => ({ ...m }));
    const existingNames = new Set(result.map(m => m.name));
    let maxSortOrder = result.length > 0
        ? Math.max(...result.map(m => typeof m.sortOrder === 'number' ? m.sortOrder : -1))
        : -1;

    for (const imp of imported) {
        if (existingNames.has(imp.name)) continue;
        maxSortOrder++;
        result.push({
            id: imp.id || generateUUID(),
            name: imp.name,
            defaultDuration: imp.defaultDuration != null ? imp.defaultDuration : null,
            sortOrder: maxSortOrder
        });
        existingNames.add(imp.name);
    }

    return result;
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * UUID v4 生成
 * @returns {string}
 */
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 顧客コード自動生成
 * @param {string[]} existingCodes - 既存顧客コードの配列
 * @returns {string} 次の顧客コード（"C"+4桁ゼロ埋め）
 */
function generateCustomerCode(existingCodes) {
    if (!existingCodes || existingCodes.length === 0) return 'C0001';
    const numbers = existingCodes
        .filter(code => /^C\d{4}$/.test(code))
        .map(code => parseInt(code.substring(1), 10));
    if (numbers.length === 0) return 'C0001';
    const maxNum = Math.max(...numbers);
    const nextNum = maxNum + 1;
    if (nextNum > 9999) throw new Error('顧客コードが上限に達しました');
    return 'C' + String(nextNum).padStart(4, '0');
}

/**
 * 日時を "YYYY/MM/DD HH:MM" 形式にフォーマット
 * @param {string|Date} dateStr - 日時文字列またはDateオブジェクト
 * @returns {string}
 */
function formatDateTime(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 日時を "YYYY-MM-DDTHH:MM" 形式にフォーマット（datetime-local input用）
 * @param {Date} date - Dateオブジェクト
 * @returns {string}
 */
function formatDateTimeLocal(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 日付を "YYYY/MM/DD" 形式にフォーマット
 * @param {string|Date} dateStr - 日付文字列またはDateオブジェクト
 * @returns {string}
 */
function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * HTML特殊文字エスケープ
 * @param {string} str - エスケープ対象文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 画像圧縮プリセットを解決
 * @param {string} preset - "high" | "standard" | "compact"
 * @returns {{ maxLongSide: number, jpegQuality: number }}
 */
function resolveImagePreset(preset) {
    const presets = {
        high:     { maxLongSide: 2048, jpegQuality: 0.92 },
        standard: { maxLongSide: 1200, jpegQuality: 0.80 },
        compact:  { maxLongSide: 800,  jpegQuality: 0.60 }
    };
    return presets[preset] || presets.standard;
}

// ============================================================
// Node.js 環境（テスト用）でのエクスポート
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcAge,
        validateCustomer, validateTreatmentRecord, validateBodyCondition, validateImportData,
        validateTreatmentMenu, mergeMenusByName,
        generateUUID, generateCustomerCode,
        formatDateTime, formatDateTimeLocal, formatDate,
        escapeHtml,
        resolveImagePreset
    };
}
