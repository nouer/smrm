/**
 * script.js - シンプルカルテ管理 (SMRM) メインロジック
 */
const DB_NAME = 'smrm_db';
const DB_VERSION = 1;
const MEDIA_MAX_PER_RECORD = 5;
const MEDIA_MAX_LONG_SIDE = 1200;
const MEDIA_JPEG_QUALITY = 0.8;
const MEDIA_THUMB_SIZE = 200;
const MEDIA_THUMB_QUALITY = 0.6;
let currentImageSettings = null;

// ===== IndexedDB 操作 =====

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('customers')) {
                const cStore = db.createObjectStore('customers', { keyPath: 'id' });
                cStore.createIndex('name', 'name', { unique: false });
                cStore.createIndex('nameKana', 'nameKana', { unique: false });
                cStore.createIndex('customerCode', 'customerCode', { unique: false });
            }

            if (!db.objectStoreNames.contains('treatment_records')) {
                const tStore = db.createObjectStore('treatment_records', { keyPath: 'id' });
                tStore.createIndex('customerId', 'customerId', { unique: false });
                tStore.createIndex('visitedAt', 'visitedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('media')) {
                const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
                mediaStore.createIndex('parentId', 'parentId', { unique: false });
                mediaStore.createIndex('parentType', 'parentType', { unique: false });
            }

            if (!db.objectStoreNames.contains('app_settings')) {
                db.createObjectStore('app_settings', { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function addToStore(storeName, record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(record);
        request.onsuccess = () => resolve(record.id);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function updateInStore(storeName, record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getFromStore(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getAllFromStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteFromStore(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function clearStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getByIndex(storeName, indexName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// ===== ストア名定数 =====

const CUSTOMERS_STORE = 'customers';
const TREATMENT_RECORDS_STORE = 'treatment_records';
const MEDIA_STORE = 'media';
const APP_SETTINGS_STORE = 'app_settings';

// ===== 表示設定 =====

function getDefaultDisplaySettings() {
    return {
        id: 'display_settings',
        fields: {
            customer: { code: true, kana: true, phone: true, email: true, address: true, occupation: true, firstVisit: true, practitioner: true, memo: true, allergies: true, histories: true, photo: true },
            treatment: { menu: true, duration: true, bodyCondition: true, photo: true }
        }
    };
}

async function loadDisplaySettings() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(APP_SETTINGS_STORE, 'readonly');
            const store = tx.objectStore(APP_SETTINGS_STORE);
            const request = store.get('display_settings');
            request.onsuccess = () => resolve(request.result || getDefaultDisplaySettings());
            request.onerror = () => resolve(getDefaultDisplaySettings());
        });
    } catch (e) {
        return getDefaultDisplaySettings();
    }
}

async function saveDisplaySettings(settings) {
    settings.id = 'display_settings';
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(APP_SETTINGS_STORE, 'readwrite');
        tx.objectStore(APP_SETTINGS_STORE).put(settings);
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

// ===== 画像圧縮設定 =====

function getDefaultImageSettings() {
    return { id: 'image_settings', preset: 'standard' };
}

async function loadImageSettings() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(APP_SETTINGS_STORE, 'readonly');
            const store = tx.objectStore(APP_SETTINGS_STORE);
            const request = store.get('image_settings');
            request.onsuccess = () => resolve(request.result || getDefaultImageSettings());
            request.onerror = () => resolve(getDefaultImageSettings());
        });
    } catch (e) {
        return getDefaultImageSettings();
    }
}

async function saveImageSettings(settings) {
    settings.id = 'image_settings';
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(APP_SETTINGS_STORE, 'readwrite');
        tx.objectStore(APP_SETTINGS_STORE).put(settings);
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event.target.error);
    });
}

// ===== 施術メニュー管理 =====

async function loadTreatmentMenus() {
    try {
        const data = await getFromStore(APP_SETTINGS_STORE, 'treatment_menus');
        return (data && Array.isArray(data.menus)) ? data.menus : [];
    } catch (e) {
        return [];
    }
}

async function saveTreatmentMenus(menus) {
    await updateInStore(APP_SETTINGS_STORE, { id: 'treatment_menus', menus });
}

function populateMenuDropdown(selectId, selectedMenuId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const menus = select._menuCache || [];
    select.innerHTML = '<option value="">選択してください</option>';
    menus.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    for (const menu of menus) {
        const option = document.createElement('option');
        option.value = menu.id;
        option.textContent = menu.name;
        option.dataset.defaultDuration = menu.defaultDuration || '';
        if (menu.id === selectedMenuId) option.selected = true;
        select.appendChild(option);
    }
}

async function refreshMenuDropdowns(selectedMenuId) {
    const menus = await loadTreatmentMenus();
    const selectIds = ['input-treatment-menu', 'edit-treatment-menu'];
    for (const id of selectIds) {
        const select = document.getElementById(id);
        if (select) {
            select._menuCache = menus;
            populateMenuDropdown(id, id === 'input-treatment-menu' ? undefined : selectedMenuId);
        }
    }
}

function initMenuDropdownDurationSync(selectId, durationId) {
    const select = document.getElementById(selectId);
    const durationInput = document.getElementById(durationId);
    if (!select || !durationInput) return;
    select.addEventListener('change', () => {
        const selected = select.options[select.selectedIndex];
        if (selected && selected.dataset.defaultDuration && !durationInput.value) {
            durationInput.value = selected.dataset.defaultDuration;
        }
    });
}

function addMenuSettingsRow(menu) {
    const container = document.getElementById('menu-settings-list');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'dynamic-row menu-settings-row';
    row.dataset.menuId = (menu && menu.id) || '';
    const name = (menu && menu.name) || '';
    const duration = (menu && menu.defaultDuration) || '';
    row.innerHTML = `<input type="text" class="menu-name-input" placeholder="メニュー名" value="${escapeHtml(name)}">
        <input type="number" class="menu-duration-input" placeholder="時間(分)" min="1" max="480" value="${duration !== null ? escapeHtml(String(duration)) : ''}">
        <button type="button" class="btn btn-sm btn-danger" onclick="removeMenuSettingsRow(this)">✕</button>`;
    container.appendChild(row);
    row.querySelector('.menu-name-input').addEventListener('input', scheduleMenuSettingsSave);
    row.querySelector('.menu-duration-input').addEventListener('input', scheduleMenuSettingsSave);
}

function removeMenuSettingsRow(btn) {
    const row = btn.closest('.menu-settings-row');
    if (row) row.remove();
    scheduleMenuSettingsSave();
}

let menuSettingsSaveTimer = null;
function scheduleMenuSettingsSave() {
    if (menuSettingsSaveTimer) clearTimeout(menuSettingsSaveTimer);
    menuSettingsSaveTimer = setTimeout(collectAndSaveMenuSettings, 500);
}

async function collectAndSaveMenuSettings() {
    const rows = document.querySelectorAll('#menu-settings-list .menu-settings-row');
    const menus = [];
    let sortOrder = 0;
    rows.forEach(row => {
        const name = row.querySelector('.menu-name-input').value.trim();
        if (!name) return;
        const durationVal = row.querySelector('.menu-duration-input').value;
        const duration = durationVal ? Number(durationVal) : null;
        menus.push({
            id: row.dataset.menuId || generateUUID(),
            name,
            defaultDuration: duration,
            sortOrder: sortOrder++
        });
    });
    await saveTreatmentMenus(menus);
    await refreshMenuDropdowns();
}

async function initMenuSettings() {
    const menus = await loadTreatmentMenus();
    const container = document.getElementById('menu-settings-list');
    if (container) container.innerHTML = '';
    menus.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    for (const menu of menus) {
        addMenuSettingsRow(menu);
    }
}

// ===== ドメインヘルパー関数 =====

async function getAllCustomers() {
    return getAllFromStore('customers');
}

async function addCustomer(customer) {
    return addToStore('customers', customer);
}

async function getRecord(id) {
    return getFromStore('treatment_records', id);
}

async function addRecord(record) {
    return addToStore('treatment_records', record);
}

async function getRecordsByCustomer(customerId) {
    return getByIndex('treatment_records', 'customerId', customerId);
}

// ===== メディア関連関数 =====

function resizeImage(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxSide || height > maxSide) {
                if (width > height) {
                    height = Math.round(height * maxSide / width);
                    width = maxSide;
                } else {
                    width = Math.round(width * maxSide / height);
                    height = maxSide;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('画像の読み込みに失敗しました'));
        };
        img.src = url;
    });
}

async function createMediaRecord(file, parentId, parentType) {
    const dataUrl = await resizeImage(file, MEDIA_MAX_LONG_SIDE, MEDIA_JPEG_QUALITY);
    const thumbnail = await resizeImage(file, MEDIA_THUMB_SIZE, MEDIA_THUMB_QUALITY);
    return {
        id: generateUUID(),
        parentId,
        parentType,
        fileName: file.name,
        mimeType: 'image/jpeg',
        dataUrl,
        thumbnail,
        memo: '',
        createdAt: new Date().toISOString()
    };
}

async function saveMedia(mediaRecord) {
    return addToStore('media', mediaRecord);
}

async function getMediaByParent(parentId) {
    return getByIndex('media', 'parentId', parentId);
}

async function deleteMedia(mediaId) {
    return deleteFromStore('media', mediaId);
}

async function deleteMediaByParent(parentId) {
    const items = await getMediaByParent(parentId);
    for (const item of items) {
        await deleteFromStore('media', item.id);
    }
}

// ===== メディアUI: ステージング管理 =====

let mediaStagingBuffers = {
    treatment_record: [],
    customer: [],
    edit_treatment_record: []
};

function clearMediaStaging(parentType) {
    mediaStagingBuffers[parentType] = [];
}

async function stageMediaFiles(files, parentType, containerEl) {
    const current = mediaStagingBuffers[parentType];
    const imgPreset = resolveImagePreset((currentImageSettings || getDefaultImageSettings()).preset);
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (current.length >= MEDIA_MAX_PER_RECORD) {
            showMessage(containerEl.dataset.messageId || 'record-message',
                `写真は最大${MEDIA_MAX_PER_RECORD}枚までです`, 'error');
            break;
        }
        try {
            const dataUrl = await resizeImage(file, imgPreset.maxLongSide, imgPreset.jpegQuality);
            const thumbnail = await resizeImage(file, MEDIA_THUMB_SIZE, MEDIA_THUMB_QUALITY);
            current.push({
                id: generateUUID(),
                fileName: file.name,
                mimeType: 'image/jpeg',
                dataUrl,
                thumbnail,
                memo: '',
                createdAt: new Date().toISOString()
            });
        } catch (e) {
            // 画像読み込み失敗は無視
        }
    }
    renderMediaStaging(parentType, containerEl);
}

function renderMediaStaging(parentType, containerEl) {
    const items = mediaStagingBuffers[parentType];
    const grid = containerEl.querySelector('.media-thumb-grid');
    if (!grid) return;

    const savedThumbs = grid.querySelectorAll('.media-thumb-item[data-saved]');
    grid.innerHTML = '';
    savedThumbs.forEach(el => grid.appendChild(el));

    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'media-thumb-item';
        div.innerHTML = `<img src="${item.thumbnail}" alt="${escapeHtml(item.fileName)}" onclick="openMediaLightbox('${item.id}', 'staging', '${parentType}')">
            <button type="button" class="media-thumb-remove" onclick="removeStagedMedia('${parentType}', ${idx}, this)">&times;</button>`;
        grid.appendChild(div);
    });
}

function removeStagedMedia(parentType, index, btnEl) {
    mediaStagingBuffers[parentType].splice(index, 1);
    const container = btnEl.closest('.media-attach-area');
    if (container) renderMediaStaging(parentType, container);
}

function renderSavedMedia(mediaItems, containerEl) {
    const grid = containerEl.querySelector('.media-thumb-grid');
    if (!grid) return;
    grid.innerHTML = '';
    mediaItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'media-thumb-item';
        div.dataset.saved = 'true';
        div.dataset.mediaId = item.id;
        div.innerHTML = `<img src="${item.thumbnail}" alt="${escapeHtml(item.fileName)}" onclick="openMediaLightbox('${item.id}', 'saved')">
            <button type="button" class="media-thumb-remove" onclick="deleteSavedMedia('${item.id}', this)">&times;</button>`;
        grid.appendChild(div);
    });
}

async function deleteSavedMedia(mediaId, btnEl) {
    await deleteMedia(mediaId);
    const thumbItem = btnEl.closest('.media-thumb-item');
    if (thumbItem) thumbItem.remove();
}

async function commitStagedMedia(parentId, parentType, stagingKey) {
    const key = stagingKey || parentType;
    const items = mediaStagingBuffers[key];
    for (const item of items) {
        await saveMedia({
            ...item,
            parentId,
            parentType
        });
    }
    clearMediaStaging(key);
}

function openMediaLightbox(mediaId, source, parentType) {
    let dataUrl = null;
    if (source === 'staging' && parentType) {
        const item = mediaStagingBuffers[parentType].find(m => m.id === mediaId);
        if (item) dataUrl = item.dataUrl;
    }
    if (dataUrl) {
        showLightbox(dataUrl);
    } else {
        getFromStore('media', mediaId).then(item => {
            if (item) showLightbox(item.dataUrl);
        });
    }
}

function showLightbox(dataUrl) {
    const overlay = document.getElementById('media-lightbox-overlay');
    const img = document.getElementById('media-lightbox-img');
    if (!overlay || !img) return;
    img.src = dataUrl;
    overlay.classList.add('show');
}

function closeLightbox() {
    const overlay = document.getElementById('media-lightbox-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        document.getElementById('media-lightbox-img').src = '';
    }
}

function initMediaAttachArea(containerEl, parentType) {
    const fileInput = containerEl.querySelector('.media-file-input');
    const dropZone = containerEl.querySelector('.media-drop-zone');
    if (!fileInput || !dropZone) return;

    fileInput.addEventListener('change', async () => {
        if (fileInput.files.length > 0) {
            await stageMediaFiles(Array.from(fileInput.files), parentType, containerEl);
            fileInput.value = '';
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            await stageMediaFiles(files, parentType, containerEl);
        }
    });
}

async function renderCustomerList() {
    await loadCustomers();
}

// ===== アプリケーション状態 =====

let selectedCustomerId = null;
let selectedCustomer = null;
let historySortDesc = true;
let historyPage = 1;
const HISTORY_PAGE_SIZE = 20;

const GENDER_MAP = { male: '男性', female: '女性', other: 'その他' };

// ===== UI ユーティリティ =====

function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    el.textContent = text;
    el.className = `message show ${type}`;
    setTimeout(() => {
        el.classList.remove('show');
    }, 3000);
}

function showConfirm(title, message, okText = '実行', okClass = 'btn-danger') {
    return new Promise((resolve) => {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-ok').textContent = okText;
        document.getElementById('confirm-ok').className = `btn ${okClass}`;
        document.getElementById('confirm-overlay').classList.add('show');
        document.getElementById('confirm-ok').onclick = () => {
            document.getElementById('confirm-overlay').classList.remove('show');
            resolve(true);
        };
        document.getElementById('confirm-cancel').onclick = () => {
            document.getElementById('confirm-overlay').classList.remove('show');
            resolve(false);
        };
    });
}

// ===== 顧客管理 =====

async function loadCustomers() {
    const customers = await getAllFromStore('customers');
    customers.sort((a, b) => (a.customerCode || '').localeCompare(b.customerCode || ''));
    const container = document.getElementById('customer-list');

    if (customers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>顧客が登録されていません</p></div>';
        return;
    }

    const allCustomerMedia = await getByIndex('media', 'parentType', 'customer');
    const mediaByCustomer = {};
    for (const m of allCustomerMedia) {
        if (!mediaByCustomer[m.parentId]) mediaByCustomer[m.parentId] = m;
    }

    container.innerHTML = customers.map(c => renderCustomerCard(c, mediaByCustomer[c.id])).join('');
}

function renderCustomerCard(customer, media) {
    const age = customer.birthDate ? calcAge(customer.birthDate) : null;
    const gender = GENDER_MAP[customer.gender] || '';
    const allergyBadge = (customer.allergies && customer.allergies.length > 0)
        ? '<span class="badge badge-danger">アレルギー有</span>'
        : '';
    const isSelected = selectedCustomerId === customer.id ? ' selected' : '';
    const metaParts = [];
    if (age != null) metaParts.push(`${age}歳`);
    if (gender) metaParts.push(gender);
    const metaText = metaParts.join(' / ');
    const initial = customer.name ? customer.name.charAt(0) : '?';
    const thumbHtml = media
        ? `<img src="${media.thumbnail}" alt="" class="customer-card-thumb">`
        : `<span class="customer-card-thumb customer-card-initial">${escapeHtml(initial)}</span>`;

    return `<div class="customer-card${isSelected}" data-customer-id="${customer.id}" onclick="selectCustomer('${customer.id}')">
        ${thumbHtml}
        <div class="customer-card-header">
            <span class="customer-code">${escapeHtml(customer.customerCode || '---')}</span>
            ${allergyBadge}
        </div>
        <div class="customer-card-body">
            <span class="customer-name">${escapeHtml(customer.name)}</span>
            ${metaText ? `<span class="customer-meta">${metaText}</span>` : ''}
        </div>
        <div class="customer-card-actions">
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openCustomerDetail('${customer.id}')">詳細</button>
            <button class="btn btn-sm" onclick="event.stopPropagation(); openCustomerForm('${customer.id}')">編集</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteCustomer('${customer.id}')">削除</button>
        </div>
    </div>`;
}

async function selectCustomer(customerId) {
    const customer = await getFromStore('customers', customerId);
    if (!customer) return;

    selectedCustomerId = customerId;
    selectedCustomer = customer;

    await updateCustomerBars();
    showAllergyWarning();

    document.getElementById('no-customer-selected').style.display = 'none';
    document.getElementById('treatment-content').style.display = '';

    document.getElementById('no-customer-history').style.display = 'none';
    document.getElementById('history-content').style.display = '';

    document.querySelectorAll('.customer-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.customerId === customerId);
    });

    resetTreatmentForm();
    await loadRecentRecords();
    showPrevAfterNotesHint();

    const treatmentBtn = document.querySelector('#tab-nav button[data-tab="treatment"]');
    if (treatmentBtn) treatmentBtn.click();
}

function deselectCustomer() {
    selectedCustomerId = null;
    selectedCustomer = null;

    document.getElementById('no-customer-selected').style.display = '';
    document.getElementById('treatment-content').style.display = 'none';

    document.getElementById('no-customer-history').style.display = '';
    document.getElementById('history-content').style.display = 'none';

    document.getElementById('allergy-warning').style.display = 'none';

    document.querySelectorAll('.customer-card').forEach(card => {
        card.classList.remove('selected');
    });
}

async function updateCustomerBars() {
    if (!selectedCustomer) return;

    const age = selectedCustomer.birthDate ? calcAge(selectedCustomer.birthDate) : null;
    const gender = GENDER_MAP[selectedCustomer.gender] || '';
    const metaParts = [];
    if (age != null) metaParts.push(`${age}歳`);
    if (gender) metaParts.push(gender);
    const metaText = metaParts.join(' / ');

    const customerMedia = await getMediaByParent(selectedCustomer.id);
    const photoHtml = customerMedia.length > 0
        ? `<div class="media-inline-thumbs" data-field-key="customer.photo">${customerMedia.map(m =>
            `<img src="${m.thumbnail}" alt="${escapeHtml(m.fileName)}" onclick="openMediaLightbox('${m.id}', 'saved')">`
        ).join('')}</div>`
        : '';

    const barHtml = `<span class="customer-bar-code">${escapeHtml(selectedCustomer.customerCode || '---')}</span>
        <span class="customer-bar-name">${escapeHtml(selectedCustomer.name)}</span>
        ${metaText ? `<span class="customer-bar-meta">${metaText}</span>` : ''}
        ${photoHtml}`;

    const barIds = ['selected-customer-bar', 'history-customer-bar'];
    barIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = barHtml;
    });

    // 表示設定を再適用
    const settings = await loadDisplaySettings();
    applyDisplaySettings(settings);
}

function showAllergyWarning() {
    const warningEl = document.getElementById('allergy-warning');
    if (!selectedCustomer || !selectedCustomer.allergies || selectedCustomer.allergies.length === 0) {
        warningEl.style.display = 'none';
        return;
    }

    const allergens = selectedCustomer.allergies
        .map(a => escapeHtml(a.allergen || a))
        .join('、');
    warningEl.innerHTML = `<strong>アレルギー:</strong> ${allergens}`;
    warningEl.style.display = '';
}

function detailRow(label, value, fieldKey) {
    const attr = fieldKey ? ` data-field-key="${fieldKey}"` : '';
    return `<div class="detail-row"${attr}>
        <dt>${escapeHtml(label)}</dt>
        <dd>${value ? escapeHtml(String(value)) : '<span class="text-muted">---</span>'}</dd>
    </div>`;
}

async function openCustomerDetail(customerId) {
    const customer = await getFromStore('customers', customerId);
    if (!customer) return;

    const overlay = document.getElementById('customer-detail-overlay');
    overlay.dataset.customerId = customerId;
    const body = document.getElementById('customer-detail-body');

    const age = customer.birthDate ? calcAge(customer.birthDate) : null;
    const gender = GENDER_MAP[customer.gender] || '';
    const birthDisplay = customer.birthDate
        ? formatDate(customer.birthDate) + (age != null ? ` (${age}歳)` : '')
        : '';

    let html = '';

    // 基本情報
    html += '<div class="detail-section">';
    html += '<h4>基本情報</h4>';
    html += '<dl class="detail-dl">';
    html += detailRow('顧客コード', customer.customerCode, 'customer.code');
    html += detailRow('氏名', customer.name);
    html += detailRow('ふりがな', customer.nameKana, 'customer.kana');
    html += detailRow('生年月日', birthDisplay);
    html += detailRow('性別', gender);
    html += '</dl></div>';

    // 連絡先
    html += '<div class="detail-section">';
    html += '<h4>連絡先</h4>';
    html += '<dl class="detail-dl">';
    html += detailRow('電話番号', customer.phone, 'customer.phone');
    html += detailRow('メール', customer.email, 'customer.email');
    html += detailRow('住所', customer.address, 'customer.address');
    html += '</dl></div>';

    // 来店情報
    html += '<div class="detail-section">';
    html += '<h4>来店情報</h4>';
    html += '<dl class="detail-dl">';
    html += detailRow('職業', customer.occupation, 'customer.occupation');
    html += detailRow('紹介元', customer.referralSource);
    html += detailRow('来店動機', customer.visitMotivation);
    html += detailRow('初回来店日', customer.firstVisitDate ? formatDate(customer.firstVisitDate) : '', 'customer.firstVisit');
    html += detailRow('担当施術者', customer.practitioner, 'customer.practitioner');
    html += '</dl></div>';

    // 備考
    if (customer.memo) {
        html += `<div class="detail-section" data-field-key="customer.memo">`;
        html += '<h4>備考</h4>';
        html += `<p class="detail-memo">${escapeHtml(customer.memo)}</p>`;
        html += '</div>';
    } else {
        html += `<div class="detail-section" data-field-key="customer.memo">`;
        html += '<h4>備考</h4>';
        html += '<p class="detail-note">---</p>';
        html += '</div>';
    }

    // アレルギー
    const severityMap = { mild: '軽度', moderate: '中等度', severe: '重度' };
    const severityBadge = { mild: 'badge-success', moderate: 'badge-warning', severe: 'badge-danger' };
    html += `<div class="detail-section" data-field-key="customer.allergies">`;
    html += '<h4>アレルギー情報</h4>';
    if (customer.allergies && customer.allergies.length > 0) {
        html += '<ul class="detail-tag-list">';
        customer.allergies.forEach(a => {
            const allergen = typeof a === 'string' ? a : (a.allergen || '');
            const severity = typeof a === 'object' ? a.severity : '';
            const sevLabel = severityMap[severity] || '';
            const sevClass = severityBadge[severity] || '';
            const sevHtml = sevLabel ? ` <span class="badge ${sevClass}">${sevLabel}</span>` : '';
            html += `<li>${escapeHtml(allergen)}${sevHtml}</li>`;
        });
        html += '</ul>';
    } else {
        html += '<p class="detail-note">登録なし</p>';
    }
    html += '</div>';

    // 既往歴
    html += `<div class="detail-section" data-field-key="customer.histories">`;
    html += '<h4>既往歴</h4>';
    if (customer.medicalHistory && customer.medicalHistory.length > 0) {
        html += '<ul class="detail-tag-list">';
        customer.medicalHistory.forEach(h => {
            const text = typeof h === 'string' ? h : (h.condition || '');
            html += `<li>${escapeHtml(text)}</li>`;
        });
        html += '</ul>';
    } else {
        html += '<p class="detail-note">登録なし</p>';
    }
    html += '</div>';

    // 写真
    const customerMedia = await getMediaByParent(customerId);
    if (customerMedia.length > 0) {
        html += `<div class="detail-section" data-field-key="customer.photo">`;
        html += '<h4>写真</h4>';
        html += '<div class="media-inline-thumbs">';
        customerMedia.forEach(m => {
            html += `<img src="${m.thumbnail}" alt="${escapeHtml(m.fileName)}" onclick="openMediaLightbox('${m.id}', 'saved')">`;
        });
        html += '</div></div>';
    }

    // メタ情報
    html += '<div class="detail-section detail-meta-section">';
    if (customer.createdAt) {
        html += `<span class="detail-meta-text">登録日: ${formatDateTime(customer.createdAt)}</span>`;
    }
    if (customer.updatedAt) {
        html += `<span class="detail-meta-text">更新日: ${formatDateTime(customer.updatedAt)}</span>`;
    }
    html += '</div>';

    body.innerHTML = html;

    // 表示設定を適用
    const settings = await loadDisplaySettings();
    applyDisplaySettings(settings);

    overlay.classList.add('show');
}

async function openCustomerForm(customerId) {
    const overlay = document.getElementById('customer-form-overlay');
    const title = document.getElementById('customer-form-title');
    const form = document.getElementById('customer-form');

    form.reset();
    document.getElementById('edit-customer-id').value = '';
    document.getElementById('allergy-list-form').innerHTML = '';
    document.getElementById('history-list-form').innerHTML = '';

    if (customerId) {
        const customer = await getFromStore('customers', customerId);
        if (!customer) return;

        title.textContent = '顧客情報を編集';
        document.getElementById('edit-customer-id').value = customer.id;
        document.getElementById('input-customer-code').value = customer.customerCode || '';
        document.getElementById('input-customer-name').value = customer.name || '';
        document.getElementById('input-customer-kana').value = customer.nameKana || '';
        document.getElementById('input-customer-birth').value = customer.birthDate || '';
        document.getElementById('input-customer-gender').value = customer.gender || '';
        document.getElementById('input-customer-phone').value = customer.phone || '';
        document.getElementById('input-customer-email').value = customer.email || '';
        document.getElementById('input-customer-occupation').value = customer.occupation || '';
        document.getElementById('input-customer-address').value = customer.address || '';
        document.getElementById('input-customer-referral').value = customer.referralSource || '';
        document.getElementById('input-customer-motivation').value = customer.visitMotivation || '';
        document.getElementById('input-customer-first-visit').value = customer.firstVisitDate || '';
        document.getElementById('input-customer-practitioner').value = customer.practitioner || '';
        document.getElementById('input-customer-memo').value = customer.memo || '';

        if (customer.allergies && customer.allergies.length > 0) {
            customer.allergies.forEach(a => addAllergyRow(a));
        }

        if (customer.medicalHistory && customer.medicalHistory.length > 0) {
            customer.medicalHistory.forEach(h => addHistoryRow(h));
        }

        clearMediaStaging('customer');
        const customerMediaArea = document.getElementById('customer-media-area');
        if (customerMediaArea) {
            const customerMedia = await getMediaByParent(customer.id);
            renderSavedMedia(customerMedia, customerMediaArea);
        }
    } else {
        title.textContent = '新規顧客登録';
        clearMediaStaging('customer');
        const customerMediaArea = document.getElementById('customer-media-area');
        if (customerMediaArea) {
            const grid = customerMediaArea.querySelector('.media-thumb-grid');
            if (grid) grid.innerHTML = '';
        }
    }

    overlay.classList.add('show');
}

function addAllergyRow(allergy) {
    const container = document.getElementById('allergy-list-form');
    const row = document.createElement('div');
    row.className = 'dynamic-row allergy-row';

    const allergen = (typeof allergy === 'string') ? allergy : (allergy && allergy.allergen) || '';
    const severity = (typeof allergy === 'object' && allergy && allergy.severity) || '';
    const note = (typeof allergy === 'object' && allergy && allergy.note) || '';

    row.innerHTML = `<input type="text" class="allergy-allergen" placeholder="アレルゲン" value="${escapeHtml(allergen)}">
        <select class="allergy-severity">
            <option value="">重症度</option>
            <option value="mild"${severity === 'mild' ? ' selected' : ''}>軽度</option>
            <option value="moderate"${severity === 'moderate' ? ' selected' : ''}>中等度</option>
            <option value="severe"${severity === 'severe' ? ' selected' : ''}>重度</option>
        </select>
        <input type="text" class="allergy-note" placeholder="備考" value="${escapeHtml(note)}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(row);
}

function addHistoryRow(history) {
    const container = document.getElementById('history-list-form');
    const row = document.createElement('div');
    row.className = 'dynamic-row history-row';

    const condition = (typeof history === 'string') ? history : (history && history.condition) || '';
    const note = (typeof history === 'object' && history && history.note) || '';

    row.innerHTML = `<input type="text" class="history-condition" placeholder="疾患・状態" value="${escapeHtml(condition)}">
        <input type="text" class="history-note" placeholder="備考" value="${escapeHtml(note)}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(row);
}

function collectAllergies() {
    const rows = document.querySelectorAll('#allergy-list-form .allergy-row');
    const allergies = [];
    rows.forEach(row => {
        const allergen = row.querySelector('.allergy-allergen').value.trim();
        if (!allergen) return;
        allergies.push({
            allergen: allergen,
            severity: row.querySelector('.allergy-severity').value || null,
            note: row.querySelector('.allergy-note').value.trim() || null
        });
    });
    return allergies;
}

function collectMedicalHistory() {
    const rows = document.querySelectorAll('#history-list-form .history-row');
    const histories = [];
    rows.forEach(row => {
        const condition = row.querySelector('.history-condition').value.trim();
        if (!condition) return;
        histories.push({
            condition: condition,
            note: row.querySelector('.history-note').value.trim() || null
        });
    });
    return histories;
}

async function saveCustomer(event) {
    event.preventDefault();

    const editId = document.getElementById('edit-customer-id').value;
    const name = document.getElementById('input-customer-name').value.trim();
    const nameKana = document.getElementById('input-customer-kana').value.trim() || null;
    const birthDate = document.getElementById('input-customer-birth').value || null;
    const gender = document.getElementById('input-customer-gender').value || null;
    const phone = document.getElementById('input-customer-phone').value.trim() || null;
    const email = document.getElementById('input-customer-email').value.trim() || null;
    const occupation = document.getElementById('input-customer-occupation').value.trim() || null;
    const address = document.getElementById('input-customer-address').value.trim() || null;
    const referralSource = document.getElementById('input-customer-referral').value.trim() || null;
    const visitMotivation = document.getElementById('input-customer-motivation').value.trim() || null;
    const firstVisitDate = document.getElementById('input-customer-first-visit').value || null;
    const practitioner = document.getElementById('input-customer-practitioner').value.trim() || null;
    const memo = document.getElementById('input-customer-memo').value.trim() || null;
    let customerCode = document.getElementById('input-customer-code').value.trim() || null;

    const allergies = collectAllergies();
    const medicalHistory = collectMedicalHistory();

    const validation = validateCustomer({ name, nameKana, birthDate, gender, phone });
    if (!validation.valid) {
        showMessage('customer-form-message', validation.errors[0], 'error');
        return;
    }

    const now = new Date().toISOString();

    try {
        if (editId) {
            const existing = await getFromStore('customers', editId);
            if (!existing) return;

            const updated = {
                ...existing,
                name, nameKana, birthDate, gender, phone, email, occupation,
                address, referralSource, visitMotivation,
                firstVisitDate, practitioner, memo,
                customerCode: customerCode || existing.customerCode,
                allergies, medicalHistory,
                updatedAt: now
            };

            await updateInStore('customers', updated);
            await commitStagedMedia(editId, 'customer');
            showMessage('customer-form-message', '顧客情報を更新しました', 'success');
        } else {
            if (!customerCode) {
                const allCustomers = await getAllFromStore('customers');
                const existingCodes = allCustomers.map(c => c.customerCode).filter(Boolean);
                customerCode = generateCustomerCode(existingCodes);
            }

            const newCustomer = {
                id: generateUUID(),
                customerCode, name, nameKana, birthDate, gender, phone, email,
                occupation, address, referralSource, visitMotivation,
                firstVisitDate, practitioner, memo,
                allergies, medicalHistory,
                createdAt: now,
                updatedAt: now
            };

            await addToStore('customers', newCustomer);
            await commitStagedMedia(newCustomer.id, 'customer');
            showMessage('customer-form-message', '顧客を登録しました', 'success');
        }

        document.getElementById('customer-form-overlay').classList.remove('show');
        await loadCustomers();

        if (editId && selectedCustomerId === editId) {
            selectedCustomer = await getFromStore('customers', editId);
            await updateCustomerBars();
            showAllergyWarning();
        }
    } catch (error) {
        showMessage('customer-form-message', '保存に失敗しました: ' + error.message, 'error');
    }
}

async function deleteCustomer(customerId) {
    const ok = await showConfirm(
        '顧客の削除',
        'この顧客とすべての関連データ（施術記録）を削除します。この操作は取り消せません。',
        '削除',
        'btn-danger'
    );
    if (!ok) return;

    try {
        const records = await getByIndex('treatment_records', 'customerId', customerId);
        for (const r of records) {
            await deleteMediaByParent(r.id);
            await deleteFromStore('treatment_records', r.id);
        }

        await deleteMediaByParent(customerId);
        await deleteFromStore('customers', customerId);

        if (selectedCustomerId === customerId) {
            deselectCustomer();
        }

        await loadCustomers();
    } catch (error) {
        showMessage('customer-form-message', '削除に失敗しました: ' + error.message, 'error');
    }
}

function initCustomerSearch() {
    const searchInput = document.getElementById('customer-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        const cards = document.querySelectorAll('.customer-card');
        cards.forEach(card => {
            if (!query) {
                card.style.display = '';
                return;
            }
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(query) ? '' : 'none';
        });
    });
}

// ===== 施術記録管理 =====

function collectBodyAreas() {
    const areas = [];
    document.querySelectorAll('#body-areas-grid input[type="checkbox"]:checked').forEach(cb => {
        areas.push(cb.value);
    });
    return areas;
}

async function saveRecord_handler() {
    if (!selectedCustomerId) {
        showMessage('record-message', '顧客を選択してください', 'error');
        return;
    }

    const visitedAt = document.getElementById('input-visited-at').value;
    const chiefComplaint = document.getElementById('input-chief-complaint').value.trim();
    const bodyFindings = document.getElementById('input-body-findings').value.trim();
    const treatmentContent = document.getElementById('input-treatment-content').value.trim();
    const afterNotes = document.getElementById('input-after-notes').value.trim();
    const menuSelect = document.getElementById('input-treatment-menu');
    const treatmentMenuId = menuSelect.value || null;
    const treatmentMenu = menuSelect.selectedIndex > 0 ? menuSelect.options[menuSelect.selectedIndex].textContent : null;
    const duration = document.getElementById('input-duration').value;

    const painLevel = document.getElementById('input-pain-level').value;
    const stiffnessLevel = document.getElementById('input-stiffness-level').value;
    const fatigueLevel = document.getElementById('input-fatigue-level').value;
    const areas = collectBodyAreas();
    const conditionNotes = document.getElementById('input-condition-notes').value.trim() || null;

    const recordValidation = validateTreatmentRecord({
        chiefComplaint, bodyFindings, treatmentContent, afterNotes
    });
    if (!recordValidation.valid) {
        showMessage('record-message', recordValidation.errors[0], 'error');
        return;
    }

    const conditionValidation = validateBodyCondition({
        painLevel, stiffnessLevel, fatigueLevel, areas
    });
    if (!conditionValidation.valid) {
        showMessage('record-message', conditionValidation.errors[0], 'error');
        return;
    }

    const now = new Date().toISOString();
    const record = {
        id: generateUUID(),
        customerId: selectedCustomerId,
        visitedAt: visitedAt ? new Date(visitedAt).toISOString() : now,
        chiefComplaint: chiefComplaint || null,
        bodyFindings: bodyFindings || null,
        treatmentContent: treatmentContent || null,
        afterNotes: afterNotes || null,
        treatmentMenuId,
        treatmentMenu,
        duration: duration ? Number(duration) : null,
        bodyCondition: {
            painLevel: Number(painLevel),
            stiffnessLevel: Number(stiffnessLevel),
            fatigueLevel: Number(fatigueLevel),
            areas,
            notes: conditionNotes
        },
        createdAt: now,
        updatedAt: now
    };

    try {
        await addToStore('treatment_records', record);
        await commitStagedMedia(record.id, 'treatment_record');
        showMessage('record-message', '施術記録を保存しました', 'success');
        resetTreatmentForm();
        await loadRecentRecords();
        showPrevAfterNotesHint();
    } catch (error) {
        showMessage('record-message', '保存に失敗しました: ' + error.message, 'error');
    }
}

async function loadRecentRecords() {
    if (!selectedCustomerId) return;

    const records = await getByIndex('treatment_records', 'customerId', selectedCustomerId);
    records.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));
    const recent = records.slice(0, 3);

    const container = document.getElementById('recent-records-list');

    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>まだ施術記録がありません</p></div>';
        return;
    }

    for (const r of recent) {
        r._media = await getMediaByParent(r.id);
    }
    container.innerHTML = recent.map(r => renderRecentRecord(r)).join('');
    applyDisplaySettings(await loadDisplaySettings());
}

function renderRecentRecord(record) {
    const bc = record.bodyCondition || {};

    let conditionHtml = '';
    if (bc.painLevel != null && bc.painLevel > 0) {
        conditionHtml += `<span class="condition-tag condition-pain">痛み ${bc.painLevel}/10</span>`;
    }
    if (bc.stiffnessLevel != null && bc.stiffnessLevel > 0) {
        conditionHtml += `<span class="condition-tag condition-stiffness">凝り ${bc.stiffnessLevel}/10</span>`;
    }
    if (bc.fatigueLevel != null && bc.fatigueLevel > 0) {
        conditionHtml += `<span class="condition-tag condition-fatigue">疲労 ${bc.fatigueLevel}/10</span>`;
    }
    if (bc.areas && bc.areas.length > 0) {
        conditionHtml += `<span class="condition-tag condition-areas">${bc.areas.map(a => escapeHtml(a)).join('・')}</span>`;
    }

    let treatmentSummary = '';
    if (record.chiefComplaint) treatmentSummary += `<div class="treatment-summary-item"><span class="treatment-label treatment-chief">主訴</span> ${escapeHtml(record.chiefComplaint)}</div>`;
    if (record.bodyFindings) treatmentSummary += `<div class="treatment-summary-item"><span class="treatment-label treatment-findings">所見</span> ${escapeHtml(record.bodyFindings)}</div>`;
    if (record.treatmentContent) treatmentSummary += `<div class="treatment-summary-item"><span class="treatment-label treatment-content">施術</span> ${escapeHtml(record.treatmentContent)}</div>`;
    if (record.afterNotes) treatmentSummary += `<div class="treatment-summary-item"><span class="treatment-label treatment-after">後記</span> ${escapeHtml(record.afterNotes)}</div>`;

    const menuHtml = record.treatmentMenu
        ? `<span class="menu-badge">${escapeHtml(record.treatmentMenu)}${record.duration ? ` (${record.duration}分)` : ''}</span>`
        : '';

    const mediaHtml = (record._media && record._media.length > 0)
        ? `<div class="media-inline-thumbs" data-field-key="treatment.photo">${record._media.map(m =>
            `<img src="${m.thumbnail}" alt="${escapeHtml(m.fileName)}" onclick="openMediaLightbox('${m.id}', 'saved')" class="media-inline-thumb">`
        ).join('')}</div>`
        : '';

    return `<div class="recent-record-card" data-record-id="${record.id}">
        <div class="record-header">
            <span class="record-date">${formatDateTime(record.visitedAt)}</span>
            ${menuHtml}
            <div class="record-actions">
                <button class="btn btn-sm" onclick="openEditRecord('${record.id}')">編集</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecord('${record.id}')">削除</button>
            </div>
        </div>
        <div class="record-condition">${conditionHtml}</div>
        <div class="record-treatment">${treatmentSummary}</div>
        ${mediaHtml}
    </div>`;
}

async function openEditRecord(recordId) {
    const record = await getFromStore('treatment_records', recordId);
    if (!record) return;

    const bc = record.bodyCondition || {};

    document.getElementById('edit-record-id').value = record.id;
    document.getElementById('edit-visited-at').value = formatDateTimeLocal(new Date(record.visitedAt));
    document.getElementById('edit-chief-complaint').value = record.chiefComplaint || '';
    document.getElementById('edit-body-findings').value = record.bodyFindings || '';
    document.getElementById('edit-treatment-content').value = record.treatmentContent || '';
    document.getElementById('edit-after-notes').value = record.afterNotes || '';

    // メニュードロップダウンの復元
    const editMenuSelect = document.getElementById('edit-treatment-menu');
    const menus = await loadTreatmentMenus();
    editMenuSelect._menuCache = menus;
    let matchId = record.treatmentMenuId || null;
    if (!matchId && record.treatmentMenu) {
        const match = menus.find(m => m.name === record.treatmentMenu);
        if (match) matchId = match.id;
    }
    populateMenuDropdown('edit-treatment-menu', matchId);

    document.getElementById('edit-duration').value = record.duration != null ? record.duration : '';
    document.getElementById('edit-pain-level').value = bc.painLevel != null ? bc.painLevel : '';
    document.getElementById('edit-stiffness-level').value = bc.stiffnessLevel != null ? bc.stiffnessLevel : '';
    document.getElementById('edit-fatigue-level').value = bc.fatigueLevel != null ? bc.fatigueLevel : '';

    // 写真読み込み
    clearMediaStaging('edit_treatment_record');
    const editMediaArea = document.getElementById('edit-record-media-area');
    if (editMediaArea) {
        const recordMedia = await getMediaByParent(record.id);
        renderSavedMedia(recordMedia, editMediaArea);
    }

    document.getElementById('edit-record-overlay').classList.add('show');
}

async function saveEditRecord(event) {
    event.preventDefault();

    const id = document.getElementById('edit-record-id').value;
    const original = await getFromStore('treatment_records', id);
    if (!original) return;

    const visitedAt = document.getElementById('edit-visited-at').value;
    const chiefComplaint = document.getElementById('edit-chief-complaint').value.trim();
    const bodyFindings = document.getElementById('edit-body-findings').value.trim();
    const treatmentContent = document.getElementById('edit-treatment-content').value.trim();
    const afterNotes = document.getElementById('edit-after-notes').value.trim();
    const editMenuSelect = document.getElementById('edit-treatment-menu');
    const treatmentMenuId = editMenuSelect.value || null;
    const treatmentMenu = editMenuSelect.selectedIndex > 0 ? editMenuSelect.options[editMenuSelect.selectedIndex].textContent : null;
    const duration = document.getElementById('edit-duration').value;
    const painLevel = document.getElementById('edit-pain-level').value;
    const stiffnessLevel = document.getElementById('edit-stiffness-level').value;
    const fatigueLevel = document.getElementById('edit-fatigue-level').value;

    const recordValidation = validateTreatmentRecord({
        chiefComplaint, bodyFindings, treatmentContent, afterNotes
    });
    if (!recordValidation.valid) {
        alert(recordValidation.errors[0]);
        return;
    }

    const updated = {
        ...original,
        visitedAt: visitedAt ? new Date(visitedAt).toISOString() : original.visitedAt,
        chiefComplaint: chiefComplaint || null,
        bodyFindings: bodyFindings || null,
        treatmentContent: treatmentContent || null,
        afterNotes: afterNotes || null,
        treatmentMenuId,
        treatmentMenu,
        duration: duration ? Number(duration) : null,
        bodyCondition: {
            painLevel: painLevel !== '' ? Number(painLevel) : (original.bodyCondition || {}).painLevel || 0,
            stiffnessLevel: stiffnessLevel !== '' ? Number(stiffnessLevel) : (original.bodyCondition || {}).stiffnessLevel || 0,
            fatigueLevel: fatigueLevel !== '' ? Number(fatigueLevel) : (original.bodyCondition || {}).fatigueLevel || 0,
            areas: (original.bodyCondition || {}).areas || [],
            notes: (original.bodyCondition || {}).notes || null
        },
        updatedAt: new Date().toISOString()
    };

    try {
        await updateInStore('treatment_records', updated);
        await commitStagedMedia(id, 'treatment_record', 'edit_treatment_record');
        document.getElementById('edit-record-overlay').classList.remove('show');
        await loadRecentRecords();
        await loadHistory();
    } catch (error) {
        alert('更新に失敗しました: ' + error.message);
    }
}

async function deleteRecord(recordId) {
    const ok = await showConfirm('記録の削除', 'この施術記録を削除しますか？', '削除', 'btn-danger');
    if (!ok) return;

    try {
        await deleteMediaByParent(recordId);
        await deleteFromStore('treatment_records', recordId);
        await loadRecentRecords();
        showPrevAfterNotesHint();
    } catch (error) {
        showMessage('record-message', '削除に失敗しました: ' + error.message, 'error');
    }
}

function resetTreatmentForm() {
    document.getElementById('input-chief-complaint').value = '';
    document.getElementById('input-body-findings').value = '';
    document.getElementById('input-treatment-content').value = '';
    document.getElementById('input-after-notes').value = '';
    document.getElementById('input-treatment-menu').value = '';
    document.getElementById('input-duration').value = '';
    refreshMenuDropdowns();
    document.getElementById('input-pain-level').value = 0;
    document.getElementById('input-stiffness-level').value = 0;
    document.getElementById('input-fatigue-level').value = 0;
    document.getElementById('pain-level-display').textContent = '0';
    document.getElementById('stiffness-level-display').textContent = '0';
    document.getElementById('fatigue-level-display').textContent = '0';
    document.getElementById('input-condition-notes').value = '';
    document.querySelectorAll('#body-areas-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('input-visited-at').value = formatDateTimeLocal(new Date());
    clearMediaStaging('treatment_record');
    const recordMediaGrid = document.querySelector('#record-media-area .media-thumb-grid');
    if (recordMediaGrid) recordMediaGrid.innerHTML = '';
}

async function showPrevAfterNotesHint() {
    const hintEl = document.getElementById('prev-after-notes-hint');
    if (!selectedCustomerId) {
        hintEl.style.display = 'none';
        return;
    }

    const records = await getByIndex('treatment_records', 'customerId', selectedCustomerId);
    records.sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt));

    if (records.length > 0 && records[0].afterNotes) {
        hintEl.innerHTML = `<strong>前回の施術後メモ:</strong> ${escapeHtml(records[0].afterNotes)}`;
        hintEl.style.display = '';
    } else {
        hintEl.style.display = 'none';
    }
}

// ===== タブナビゲーション =====

function initTabs() {
    const buttons = document.querySelectorAll('#tab-nav button');
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const tabId = btn.dataset.tab;
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
            if (tabId === 'treatment' && selectedCustomerId) await refreshTreatmentTab();
            if (tabId === 'history' && selectedCustomerId) await loadHistory();
        });
    });
}

// ===== 数値入力フォーカス時全選択 =====

function initSelectOnFocus() {
    document.querySelectorAll('input[type="number"], textarea').forEach(el => {
        el.addEventListener('focus', () => el.select());
    });
}

// ===== 体調レベルスライダー初期化 =====

function initLevelSliders() {
    const sliders = [
        { slider: 'input-pain-level', display: 'pain-level-display' },
        { slider: 'input-stiffness-level', display: 'stiffness-level-display' },
        { slider: 'input-fatigue-level', display: 'fatigue-level-display' }
    ];

    sliders.forEach(({ slider, display }) => {
        const sliderEl = document.getElementById(slider);
        const displayEl = document.getElementById(display);
        if (sliderEl && displayEl) {
            sliderEl.addEventListener('input', () => {
                displayEl.textContent = sliderEl.value;
            });
        }
    });
}

// ============================================================
// History Timeline
// ============================================================

async function loadHistory() {
    if (!selectedCustomerId) return;

    const container = document.getElementById('timeline-container');
    const paginationEl = document.getElementById('timeline-pagination');
    if (!container) return;

    try {
        const records = await getRecordsByCustomer(selectedCustomerId);

        const events = [];
        for (const r of records) {
            r._media = await getMediaByParent(r.id);
            events.push({
                type: 'treatment_record',
                date: r.visitedAt,
                data: r
            });
        }

        events.sort((a, b) => {
            const diff = new Date(b.date) - new Date(a.date);
            return historySortDesc ? diff : -diff;
        });

        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>履歴がありません</p></div>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(events.length / HISTORY_PAGE_SIZE);
        if (historyPage > totalPages) historyPage = totalPages;
        if (historyPage < 1) historyPage = 1;

        const startIdx = (historyPage - 1) * HISTORY_PAGE_SIZE;
        const pageEvents = events.slice(startIdx, startIdx + HISTORY_PAGE_SIZE);

        const groups = {};
        for (const ev of pageEvents) {
            const d = new Date(ev.date);
            const monthKey = `${d.getFullYear()}年${d.getMonth() + 1}月`;
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(ev);
        }

        let html = '';
        for (const [monthLabel, entries] of Object.entries(groups)) {
            html += `<div class="timeline-month-group">`;
            html += `<div class="timeline-month-label">${escapeHtml(monthLabel)}</div>`;
            for (const entry of entries) {
                html += renderTimelineEntry(entry);
            }
            html += `</div>`;
        }

        container.innerHTML = html;
        renderTimelinePagination(totalPages);
        applyDisplaySettings(await loadDisplaySettings());
    } catch (e) {
        container.innerHTML = '<div class="empty-state"><p>履歴の読み込みに失敗しました</p></div>';
    }
}

function renderTimelineEntry(entry) {
    const dateStr = formatDateTime(entry.date);

    if (entry.type === 'treatment_record') {
        const r = entry.data;
        const chiefSummary = r.chiefComplaint
            ? escapeHtml(r.chiefComplaint.substring(0, 50)) + (r.chiefComplaint.length > 50 ? '...' : '')
            : '';

        const bc = r.bodyCondition || {};
        let conditionParts = [];
        if (bc.painLevel > 0) conditionParts.push(`痛み:${bc.painLevel}`);
        if (bc.stiffnessLevel > 0) conditionParts.push(`凝り:${bc.stiffnessLevel}`);
        if (bc.fatigueLevel > 0) conditionParts.push(`疲労:${bc.fatigueLevel}`);
        const conditionSummary = conditionParts.length > 0 ? conditionParts.join(' / ') : '';

        const menuBadge = r.treatmentMenu
            ? `<span class="menu-badge">${escapeHtml(r.treatmentMenu)}${r.duration ? ` (${r.duration}分)` : ''}</span>`
            : '';

        const recordMediaHtml = (r._media && r._media.length > 0)
            ? `<div class="media-inline-thumbs" data-field-key="treatment.photo">${r._media.map(m =>
                `<img src="${m.thumbnail}" alt="${escapeHtml(m.fileName)}" onclick="openMediaLightbox('${m.id}', 'saved')" class="media-inline-thumb">`
            ).join('')}</div>`
            : '';

        return `<div class="timeline-entry timeline-treatment" data-id="${r.id}">
            <div class="timeline-entry-header" onclick="this.parentElement.classList.toggle('expanded')">
                <span class="timeline-date">${dateStr}</span>
                <span class="timeline-type-label">施術記録</span>
                ${menuBadge}
            </div>
            <div class="timeline-entry-body">
                ${chiefSummary ? `<div class="timeline-chief"><strong>主訴:</strong> ${chiefSummary}</div>` : ''}
                ${conditionSummary ? `<div class="timeline-condition">${escapeHtml(conditionSummary)}</div>` : ''}
                ${r.treatmentContent ? `<div class="timeline-treatment-content"><strong>施術:</strong> ${escapeHtml(r.treatmentContent.substring(0, 80))}</div>` : ''}
                ${recordMediaHtml}
            </div>
        </div>`;
    }

    return '';
}

function renderTimelinePagination(totalPages) {
    const paginationEl = document.getElementById('timeline-pagination');
    if (!paginationEl) return;

    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="btn btn-sm" ${historyPage <= 1 ? 'disabled' : ''} onclick="historyPage = ${historyPage - 1}; loadHistory();">&laquo;</button>`;

    const maxButtons = 5;
    let startPage = Math.max(1, historyPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn btn-sm ${i === historyPage ? 'active' : ''}" onclick="historyPage = ${i}; loadHistory();">${i}</button>`;
    }

    html += `<button class="btn btn-sm" ${historyPage >= totalPages ? 'disabled' : ''} onclick="historyPage = ${historyPage + 1}; loadHistory();">&raquo;</button>`;

    paginationEl.innerHTML = html;
}

function initHistoryControls() {
    const sortBtn = document.getElementById('sort-toggle-btn');
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            historySortDesc = !historySortDesc;
            historyPage = 1;
            loadHistory();
        });
    }
}

// ============================================================
// Export / Import
// ============================================================

async function exportData() {
    try {
        const customers = await getAllCustomers();
        const allRecords = [];

        for (const c of customers) {
            const records = await getRecordsByCustomer(c.id);
            allRecords.push(...records);
        }

        const allMedia = await getAllFromStore('media');
        const displaySettings = await loadDisplaySettings();
        const treatmentMenus = await loadTreatmentMenus();
        const imageSettings = await loadImageSettings();

        const data = {
            version: (window.APP_INFO || {}).version || '1.0.0',
            appName: 'smrm',
            exportedAt: new Date().toISOString(),
            customers: customers,
            treatmentRecords: allRecords,
            media: allMedia,
            displaySettings: displaySettings,
            treatmentMenus: treatmentMenus,
            imageSettings: imageSettings
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `smrm_export_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        const mediaCount = allMedia.length;
        showMessage('data-message', `${customers.length}件の顧客、${allRecords.length}件の記録、${mediaCount}件のメディアをエクスポートしました`, 'success');
    } catch (error) {
        showMessage('data-message', 'エクスポートに失敗しました: ' + error.message, 'error');
    }
}

async function performImport(data, msgElementId) {
    const cCount = data.customers.length;
    const rCount = data.treatmentRecords.length;
    const mCount = (data.media && Array.isArray(data.media)) ? data.media.length : 0;

    const totalItems = cCount + rCount + mCount;
    let processedItems = 0;
    const msgEl = document.getElementById(msgElementId);
    msgEl.innerHTML = '<span class="progress-text"></span><div class="progress-bar-container"><div class="progress-bar-fill"></div></div>';
    msgEl.className = 'message show progress';
    const progressText = msgEl.querySelector('.progress-text');
    const progressBar = msgEl.querySelector('.progress-bar-fill');

    function updateProgress(label) {
        const pct = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;
        progressText.textContent = `${label}（${pct}%  ${processedItems.toLocaleString()} / ${totalItems.toLocaleString()}件）`;
        progressBar.style.width = pct + '%';
    }

    updateProgress('インポート準備中...');

    const existingCustomers = await getAllCustomers();
    const existingCustomerIds = new Set(existingCustomers.map(c => c.id));

    let importedCustomers = 0;
    for (const c of data.customers) {
        if (!c.id) { processedItems++; continue; }
        if (existingCustomerIds.has(c.id)) { processedItems++; continue; }
        await addCustomer(c);
        importedCustomers++;
        processedItems++;
        if (processedItems % 10 === 0) updateProgress('顧客データをインポート中...');
    }
    updateProgress('顧客データ完了、記録をインポート中...');

    let importedRecords = 0;
    for (const r of data.treatmentRecords) {
        if (!r.id) { processedItems++; continue; }
        try {
            const existing = await getRecord(r.id);
            if (existing) { processedItems++; continue; }
        } catch (e) { /* not found */ }
        await addRecord(r);
        importedRecords++;
        processedItems++;
        if (processedItems % 50 === 0) updateProgress('記録をインポート中...');
    }

    let importedMedia = 0;
    if (data.media && Array.isArray(data.media)) {
        updateProgress('メディアをインポート中...');
        for (const m of data.media) {
            if (!m.id) { processedItems++; continue; }
            try {
                await addToStore('media', m);
                importedMedia++;
            } catch (e) {
                // 重複IDはスキップ
            }
            processedItems++;
            if (processedItems % 10 === 0) updateProgress('メディアをインポート中...');
        }
    }

    // メニューのマージ
    const existingMenus = await loadTreatmentMenus();
    let mergedMenus = existingMenus;
    if (data.treatmentMenus && Array.isArray(data.treatmentMenus)) {
        mergedMenus = mergeMenusByName(mergedMenus, data.treatmentMenus);
    }
    // 施術記録内の未知メニュー名を自動追加
    const knownMenuNames = new Set(mergedMenus.map(m => m.name));
    for (const r of data.treatmentRecords) {
        if (r.treatmentMenu && !knownMenuNames.has(r.treatmentMenu)) {
            const maxSort = mergedMenus.length > 0
                ? Math.max(...mergedMenus.map(m => typeof m.sortOrder === 'number' ? m.sortOrder : -1))
                : -1;
            mergedMenus.push({
                id: generateUUID(),
                name: r.treatmentMenu,
                defaultDuration: r.duration || null,
                sortOrder: maxSort + 1
            });
            knownMenuNames.add(r.treatmentMenu);
        }
    }
    if (mergedMenus.length !== existingMenus.length || JSON.stringify(mergedMenus) !== JSON.stringify(existingMenus)) {
        await saveTreatmentMenus(mergedMenus);
    }

    if (data.displaySettings) {
        await saveDisplaySettings(data.displaySettings);
        await initDisplaySettings();
    }

    if (data.imageSettings) {
        await saveImageSettings(data.imageSettings);
        await initImageSettings();
    }

    await initMenuSettings();
    await refreshMenuDropdowns();

    return { importedCustomers, importedRecords, importedMedia };
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        const validation = validateImportData(data);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const cCount = data.customers.length;
        const rCount = data.treatmentRecords.length;
        const mCount = (data.media && Array.isArray(data.media)) ? data.media.length : 0;

        const confirmed = await showConfirm(
            'データのインポート',
            `${cCount}件の顧客、${rCount}件の施術記録` +
            (mCount > 0 ? `、${mCount}件のメディア` : '') +
            `を読み込みます。既存データとマージされます。`,
            'インポート',
            'btn-primary'
        );
        if (!confirmed) {
            event.target.value = '';
            return;
        }

        const result = await performImport(data, 'data-message');

        showMessage('data-message',
            `インポート完了: 顧客${result.importedCustomers}件、記録${result.importedRecords}件` +
            (result.importedMedia > 0 ? `、メディア${result.importedMedia}件` : ''),
            'success'
        );

        await renderCustomerList();
    } catch (error) {
        showMessage('data-message', 'インポートに失敗しました: ' + error.message, 'error');
    }

    event.target.value = '';
}

function updateSampleImportAvailability() {
    const btn = document.getElementById('import-sample-btn');
    const note = document.getElementById('sample-data-offline-note');
    if (!btn || !note) return;

    if (navigator.onLine) {
        btn.disabled = false;
        note.style.display = 'none';
    } else {
        btn.disabled = true;
        note.style.display = 'block';
    }
}

async function importSampleData() {
    const btn = document.getElementById('import-sample-btn');
    const msgId = 'sample-data-message';

    if (!navigator.onLine) {
        showMessage(msgId, 'オフライン環境ではサンプルデータをインポートできません。', 'error');
        return;
    }

    const confirmed = await showConfirm(
        'サンプルデータのインポート',
        'サンプルデータ（顧客100名、施術記録10,000件）をダウンロードしてインポートします。既存データとマージされます。',
        'インポート',
        'btn-primary'
    );
    if (!confirmed) return;

    btn.disabled = true;
    try {
        const msgEl = document.getElementById(msgId);
        msgEl.textContent = 'サンプルデータをダウンロード中...';
        msgEl.className = 'message show info';

        const response = await fetch('/sample_data.json');
        if (!response.ok) {
            throw new Error(`ダウンロードに失敗しました (HTTP ${response.status})`);
        }

        const data = await response.json();

        const validation = validateImportData(data);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const result = await performImport(data, msgId);

        msgEl.textContent = `インポート完了: 顧客${result.importedCustomers}件、記録${result.importedRecords}件` +
            (result.importedMedia > 0 ? `、メディア${result.importedMedia}件` : '');
        msgEl.className = 'message show success';

        await renderCustomerList();
    } catch (error) {
        showMessage(msgId, 'サンプルデータのインポートに失敗しました: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function deleteAllData() {
    const confirmed = await showConfirm('全データ削除', '全てのデータを削除します。この操作は取り消せません。本当に削除しますか？');
    if (!confirmed) return;

    try {
        const db = await openDB();

        const stores = [CUSTOMERS_STORE, TREATMENT_RECORDS_STORE, MEDIA_STORE, APP_SETTINGS_STORE];
        await new Promise((resolve, reject) => {
            const tx = db.transaction(stores, 'readwrite');
            for (const storeName of stores) {
                tx.objectStore(storeName).clear();
            }
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });

        selectedCustomerId = null;

        await renderCustomerList();
        await initDisplaySettings();
        await initMenuSettings();
        await refreshMenuDropdowns();

        showMessage('data-message', '全データを削除しました', 'success');
    } catch (error) {
        showMessage('data-message', 'データ削除に失敗しました: ' + error.message, 'error');
    }
}

// ============================================================
// PWA
// ============================================================

let swRegistration = null;
let lastUpdateCheck = 0;
const UPDATE_CHECK_THROTTLE_MS = 30000;

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;

    try {
        swRegistration = await navigator.serviceWorker.register('/sw.js');

        swRegistration.addEventListener('updatefound', () => {
            const newWorker = swRegistration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated' && hadController) {
                        showUpdateBanner();
                    }
                });
            }
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hadController) {
                showUpdateBanner();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                throttledUpdateCheck();
            }
        });
    } catch (e) {
        // SW登録失敗は無視（HTTP環境等）
    }
}

function throttledUpdateCheck() {
    const now = Date.now();
    if (now - lastUpdateCheck < UPDATE_CHECK_THROTTLE_MS) return;
    lastUpdateCheck = now;
    if (swRegistration) {
        swRegistration.update().catch(() => {});
    }
}

async function checkForUpdate() {
    const statusEl = document.getElementById('update-check-status');
    if (!swRegistration) {
        if (statusEl) statusEl.textContent = 'Service Workerが未登録です';
        return;
    }

    if (statusEl) statusEl.textContent = '確認中...';

    try {
        await swRegistration.update();
        const waiting = swRegistration.waiting;
        const installing = swRegistration.installing;

        if (waiting || installing) {
            if (statusEl) statusEl.textContent = '新しいバージョンを検出しました';
            showUpdateBanner();
        } else {
            if (statusEl) statusEl.textContent = '最新バージョンです';
            setTimeout(() => {
                if (statusEl) statusEl.textContent = '';
            }, 3000);
        }
    } catch (e) {
        if (statusEl) statusEl.textContent = '確認に失敗しました';
    }
}

function showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) banner.style.display = 'flex';
}

function hideUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) banner.style.display = 'none';
}

function initUpdateBanner() {
    const updateBtn = document.getElementById('update-banner-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            location.reload();
        });
    }
    const closeBtn = document.getElementById('update-banner-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideUpdateBanner();
        });
    }
    const checkUpdateBtn = document.getElementById('check-update-btn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', checkForUpdate);
    }
}

// ============================================================
// Version Info + Scroll + URL tab
// ============================================================

function initVersionInfo() {
    const info = window.APP_INFO || {};

    const infoDisplay = document.getElementById('app-info-display');
    if (infoDisplay) {
        infoDisplay.textContent = `Build: ${info.buildTime || '---'}`;
    }

    const versionDetail = document.getElementById('app-version-info');
    if (versionDetail) {
        versionDetail.textContent = `Build: ${info.buildTime || '---'}`;
    }
}

function initScrollToTop() {
    try {
        const scrollToTop = () => {
            try {
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            } catch (e) {
                window.scrollTo(0, 0);
            }
        };
        const scrollTopBtn = document.getElementById('scroll-to-top-btn');
        if (scrollTopBtn) scrollTopBtn.addEventListener('click', scrollToTop);
        const appHeader = document.querySelector('.app-header');
        if (appHeader) appHeader.addEventListener('click', scrollToTop);
    } catch (e) {
        // ボタン初期化失敗時は無視
    }
}

function handleTabFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            const btn = document.querySelector(`.tab-nav button[data-tab="${tab}"]`);
            if (btn) btn.click();
        }
    } catch (e) {
        // URLパース失敗は無視
    }
}

// ============================================================
// refreshTreatmentTab helper
// ============================================================

async function refreshTreatmentTab() {
    if (!selectedCustomerId) return;
    await loadRecentRecords();
    showPrevAfterNotesHint();
}

// ============================================================
// 表示設定の適用・初期化
// ============================================================

function applyDisplaySettings(settings) {
    if (settings.fields) {
        for (const [section, fields] of Object.entries(settings.fields)) {
            for (const [fieldName, visible] of Object.entries(fields)) {
                const key = `${section}.${fieldName}`;
                document.querySelectorAll(`[data-field-key="${key}"]`).forEach(el => {
                    el.classList.toggle('field-hidden', !visible);
                });
            }
        }
    }
}

function collectDisplaySettingsFromUI() {
    const settings = getDefaultDisplaySettings();
    document.querySelectorAll('[data-display-key]').forEach(checkbox => {
        const path = checkbox.dataset.displayKey.split('.');
        if (path.length === 3) {
            settings[path[0]][path[1]][path[2]] = checkbox.checked;
        }
    });
    return settings;
}

async function initDisplaySettings() {
    const settings = await loadDisplaySettings();

    document.querySelectorAll('[data-display-key]').forEach(checkbox => {
        const path = checkbox.dataset.displayKey.split('.');
        let value = settings;
        for (const key of path) {
            value = value && value[key];
        }
        checkbox.checked = value !== false;
    });

    applyDisplaySettings(settings);

    document.querySelectorAll('[data-display-key]').forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            const newSettings = collectDisplaySettingsFromUI();
            await saveDisplaySettings(newSettings);
            applyDisplaySettings(newSettings);
        });
    });
}

// ============================================================
// initApp() - メイン初期化
// ============================================================

async function initImageSettings() {
    const settings = await loadImageSettings();
    currentImageSettings = settings;
    const select = document.getElementById('image-preset-select');
    if (!select) return;
    select.value = settings.preset || 'standard';
    updateImagePresetHint(settings.preset || 'standard');
    select.addEventListener('change', async () => {
        const newSettings = { preset: select.value };
        await saveImageSettings(newSettings);
        currentImageSettings = newSettings;
        updateImagePresetHint(select.value);
    });
}

function updateImagePresetHint(preset) {
    const container = document.getElementById('image-preset-hint');
    if (!container) return;
    container.querySelectorAll('span').forEach(span => {
        span.classList.toggle('active', span.dataset.preset === preset);
    });
}

async function initApp() {
    initVersionInfo();
    initScrollToTop();
    initUpdateBanner();
    initTabs();
    initSelectOnFocus();
    initLevelSliders();
    initCustomerSearch();
    initHistoryControls();
    await initDisplaySettings();
    await initImageSettings();
    await initMenuSettings();
    await refreshMenuDropdowns();
    initMenuDropdownDurationSync('input-treatment-menu', 'input-duration');
    initMenuDropdownDurationSync('edit-treatment-menu', 'edit-duration');

    // フォームハンドラのセットアップ
    document.getElementById('save-record-btn').addEventListener('click', saveRecord_handler);
    document.getElementById('add-customer-btn').addEventListener('click', () => openCustomerForm());
    document.getElementById('customer-form').addEventListener('submit', saveCustomer);
    document.getElementById('customer-form-cancel').addEventListener('click', () => {
        document.getElementById('customer-form-overlay').classList.remove('show');
    });
    document.getElementById('add-allergy-btn').addEventListener('click', () => addAllergyRow());
    document.getElementById('add-history-btn').addEventListener('click', () => addHistoryRow());
    document.getElementById('add-menu-btn').addEventListener('click', () => {
        addMenuSettingsRow();
        scheduleMenuSettingsSave();
    });
    document.getElementById('edit-record-form').addEventListener('submit', saveEditRecord);
    document.getElementById('edit-record-cancel').addEventListener('click', () => {
        document.getElementById('edit-record-overlay').classList.remove('show');
    });

    // 顧客詳細オーバーレイ
    document.getElementById('customer-detail-close').addEventListener('click', () => {
        document.getElementById('customer-detail-overlay').classList.remove('show');
    });
    document.getElementById('customer-detail-edit').addEventListener('click', () => {
        const cid = document.getElementById('customer-detail-overlay').dataset.customerId;
        document.getElementById('customer-detail-overlay').classList.remove('show');
        if (cid) openCustomerForm(cid);
    });

    // 顧客情報バー → 詳細表示
    document.getElementById('selected-customer-bar').addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') return;
        if (selectedCustomerId) openCustomerDetail(selectedCustomerId);
    });
    document.getElementById('history-customer-bar').addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') return;
        if (selectedCustomerId) openCustomerDetail(selectedCustomerId);
    });

    // 設定
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('delete-all-btn').addEventListener('click', deleteAllData);
    document.getElementById('import-sample-btn').addEventListener('click', importSampleData);
    window.addEventListener('online', updateSampleImportAvailability);
    window.addEventListener('offline', updateSampleImportAvailability);
    updateSampleImportAvailability();
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        document.getElementById('confirm-overlay').classList.remove('show');
    });

    // メディア添付エリア初期化
    initMediaAttachArea(document.getElementById('record-media-area'), 'treatment_record');
    initMediaAttachArea(document.getElementById('customer-media-area'), 'customer');
    initMediaAttachArea(document.getElementById('edit-record-media-area'), 'edit_treatment_record');

    handleTabFromUrl();
    await loadCustomers();
    await registerServiceWorker();
    document.body.dataset.appReady = 'true';
}

document.addEventListener('DOMContentLoaded', initApp);
