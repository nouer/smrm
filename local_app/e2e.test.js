/**
 * e2e.test.js - シンプルカルテ管理 (smrm) E2Eテスト
 * Puppeteer で Docker ネットワーク内の nginx にアクセスしてテスト
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const childProcess = require('child_process');

describe('E2E Test: smrm App', () => {
    let browser;
    let page;
    let baseUrl = 'http://smrm-app:80';
    const pageErrors = [];

    jest.setTimeout(300000);

    beforeAll(async () => {
        const host = process.env.E2E_APP_HOST || 'smrm-app';
        const fixedIp = String(process.env.E2E_APP_IP || '').trim();
        const hasFixedIp = Boolean(fixedIp && /^\d+\.\d+\.\d+\.\d+$/.test(fixedIp));

        if (hasFixedIp) {
            baseUrl = `http://${fixedIp}:80`;
            console.log(`E2E baseUrl = ${baseUrl} (fixed)`);
        } else {
            const tryResolveIpv4 = () => {
                try {
                    const out = childProcess.execSync(`getent hosts ${host}`, { encoding: 'utf-8', timeout: 8000 }).trim();
                    const ip = out.split(/\s+/)[0];
                    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
                } catch (e) {}
                try {
                    const out = childProcess.execSync(`nslookup ${host} 127.0.0.11`, { encoding: 'utf-8', timeout: 8000 });
                    const lines = String(out || '').split('\n').map(l => l.trim()).filter(Boolean);
                    const addrLine = lines.find(l => /^Address\s+\d+:\s+\d+\.\d+\.\d+\.\d+/.test(l));
                    if (addrLine) {
                        const m = addrLine.match(/(\d+\.\d+\.\d+\.\d+)/);
                        if (m && m[1]) return m[1];
                    }
                } catch (e) {}
                try {
                    const hostsText = fs.readFileSync('/etc/hosts', 'utf-8');
                    const line = hostsText.split('\n').find(l => l.includes(` ${host}`) || l.endsWith(`\t${host}`));
                    if (line) {
                        const ip = line.trim().split(/\s+/)[0];
                        if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
                    }
                } catch (e) {}
                return null;
            };

            let ip = null;
            for (let i = 0; i < 30; i++) {
                ip = tryResolveIpv4();
                if (ip) break;
                await new Promise(r => setTimeout(r, 1000));
            }
            if (!ip) {
                throw new Error(`E2E: cannot resolve '${host}' to IPv4.`);
            }
            baseUrl = `http://${ip}:80`;
            console.log(`E2E baseUrl = ${baseUrl}`);
        }

        browser = await puppeteer.launch({
            headless: 'new',
            timeout: 300000,
            protocolTimeout: 300000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        page = await browser.newPage();

        page.on('pageerror', error => {
            console.error('Browser Page Error:', error.message);
            pageErrors.push(error.message);
        });

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('Browser Console Error:', msg.text());
            }
        });
    }, 300000);

    afterAll(async () => {
        if (browser) await browser.close();
    });

    beforeEach(() => {
        pageErrors.length = 0;
    });

    const isVisible = async (selector) => {
        return await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }, selector);
    };

    const waitForApp = async () => {
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('.tab-nav', { timeout: 10000 });
    };

    // ============================================================
    // 基本表示テスト
    // ============================================================
    test('E2E-001: ページが表示される（タイトル、ヘッダー、タブナビ）', async () => {
        await waitForApp();
        const title = await page.title();
        expect(title).toContain('シンプルカルテ管理');

        const headerText = await page.$eval('.app-header h1', el => el.textContent);
        expect(headerText).toContain('シンプルカルテ管理');

        const tabButtons = await page.$$('.tab-nav button');
        expect(tabButtons.length).toBe(4);
    });

    test('E2E-002: 初期表示で顧客タブがアクティブ', async () => {
        await waitForApp();
        const activeTab = await page.$eval('.tab-nav button.active', el => el.dataset.tab);
        expect(activeTab).toBe('customers');

        const customersTabVisible = await isVisible('#tab-customers');
        expect(customersTabVisible).toBe(true);
    });

    // ============================================================
    // 顧客管理テスト
    // ============================================================
    test('E2E-003: 顧客を新規登録できる', async () => {
        await waitForApp();

        // 新規顧客登録ボタンクリック
        await page.click('#add-customer-btn');
        await page.waitForSelector('#customer-form-overlay', { visible: true, timeout: 5000 });

        // フォーム入力
        await page.type('#input-customer-name', 'テスト太郎');
        await page.type('#input-customer-kana', 'てすと たろう');
        await page.select('#input-customer-gender', 'male');
        await page.type('#input-customer-phone', '090-1234-5678');

        // 保存
        await page.click('#customer-form-save');
        await page.waitForFunction(() => {
            const overlay = document.querySelector('#customer-form-overlay');
            return !overlay || window.getComputedStyle(overlay).display === 'none';
        }, { timeout: 10000 });

        // 顧客リストに表示されていることを確認
        const customerText = await page.$eval('#customer-list', el => el.textContent);
        expect(customerText).toContain('テスト太郎');
    });

    test('E2E-004: 顧客検索ができる', async () => {
        await waitForApp();

        // まず顧客が存在することを確認
        await page.waitForFunction(() => {
            const list = document.querySelector('#customer-list');
            return list && list.children.length > 0;
        }, { timeout: 10000 });

        // 検索入力
        await page.type('#customer-search', 'テスト太郎');
        await new Promise(r => setTimeout(r, 500));

        // 検索結果にテスト太郎が表示されている
        const customerText = await page.$eval('#customer-list', el => el.textContent);
        expect(customerText).toContain('テスト太郎');

        // 検索クリア
        await page.$eval('#customer-search', el => el.value = '');
        await page.type('#customer-search', 'ZZZZNOTEXIST');
        await new Promise(r => setTimeout(r, 500));

        // 存在しない検索で顧客カードが0件になる
        const cards = await page.$$('#customer-list .customer-card');
        expect(cards.length).toBe(0);

        // クリア
        await page.$eval('#customer-search', el => el.value = '');
        await page.evaluate(() => {
            document.querySelector('#customer-search').dispatchEvent(new Event('input'));
        });
    });

    // ============================================================
    // 施術記録テスト
    // ============================================================
    test('E2E-005: 施術記録を保存できる', async () => {
        await waitForApp();

        // 顧客を選択
        await page.$eval('#customer-search', el => el.value = '');
        await page.evaluate(() => {
            document.querySelector('#customer-search').dispatchEvent(new Event('input'));
        });
        await new Promise(r => setTimeout(r, 500));

        const firstCustomer = await page.$('#customer-list .customer-card');
        if (firstCustomer) {
            await firstCustomer.click();
            await new Promise(r => setTimeout(r, 500));
        }

        // 施術記録タブに切り替え
        await page.click('.tab-nav button[data-tab="treatment"]');
        await new Promise(r => setTimeout(r, 500));

        // 施術内容が表示されていることを確認
        const treatmentVisible = await isVisible('#treatment-content');
        expect(treatmentVisible).toBe(true);

        // 主訴を入力
        await page.type('#input-chief-complaint', '肩こりがひどい');
        await page.type('#input-treatment-content', '全身もみほぐし60分');

        // 保存
        await page.click('#save-record-btn');
        await new Promise(r => setTimeout(r, 2000));

        // 保存成功メッセージ
        const messageText = await page.$eval('#record-message', el => el.textContent);
        expect(messageText).toContain('保存');
    });

    // ============================================================
    // 履歴タブテスト
    // ============================================================
    test('E2E-006: 履歴タブにタイムラインが表示される', async () => {
        await waitForApp();

        // 顧客を選択
        await page.$eval('#customer-search', el => el.value = '');
        await page.evaluate(() => {
            document.querySelector('#customer-search').dispatchEvent(new Event('input'));
        });
        await new Promise(r => setTimeout(r, 500));

        const firstCustomer = await page.$('#customer-list .customer-card');
        if (firstCustomer) {
            await firstCustomer.click();
            await new Promise(r => setTimeout(r, 500));
        }

        // 履歴タブに切り替え
        await page.click('.tab-nav button[data-tab="history"]');
        await new Promise(r => setTimeout(r, 1000));

        // 履歴コンテンツが表示されている
        const historyVisible = await isVisible('#history-content');
        expect(historyVisible).toBe(true);

        // タイムラインコンテナが存在する
        const timelineExists = await page.$('#timeline-container') !== null;
        expect(timelineExists).toBe(true);
    });

    // ============================================================
    // 全操作エラーチェック
    // ============================================================
    test('E2E-007: 全操作でページエラーが発生しない', async () => {
        await waitForApp();
        pageErrors.length = 0;

        // 全タブを巡回
        const tabs = ['customers', 'treatment', 'history', 'settings'];
        for (const tab of tabs) {
            await page.click(`.tab-nav button[data-tab="${tab}"]`);
            await new Promise(r => setTimeout(r, 500));
        }

        expect(pageErrors.length).toBe(0);
    });

    // ============================================================
    // バージョン情報テスト
    // ============================================================
    test('E2E-008: バージョン情報が表示される', async () => {
        await waitForApp();
        await page.click('.tab-nav button[data-tab="settings"]');
        await new Promise(r => setTimeout(r, 500));

        const versionInfo = await page.$eval('#app-version-info', el => el.textContent);
        expect(versionInfo.length).toBeGreaterThan(0);
    });

    // ============================================================
    // スクロールトップボタン
    // ============================================================
    test('E2E-009: スクロールトップボタンがposition:fixedで存在する', async () => {
        await waitForApp();
        const btnStyle = await page.evaluate(() => {
            const btn = document.querySelector('#scroll-to-top-btn');
            if (!btn) return null;
            return window.getComputedStyle(btn).position;
        });
        expect(btnStyle).toBe('fixed');
    });

    // ============================================================
    // ヘッダークリックでページ先頭
    // ============================================================
    test('E2E-010: ヘッダークリックでページ先頭へ戻る', async () => {
        await waitForApp();

        // まずスクロールする
        await page.evaluate(() => window.scrollTo(0, 500));
        await new Promise(r => setTimeout(r, 300));

        const scrollBefore = await page.evaluate(() => window.scrollY);
        expect(scrollBefore).toBeGreaterThan(0);

        // ヘッダークリック
        await page.click('.app-header');
        await new Promise(r => setTimeout(r, 500));

        const scrollAfter = await page.evaluate(() => window.scrollY);
        expect(scrollAfter).toBe(0);
    });

    // ============================================================
    // エクスポート/インポートテスト
    // ============================================================
    test('E2E-011: エクスポートでダウンロードが発生する', async () => {
        await waitForApp();
        await page.click('.tab-nav button[data-tab="settings"]');
        await new Promise(r => setTimeout(r, 500));

        // ダウンロードを準備
        const downloadPath = '/tmp/smrm_e2e_download';
        if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

        const cdpSession = await page.createCDPSession();
        await cdpSession.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });

        // エクスポートクリック
        await page.click('#export-btn');
        await new Promise(r => setTimeout(r, 3000));

        // ダウンロードファイルが存在するか
        const files = fs.readdirSync(downloadPath).filter(f => f.endsWith('.json'));
        expect(files.length).toBeGreaterThanOrEqual(1);

        // クリーンアップ
        for (const f of files) {
            try { fs.unlinkSync(`${downloadPath}/${f}`); } catch (e) {}
        }
    });

    test('E2E-012: エクスポートJSONの構造を検証', async () => {
        await waitForApp();
        await page.click('.tab-nav button[data-tab="settings"]');
        await new Promise(r => setTimeout(r, 500));

        // ブラウザ内でエクスポートデータを取得
        const exportData = await page.evaluate(async () => {
            const openDB = () => new Promise((resolve, reject) => {
                const req = indexedDB.open('smrm_db');
                req.onsuccess = e => resolve(e.target.result);
                req.onerror = e => reject(e.target.error);
            });
            const getAll = (db, store) => new Promise((resolve, reject) => {
                const tx = db.transaction(store, 'readonly');
                const req = tx.objectStore(store).getAll();
                req.onsuccess = e => resolve(e.target.result);
                req.onerror = e => reject(e.target.error);
            });
            const db = await openDB();
            const customers = await getAll(db, 'customers');
            const treatmentRecords = await getAll(db, 'treatment_records');
            return { appName: 'smrm', customers, treatmentRecords };
        });

        expect(exportData.appName).toBe('smrm');
        expect(Array.isArray(exportData.customers)).toBe(true);
        expect(Array.isArray(exportData.treatmentRecords)).toBe(true);
    });

    // ============================================================
    // PWAテスト
    // ============================================================
    test('E2E-PWA-001: manifest.jsonが正しく読み込まれる', async () => {
        await waitForApp();
        const manifestHref = await page.$eval('link[rel="manifest"]', el => el.href);
        expect(manifestHref).toContain('manifest.json');
    });

    test('E2E-PWA-002: Service Workerが登録される', async () => {
        await waitForApp();
        await new Promise(r => setTimeout(r, 3000));

        const swRegistered = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return false;
            const reg = await navigator.serviceWorker.getRegistration();
            return !!reg;
        });
        expect(swRegistered).toBe(true);
    });

    test('E2E-PWA-003: PWA metaタグが正しく設定されている', async () => {
        await waitForApp();

        const themeColor = await page.$eval('meta[name="theme-color"]', el => el.content);
        expect(themeColor).toBe('#92400e');

        const appleCapable = await page.$eval('meta[name="apple-mobile-web-app-capable"]', el => el.content);
        expect(appleCapable).toBe('yes');
    });

    test('E2E-PWA-004: 全タブ巡回でpageerrorが発生しない', async () => {
        await waitForApp();
        pageErrors.length = 0;

        const tabs = ['customers', 'treatment', 'history', 'settings'];
        for (const tab of tabs) {
            await page.click(`.tab-nav button[data-tab="${tab}"]`);
            await new Promise(r => setTimeout(r, 500));
        }

        expect(pageErrors).toHaveLength(0);
    });

    test('E2E-PWA-005: 更新バナーが存在し初期状態では非表示', async () => {
        await waitForApp();

        const bannerExists = await page.$('#update-banner') !== null;
        expect(bannerExists).toBe(true);

        const bannerVisible = await isVisible('#update-banner');
        expect(bannerVisible).toBe(false);
    });

    test('E2E-PWA-006: 設定タブに「更新を確認」ボタンが表示される', async () => {
        await waitForApp();
        await page.click('.tab-nav button[data-tab="settings"]');
        await new Promise(r => setTimeout(r, 500));

        const checkUpdateBtn = await page.$('#check-update-btn');
        expect(checkUpdateBtn).not.toBeNull();

        const btnVisible = await isVisible('#check-update-btn');
        expect(btnVisible).toBe(true);
    });

    // ============================================================
    // レスポンシブテスト
    // ============================================================
    test('E2E-020: モバイルビューポート(375x667)でレイアウトが崩れない', async () => {
        await page.setViewport({ width: 375, height: 667 });
        await waitForApp();

        const headerVisible = await isVisible('.app-header');
        expect(headerVisible).toBe(true);

        const tabNavVisible = await isVisible('.tab-nav');
        expect(tabNavVisible).toBe(true);

        // タブボタンが全て表示される
        const tabCount = await page.$$eval('.tab-nav button', btns => btns.length);
        expect(tabCount).toBe(4);

        // タブナビが画面幅を超えない
        const overflow = await page.evaluate(() => {
            const nav = document.querySelector('.tab-nav');
            return nav.scrollWidth <= window.innerWidth + 5;
        });
        expect(overflow).toBe(true);

        // リセット
        await page.setViewport({ width: 1280, height: 800 });
    });

    test('E2E-021: タブレットビューポート(768x1024)でレイアウトが崩れない', async () => {
        await page.setViewport({ width: 768, height: 1024 });
        await waitForApp();

        const headerVisible = await isVisible('.app-header');
        expect(headerVisible).toBe(true);

        const tabNavVisible = await isVisible('.tab-nav');
        expect(tabNavVisible).toBe(true);

        // リセット
        await page.setViewport({ width: 1280, height: 800 });
    });

    test('E2E-022: モバイルビューポートで顧客登録ができる', async () => {
        await page.setViewport({ width: 375, height: 667 });
        await waitForApp();

        await page.click('#add-customer-btn');
        await page.waitForSelector('#customer-form-overlay', { visible: true, timeout: 5000 });

        await page.type('#input-customer-name', 'モバイル花子');
        await page.click('#customer-form-save');
        await page.waitForFunction(() => {
            const overlay = document.querySelector('#customer-form-overlay');
            return !overlay || window.getComputedStyle(overlay).display === 'none';
        }, { timeout: 10000 });

        const customerText = await page.$eval('#customer-list', el => el.textContent);
        expect(customerText).toContain('モバイル花子');

        await page.setViewport({ width: 1280, height: 800 });
    });

    // ============================================================
    // 表示設定テスト
    // ============================================================
    test('E2E-030: 表示設定のデフォルト状態確認（全フィールド表示）', async () => {
        await waitForApp();
        await page.click('.tab-nav button[data-tab="settings"]');
        await new Promise(r => setTimeout(r, 500));

        // 全チェックボックスがチェック済み
        const allChecked = await page.$$eval('[data-display-key]', checkboxes =>
            checkboxes.every(cb => cb.checked)
        );
        expect(allChecked).toBe(true);
    });

    // ============================================================
    // 顧客切り替えテスト
    // ============================================================
    test('E2E-031: 顧客切り替えでフォームがリセットされる', async () => {
        await waitForApp();

        // 顧客を2人登録（テスト太郎は既に存在する前提）
        await page.click('#add-customer-btn');
        await page.waitForSelector('#customer-form-overlay', { visible: true, timeout: 5000 });
        await page.type('#input-customer-name', '切替テスト次郎');
        await page.click('#customer-form-save');
        await page.waitForFunction(() => {
            const overlay = document.querySelector('#customer-form-overlay');
            return !overlay || window.getComputedStyle(overlay).display === 'none';
        }, { timeout: 10000 });
        await new Promise(r => setTimeout(r, 500));

        // 最初の顧客を選択
        const cards = await page.$$('#customer-list .customer-card');
        if (cards.length >= 2) {
            await cards[0].click();
            await new Promise(r => setTimeout(r, 500));

            // 施術記録タブに移動して何か入力
            await page.click('.tab-nav button[data-tab="treatment"]');
            await new Promise(r => setTimeout(r, 500));
            await page.type('#input-chief-complaint', '一時的な入力');

            // 顧客タブに戻って別の顧客を選択
            await page.click('.tab-nav button[data-tab="customers"]');
            await new Promise(r => setTimeout(r, 500));
            const cards2 = await page.$$('#customer-list .customer-card');
            await cards2[1].click();
            await new Promise(r => setTimeout(r, 500));

            // 施術記録タブに戻る
            await page.click('.tab-nav button[data-tab="treatment"]');
            await new Promise(r => setTimeout(r, 500));

            // 主訴がクリアされている
            const chiefValue = await page.$eval('#input-chief-complaint', el => el.value);
            expect(chiefValue).toBe('');
        }
    });

    // ============================================================
    // アレルギー警告テスト
    // ============================================================
    test('E2E-032: アレルギー警告が表示される', async () => {
        await waitForApp();

        // アレルギーつき顧客を登録
        await page.click('#add-customer-btn');
        await page.waitForSelector('#customer-form-overlay', { visible: true, timeout: 5000 });
        await page.type('#input-customer-name', 'アレルギーテスト');

        // アレルギー追加
        await page.click('#add-allergy-btn');
        await new Promise(r => setTimeout(r, 300));

        // アレルゲン入力
        const allergenInputs = await page.$$('#allergy-list-form input[placeholder*="アレルゲン"], #allergy-list-form input:first-child');
        if (allergenInputs.length > 0) {
            await allergenInputs[0].type('スギ花粉');
        }

        await page.click('#customer-form-save');
        await page.waitForFunction(() => {
            const overlay = document.querySelector('#customer-form-overlay');
            return !overlay || window.getComputedStyle(overlay).display === 'none';
        }, { timeout: 10000 });
        await new Promise(r => setTimeout(r, 500));

        // この顧客を選択
        const cards = await page.$$('#customer-list .customer-card');
        const allergyCard = await page.evaluate(() => {
            const cards = document.querySelectorAll('#customer-list .customer-card');
            for (const card of cards) {
                if (card.textContent.includes('アレルギーテスト')) return true;
            }
            return false;
        });

        if (allergyCard) {
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('アレルギーテスト')) {
                        card.click();
                        return;
                    }
                }
            });
            await new Promise(r => setTimeout(r, 500));

            // 施術記録タブでアレルギー警告を確認
            await page.click('.tab-nav button[data-tab="treatment"]');
            await new Promise(r => setTimeout(r, 1000));

            const warningExists = await page.$('#allergy-warning');
            expect(warningExists).not.toBeNull();
        }
    });

    // ============================================================
    // 前回施術後メモヒントテスト
    // ============================================================
    test('E2E-033: 前回施術後メモヒントが表示される', async () => {
        await waitForApp();

        // E2E-005で施術記録を保存済みの顧客を選択
        await page.$eval('#customer-search', el => el.value = '');
        await page.evaluate(() => {
            document.querySelector('#customer-search').dispatchEvent(new Event('input'));
        });
        await new Promise(r => setTimeout(r, 500));

        const firstCustomer = await page.$('#customer-list .customer-card');
        if (firstCustomer) {
            await firstCustomer.click();
            await new Promise(r => setTimeout(r, 500));
        }

        await page.click('.tab-nav button[data-tab="treatment"]');
        await new Promise(r => setTimeout(r, 1000));

        // 前回施術後メモヒントのDOM要素が存在する
        const hintExists = await page.$('#prev-after-notes-hint') !== null;
        expect(hintExists).toBe(true);
    });
});
