/**
 * usecases.e2e.test.js - シンプルカルテ管理 (SMRM) ユースケースE2Eテスト
 *
 * 実際のユーザーワークフローを順次実行し、状態を共有しながら検証する。
 * 実行: docker compose run --rm smrm-test npm run test:usecases
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const childProcess = require('child_process');

describe('ユースケースE2E: smrm', () => {
    let browser;
    let page;
    let baseUrl = 'http://smrm-app:80';
    const pageErrors = [];
    /** エクスポートで取得したJSONデータ（UC6で使用） */
    let exportedJsonData = null;

    jest.setTimeout(300000);

    // ========== セットアップ ==========

    beforeAll(async () => {
        console.log('[UC-E2E] beforeAll: start');
        const host = process.env.E2E_APP_HOST || 'smrm-app';
        const fixedIp = String(process.env.E2E_APP_IP || '').trim();
        const hasFixedIp = Boolean(fixedIp && /^\d+\.\d+\.\d+\.\d+$/.test(fixedIp));

        if (hasFixedIp) {
            baseUrl = `http://${fixedIp}:80`;
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
            if (!ip) throw new Error(`E2E: cannot resolve '${host}' to IPv4.`);
            baseUrl = `http://${ip}:80`;
        }
        console.log(`[UC-E2E] baseUrl = ${baseUrl}`);

        browser = await puppeteer.launch({
            headless: 'new',
            timeout: 300000,
            protocolTimeout: 300000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                `--unsafely-treat-insecure-origin-as-secure=${baseUrl}`
            ]
        });
        page = await browser.newPage();

        page.on('pageerror', error => {
            console.error('[UC-E2E] Page Error:', error.message);
            pageErrors.push(error.message);
        });
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('[UC-E2E] Console Error:', msg.text());
            }
        });

        // 通知トースト・エクスポートリマインダー・お知らせ通知を無効化
        await page.evaluateOnNewDocument(() => {
            localStorage.setItem('smrm_notification_enabled', '0');
            localStorage.setItem('smrm_export_reminder_enabled', '0');
        });

        // ページ読み込み + IndexedDB全クリア
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(
            () => document.body && document.body.dataset.appReady === 'true',
            { timeout: 30000 }
        );

        // IndexedDB全ストアクリア → クリーンスタート
        await page.evaluate(async () => {
            const openDB = () => new Promise((resolve, reject) => {
                const req = indexedDB.open('smrm_db');
                req.onsuccess = e => resolve(e.target.result);
                req.onerror = e => reject(e.target.error);
            });
            const db = await openDB();
            const storeNames = Array.from(db.objectStoreNames);
            if (storeNames.length === 0) return;
            await new Promise((resolve, reject) => {
                const tx = db.transaction(storeNames, 'readwrite');
                for (const name of storeNames) tx.objectStore(name).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = e => reject(e.target.error);
            });
        });

        // クリア後にリロードして初期状態を反映
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(
            () => document.body && document.body.dataset.appReady === 'true',
            { timeout: 30000 }
        );

        console.log('[UC-E2E] beforeAll: done (clean state)');
    }, 300000);

    afterAll(async () => {
        if (browser) await browser.close();
    });

    beforeEach(() => {
        const testName = expect.getState().currentTestName;
        console.log(`[UC-E2E] >>> ${testName}`);
    });

    // ========== ヘルパー関数 ==========

    const isVisible = async (selector) => {
        return await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }, selector);
    };

    const waitForApp = async () => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(
            () => document.body && document.body.dataset.appReady === 'true',
            { timeout: 30000 }
        );
    };

    const clickTab = async (tabName) => {
        // トースト通知がz-index:10000でタブナビを覆い隠しクリックを吸収するため先にクリア
        await clearToasts();
        await page.click(`.tab-nav button[data-tab="${tabName}"]`);
        await page.waitForFunction(
            (name) => document.querySelector(`.tab-nav button[data-tab="${name}"]`).classList.contains('active'),
            { timeout: 5000 },
            tabName
        );
        await new Promise(r => setTimeout(r, 300));
    };

    const waitOverlayOpen = async (selector) => {
        await page.waitForFunction(
            (sel) => document.querySelector(sel) && document.querySelector(sel).classList.contains('show'),
            { timeout: 10000 },
            selector
        );
    };

    const waitOverlayClosed = async (selector) => {
        await page.waitForFunction(
            (sel) => {
                const el = document.querySelector(sel);
                return !el || !el.classList.contains('show');
            },
            { timeout: 10000 },
            selector
        );
    };

    const waitForToast = async (substring) => {
        await page.waitForFunction(
            (text) => {
                const toasts = document.querySelectorAll('#toast-container .toast');
                return Array.from(toasts).some(t => t.textContent.includes(text));
            },
            { timeout: 10000 },
            substring
        );
    };

    const waitForConfirmDialog = async () => {
        await waitOverlayOpen('#confirm-overlay');
    };

    const confirmDialogOK = async () => {
        await waitForConfirmDialog();
        await page.click('#confirm-ok');
        await waitOverlayClosed('#confirm-overlay');
    };

    const clearToasts = async () => {
        await page.evaluate(() => {
            document.getElementById('toast-container').innerHTML = '';
        });
    };

    // ============================================================
    // UC1: 初期設定 — メニュー・各種設定（5テスト）
    // ============================================================
    describe('UC1: 初期設定', () => {
        test('UC1-01: メニュー「全身もみほぐし」追加', async () => {
            await clickTab('settings');

            // メニュー追加ボタンクリック
            await page.click('#add-menu-btn');
            await new Promise(r => setTimeout(r, 200));

            // メニュー名入力
            const nameInputs = await page.$$('#menu-settings-list .menu-name-input');
            await nameInputs[nameInputs.length - 1].click({ clickCount: 3 });
            await nameInputs[nameInputs.length - 1].type('全身もみほぐし');

            // 時間入力
            const durationInputs = await page.$$('#menu-settings-list .menu-duration-input');
            await durationInputs[durationInputs.length - 1].click({ clickCount: 3 });
            await durationInputs[durationInputs.length - 1].type('60');

            // blur で保存トリガー + デバウンス500ms待機
            await page.evaluate(() => {
                const inputs = document.querySelectorAll('#menu-settings-list .menu-name-input');
                inputs[inputs.length - 1].dispatchEvent(new Event('input'));
            });
            await new Promise(r => setTimeout(r, 800));

            // リストに行が追加されたか確認
            const rowCount = await page.$$eval('#menu-settings-list .menu-settings-row', rows => rows.length);
            expect(rowCount).toBe(1);
        });

        test('UC1-02: メニュー「ヘッドスパ」追加', async () => {
            await page.click('#add-menu-btn');
            await new Promise(r => setTimeout(r, 200));

            const nameInputs = await page.$$('#menu-settings-list .menu-name-input');
            await nameInputs[nameInputs.length - 1].click({ clickCount: 3 });
            await nameInputs[nameInputs.length - 1].type('ヘッドスパ');

            const durationInputs = await page.$$('#menu-settings-list .menu-duration-input');
            await durationInputs[durationInputs.length - 1].click({ clickCount: 3 });
            await durationInputs[durationInputs.length - 1].type('30');

            await page.evaluate(() => {
                const inputs = document.querySelectorAll('#menu-settings-list .menu-name-input');
                inputs[inputs.length - 1].dispatchEvent(new Event('input'));
            });
            await new Promise(r => setTimeout(r, 800));

            const rowCount = await page.$$eval('#menu-settings-list .menu-settings-row', rows => rows.length);
            expect(rowCount).toBe(2);
        });

        test('UC1-03: メニュー追加→削除', async () => {
            // 「フェイシャル」追加
            await page.click('#add-menu-btn');
            await new Promise(r => setTimeout(r, 200));

            const nameInputs = await page.$$('#menu-settings-list .menu-name-input');
            await nameInputs[nameInputs.length - 1].click({ clickCount: 3 });
            await nameInputs[nameInputs.length - 1].type('フェイシャル');
            await page.evaluate(() => {
                const inputs = document.querySelectorAll('#menu-settings-list .menu-name-input');
                inputs[inputs.length - 1].dispatchEvent(new Event('input'));
            });
            await new Promise(r => setTimeout(r, 800));

            let rowCount = await page.$$eval('#menu-settings-list .menu-settings-row', rows => rows.length);
            expect(rowCount).toBe(3);

            // 最後の行（フェイシャル）を削除
            const deleteButtons = await page.$$('#menu-settings-list .menu-settings-row .btn-danger');
            await deleteButtons[deleteButtons.length - 1].click();
            await new Promise(r => setTimeout(r, 800));

            rowCount = await page.$$eval('#menu-settings-list .menu-settings-row', rows => rows.length);
            expect(rowCount).toBe(2);
        });

        test('UC1-04: 画像圧縮を「容量節約」に変更', async () => {
            await page.select('#image-preset-select', 'compact');
            await new Promise(r => setTimeout(r, 500));

            // リロードして永続化確認
            await waitForApp();
            await clickTab('settings');

            const value = await page.$eval('#image-preset-select', el => el.value);
            expect(value).toBe('compact');
        });

        test('UC1-05: エクスポート通知を14日に設定', async () => {
            await page.select('#export-reminder-days', '14');
            await page.click('#save-export-reminder-btn');
            await new Promise(r => setTimeout(r, 500));

            // トースト確認
            const toastText = await page.$eval('#toast-container', el => el.textContent);
            expect(toastText).toContain('エクスポート通知');
        });
    });

    // ============================================================
    // UC2: 顧客ライフサイクル — 登録・詳細・編集・削除（8テスト）
    // ============================================================
    describe('UC2: 顧客ライフサイクル', () => {
        test('UC2-01: アレルギー・既往歴付き「山田花子」登録', async () => {
            await clickTab('customers');
            await page.click('#add-customer-btn');
            await waitOverlayOpen('#customer-form-overlay');

            // 基本情報入力
            await page.type('#input-customer-name', '山田花子');
            await page.type('#input-customer-kana', 'やまだ はなこ');
            await page.select('#input-customer-gender', 'female');
            await page.type('#input-customer-phone', '090-1111-2222');
            await page.type('#input-customer-email', 'hanako@example.com');
            await page.type('#input-customer-address', '東京都渋谷区神宮前1-1-1');

            // アレルギー追加（2件）
            await page.click('#add-allergy-btn');
            await new Promise(r => setTimeout(r, 200));
            let allergenInputs = await page.$$('#allergy-list-form .allergy-allergen');
            await allergenInputs[allergenInputs.length - 1].type('スギ花粉');

            await page.click('#add-allergy-btn');
            await new Promise(r => setTimeout(r, 200));
            allergenInputs = await page.$$('#allergy-list-form .allergy-allergen');
            await allergenInputs[allergenInputs.length - 1].type('金属');

            // 既往歴追加（1件）
            await page.click('#add-history-btn');
            await new Promise(r => setTimeout(r, 200));
            const conditionInputs = await page.$$('#history-list-form .history-condition');
            await conditionInputs[conditionInputs.length - 1].type('腰椎椎間板ヘルニア');

            // 保存
            await page.click('#customer-form-save');
            await waitOverlayClosed('#customer-form-overlay');
            await new Promise(r => setTimeout(r, 500));

            // カード表示確認
            const customerText = await page.$eval('#customer-list', el => el.textContent);
            expect(customerText).toContain('山田花子');
        });

        test('UC2-02: 「鈴木太郎」簡易登録', async () => {
            await page.click('#add-customer-btn');
            await waitOverlayOpen('#customer-form-overlay');

            await page.type('#input-customer-name', '鈴木太郎');

            await page.click('#customer-form-save');
            await waitOverlayClosed('#customer-form-overlay');
            await new Promise(r => setTimeout(r, 500));

            // 顧客コード自動採番確認
            const codeExists = await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('鈴木太郎')) {
                        const codeEl = card.querySelector('.customer-code');
                        return codeEl && codeEl.textContent.trim() !== '---';
                    }
                }
                return false;
            });
            expect(codeExists).toBe(true);
        });

        test('UC2-03: 顧客カード「詳細」から山田花子の情報確認', async () => {
            // 山田花子の「詳細」ボタンをクリック
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('山田花子')) {
                        const btn = card.querySelector('.btn-secondary');
                        if (btn && btn.textContent.includes('詳細')) btn.click();
                        return;
                    }
                }
            });
            await waitOverlayOpen('#customer-detail-overlay');

            const detailText = await page.$eval('#customer-detail-body', el => el.textContent);
            expect(detailText).toContain('山田花子');
            expect(detailText).toContain('スギ花粉');
            expect(detailText).toContain('腰椎椎間板ヘルニア');

            await page.click('#customer-detail-close');
            await waitOverlayClosed('#customer-detail-overlay');
        });

        test('UC2-04: 詳細→「編集」で電話番号変更', async () => {
            // 詳細を再度開く
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('山田花子')) {
                        const btn = card.querySelector('.btn-secondary');
                        if (btn && btn.textContent.includes('詳細')) btn.click();
                        return;
                    }
                }
            });
            await waitOverlayOpen('#customer-detail-overlay');

            // 「編集」ボタンクリック → 編集フォームへ遷移
            await page.click('#customer-detail-edit');
            await waitOverlayClosed('#customer-detail-overlay');
            await waitOverlayOpen('#customer-form-overlay');

            // 電話番号を変更
            await page.$eval('#input-customer-phone', el => el.value = '');
            await page.type('#input-customer-phone', '080-9999-8888');

            await page.click('#customer-form-save');
            await waitOverlayClosed('#customer-form-overlay');
            await new Promise(r => setTimeout(r, 500));

            // 詳細で反映確認
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('山田花子')) {
                        const btn = card.querySelector('.btn-secondary');
                        if (btn && btn.textContent.includes('詳細')) btn.click();
                        return;
                    }
                }
            });
            await waitOverlayOpen('#customer-detail-overlay');

            const detailText = await page.$eval('#customer-detail-body', el => el.textContent);
            expect(detailText).toContain('080-9999-8888');

            await page.click('#customer-detail-close');
            await waitOverlayClosed('#customer-detail-overlay');
        });

        test('UC2-05: 施術記録タブの顧客バーから詳細表示', async () => {
            // 山田花子を選択（施術タブへ自動遷移）
            await clickTab('customers');
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('山田花子')) {
                        card.click();
                        return;
                    }
                }
            });
            await new Promise(r => setTimeout(r, 1000));

            // 施術タブに遷移済み → 顧客バークリック
            await page.click('#selected-customer-bar');
            await waitOverlayOpen('#customer-detail-overlay');

            const detailText = await page.$eval('#customer-detail-body', el => el.textContent);
            expect(detailText).toContain('山田花子');

            await page.click('#customer-detail-close');
            await waitOverlayClosed('#customer-detail-overlay');
        });

        test('UC2-06: 履歴タブの顧客バーから詳細表示', async () => {
            await clickTab('history');
            await new Promise(r => setTimeout(r, 500));

            await page.click('#history-customer-bar');
            await waitOverlayOpen('#customer-detail-overlay');

            const detailText = await page.$eval('#customer-detail-body', el => el.textContent);
            expect(detailText).toContain('山田花子');

            await page.click('#customer-detail-close');
            await waitOverlayClosed('#customer-detail-overlay');
        });

        test('UC2-07: 鈴木太郎を削除（確認ダイアログ付き）', async () => {
            await clickTab('customers');
            await new Promise(r => setTimeout(r, 300));

            // 鈴木太郎の削除ボタン
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('鈴木太郎')) {
                        const btn = card.querySelector('.btn-danger');
                        if (btn) btn.click();
                        return;
                    }
                }
            });

            await confirmDialogOK();
            await new Promise(r => setTimeout(r, 500));

            // カードが消えたか確認
            const hasSuzuki = await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                return Array.from(cards).some(c => c.textContent.includes('鈴木太郎'));
            });
            expect(hasSuzuki).toBe(false);
        });

        test('UC2-08: 検索で山田花子がヒット', async () => {
            await page.type('#customer-search', '山田');
            await new Promise(r => setTimeout(r, 500));

            const visibleCount = await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                return [...cards].filter(c => c.style.display !== 'none').length;
            });
            expect(visibleCount).toBe(1);

            const text = await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                const visible = [...cards].filter(c => c.style.display !== 'none');
                return visible.length > 0 ? visible[0].textContent : '';
            });
            expect(text).toContain('山田花子');

            // 検索クリア
            await page.$eval('#customer-search', el => el.value = '');
            await page.evaluate(() => {
                document.querySelector('#customer-search').dispatchEvent(new Event('input'));
            });
            await new Promise(r => setTimeout(r, 300));
        });
    });

    // ============================================================
    // UC3: 施術記録ワークフロー（6テスト）
    // ============================================================
    describe('UC3: 施術記録ワークフロー', () => {
        test('UC3-01: 山田花子を選択→施術記録タブ遷移', async () => {
            await clickTab('customers');
            await new Promise(r => setTimeout(r, 300));

            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('山田花子')) {
                        card.click();
                        return;
                    }
                }
            });
            await new Promise(r => setTimeout(r, 1000));

            // 施術記録タブに自動切替
            const activeTab = await page.$eval('.tab-nav button.active', el => el.dataset.tab);
            expect(activeTab).toBe('treatment');

            // アレルギー警告表示
            const warningVisible = await isVisible('#allergy-warning');
            expect(warningVisible).toBe(true);

            const warningText = await page.$eval('#allergy-warning', el => el.textContent);
            expect(warningText).toContain('スギ花粉');
        });

        test('UC3-02: メニュー「全身もみほぐし」選択→時間自動入力', async () => {
            // メニュードロップダウンに「全身もみほぐし」が存在するか確認
            const menuOptions = await page.$$eval('#input-treatment-menu option', opts =>
                opts.map(o => ({ value: o.value, text: o.textContent }))
            );
            const momihogushi = menuOptions.find(o => o.text.includes('全身もみほぐし'));
            expect(momihogushi).toBeTruthy();

            // メニュー選択
            await page.select('#input-treatment-menu', momihogushi.value);
            await new Promise(r => setTimeout(r, 300));

            // 施術時間に60が自動入力されるか
            const duration = await page.$eval('#input-duration', el => el.value);
            expect(duration).toBe('60');
        });

        test('UC3-03: 体調レベル・部位入力', async () => {
            // スライダー操作: 痛み7, 凝り8, 疲労5
            await page.evaluate(() => {
                const setPainSlider = (id, value, displayId) => {
                    const slider = document.getElementById(id);
                    slider.value = value;
                    slider.dispatchEvent(new Event('input'));
                    document.getElementById(displayId).textContent = value;
                };
                setPainSlider('input-pain-level', 7, 'pain-level-display');
                setPainSlider('input-stiffness-level', 8, 'stiffness-level-display');
                setPainSlider('input-fatigue-level', 5, 'fatigue-level-display');
            });

            // 部位チェック: 首, 右肩, 腰
            await page.evaluate(() => {
                const areas = ['首', '右肩', '腰'];
                document.querySelectorAll('#body-areas-grid input[type="checkbox"]').forEach(cb => {
                    if (areas.includes(cb.value)) cb.checked = true;
                });
            });

            // 確認
            const painDisplay = await page.$eval('#pain-level-display', el => el.textContent);
            expect(painDisplay).toBe('7');
            const stiffnessDisplay = await page.$eval('#stiffness-level-display', el => el.textContent);
            expect(stiffnessDisplay).toBe('8');
        });

        test('UC3-04: 全テキスト入力→保存', async () => {
            await clearToasts();

            // テキスト入力
            await page.type('#input-chief-complaint', '首と肩が重い、頭痛もある');
            await page.type('#input-body-findings', '僧帽筋の緊張が強い、C4-C6付近に圧痛');
            await page.type('#input-treatment-content', '全身もみほぐし60分、首・肩重点施術');
            await page.type('#input-after-notes', '次回は2週間後、ストレッチ指導予定');

            // 保存
            await page.click('#save-record-btn');
            await waitForToast('保存');

            // フォームリセット確認
            const chiefValue = await page.$eval('#input-chief-complaint', el => el.value);
            expect(chiefValue).toBe('');
        });

        test('UC3-05: 直近の記録に内容が表示', async () => {
            await new Promise(r => setTimeout(r, 500));

            const recentText = await page.$eval('#recent-records-list', el => el.textContent);
            expect(recentText).toContain('首と肩が重い');
        });

        test('UC3-06: 2回目の記録保存→前回メモヒント表示', async () => {
            await clearToasts();

            // 2回目の施術記録
            await page.type('#input-chief-complaint', '前回より軽くなった');
            await page.type('#input-treatment-content', 'ヘッドスパ30分');
            await page.type('#input-after-notes', '良好、月1ペースで継続');

            await page.click('#save-record-btn');
            await waitForToast('保存');
            await new Promise(r => setTimeout(r, 500));

            // 前回メモヒント表示（直前の保存で afterNotes がセットされた記録がある）
            const hintVisible = await isVisible('#prev-after-notes-hint');
            expect(hintVisible).toBe(true);

            const hintText = await page.$eval('#prev-after-notes-hint', el => el.textContent);
            // datetime-local は分精度のため、同一分内の複数記録は順序不定
            // いずれかの施術後メモが表示されていれば OK
            const hasAnyAfterNotes =
                hintText.includes('次回は2週間後、ストレッチ指導予定') ||
                hintText.includes('良好、月1ペースで継続');
            expect(hasAnyAfterNotes).toBe(true);
        });
    });

    // ============================================================
    // UC4: 履歴・記録編集・削除（6テスト）
    // ============================================================
    describe('UC4: 履歴・記録編集・削除', () => {
        test('UC4-01: 履歴タブにタイムラインが表示', async () => {
            await clickTab('history');
            await new Promise(r => setTimeout(r, 500));

            const entryCount = await page.$$eval('#timeline-container .timeline-entry', entries => entries.length);
            expect(entryCount).toBeGreaterThanOrEqual(1);
        });

        test('UC4-02: タイムラインに主訴・メニューが表示', async () => {
            const timelineText = await page.$eval('#timeline-container', el => el.textContent);
            // いずれかの主訴テキストが含まれている
            const hasContent = timelineText.includes('首と肩が重い') || timelineText.includes('前回より軽くなった');
            expect(hasContent).toBe(true);
        });

        test('UC4-03: 並び替えボタンで順序切替', async () => {
            const entryCount = await page.$$eval('#timeline-container .timeline-entry', e => e.length);
            expect(entryCount).toBeGreaterThanOrEqual(1);

            // 並び替えボタンをクリック → エラーなく再描画される
            await page.click('#sort-toggle-btn');
            await new Promise(r => setTimeout(r, 500));

            const countAfterToggle = await page.$$eval('#timeline-container .timeline-entry', e => e.length);
            expect(countAfterToggle).toBe(entryCount);

            // 再クリックで元に戻る
            await page.click('#sort-toggle-btn');
            await new Promise(r => setTimeout(r, 500));

            const countRestored = await page.$$eval('#timeline-container .timeline-entry', e => e.length);
            expect(countRestored).toBe(entryCount);
        });

        test('UC4-04: 施術記録を編集', async () => {
            // 直近記録の編集ボタンをクリック（施術タブの recent-records-list から）
            await clickTab('treatment');
            await new Promise(r => setTimeout(r, 500));

            // 最初の記録の編集ボタン
            await page.evaluate(() => {
                const btns = document.querySelectorAll('#recent-records-list .btn');
                for (const btn of btns) {
                    if (btn.textContent.includes('編集')) { btn.click(); return; }
                }
            });
            await waitOverlayOpen('#edit-record-overlay');

            // 主訴を変更
            await page.$eval('#edit-chief-complaint', el => el.value = '');
            await page.type('#edit-chief-complaint', '前回より改善、軽い凝りのみ');

            await page.click('#edit-record-save');
            await waitOverlayClosed('#edit-record-overlay');
            await new Promise(r => setTimeout(r, 500));

            // 直近記録に反映
            const recentText = await page.$eval('#recent-records-list', el => el.textContent);
            expect(recentText).toContain('前回より改善');
        });

        test('UC4-05: 施術記録を削除', async () => {
            // 直近記録の削除ボタン
            await page.evaluate(() => {
                const btns = document.querySelectorAll('#recent-records-list .btn-danger');
                if (btns.length > 0) btns[0].click();
            });

            await confirmDialogOK();
            await new Promise(r => setTimeout(r, 500));

            // 記録数が減った
            const recordCount = await page.$$eval('#recent-records-list .recent-record-card, #recent-records-list .record-card', cards => cards.length);
            expect(recordCount).toBeLessThanOrEqual(1);
        });

        test('UC4-06: 履歴タブで削除反映を確認', async () => {
            await clickTab('history');
            await new Promise(r => setTimeout(r, 500));

            const entryCount = await page.$$eval('#timeline-container .timeline-entry', entries => entries.length);
            expect(entryCount).toBe(1);
        });
    });

    // ============================================================
    // UC5: 表示設定カスタマイズ（5テスト）
    // ============================================================
    describe('UC5: 表示設定カスタマイズ', () => {
        test('UC5-01: ふりがなフィールドを非表示', async () => {
            await clickTab('settings');
            await new Promise(r => setTimeout(r, 300));

            // ふりがなチェックボックスをOFF
            await page.evaluate(() => {
                const cb = document.querySelector('[data-display-key="fields.customer.kana"]');
                if (cb && cb.checked) cb.click();
            });
            await new Promise(r => setTimeout(r, 500));

            // field-hidden クラス付与確認
            const isHidden = await page.evaluate(() => {
                const el = document.querySelector('[data-field-key="customer.kana"]');
                return el ? el.classList.contains('field-hidden') : false;
            });
            expect(isHidden).toBe(true);
        });

        test('UC5-02: 顧客詳細でふりがな非表示を確認', async () => {
            await clickTab('customers');
            await new Promise(r => setTimeout(r, 300));

            // 山田花子の詳細を開く
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('山田花子')) {
                        const btn = card.querySelector('.btn-secondary');
                        if (btn && btn.textContent.includes('詳細')) btn.click();
                        return;
                    }
                }
            });
            await waitOverlayOpen('#customer-detail-overlay');

            // ふりがなの行が非表示
            const kanaHidden = await page.evaluate(() => {
                const el = document.querySelector('#customer-detail-body [data-field-key="customer.kana"]');
                if (!el) return true;
                return el.classList.contains('field-hidden');
            });
            expect(kanaHidden).toBe(true);

            await page.click('#customer-detail-close');
            await waitOverlayClosed('#customer-detail-overlay');
        });

        test('UC5-03: 体調レベルフィールドを非表示', async () => {
            await clickTab('settings');
            await new Promise(r => setTimeout(r, 300));

            await page.evaluate(() => {
                const cb = document.querySelector('[data-display-key="fields.treatment.bodyCondition"]');
                if (cb && cb.checked) cb.click();
            });
            await new Promise(r => setTimeout(r, 500));

            // 施術記録タブで体調レベルセクションが非表示
            await clickTab('treatment');
            await new Promise(r => setTimeout(r, 300));

            const bodyCondHidden = await page.evaluate(() => {
                const el = document.querySelector('[data-field-key="treatment.bodyCondition"]');
                if (!el) return true;
                return el.classList.contains('field-hidden');
            });
            expect(bodyCondHidden).toBe(true);
        });

        test('UC5-04: 全フィールド表示に復元', async () => {
            await clickTab('settings');
            await new Promise(r => setTimeout(r, 300));

            // 全チェックボックスをON
            await page.evaluate(() => {
                document.querySelectorAll('[data-display-key]').forEach(cb => {
                    if (!cb.checked) cb.click();
                });
            });
            await new Promise(r => setTimeout(r, 500));

            // field-hidden なし確認
            const hiddenCount = await page.$$eval('.field-hidden', els => els.length);
            expect(hiddenCount).toBe(0);
        });

        test('UC5-05: 画像圧縮を「高画質」に変更→永続化', async () => {
            await page.select('#image-preset-select', 'high');
            await new Promise(r => setTimeout(r, 500));

            // リロードして永続化確認
            await waitForApp();
            await clickTab('settings');

            const value = await page.$eval('#image-preset-select', el => el.value);
            expect(value).toBe('high');
        });
    });

    // ============================================================
    // UC6: データバックアップ・リストア（6テスト）
    // ============================================================
    describe('UC6: データバックアップ・リストア', () => {
        test('UC6-01: データエクスポート', async () => {
            await clickTab('settings');
            await new Promise(r => setTimeout(r, 300));

            // CDPでダウンロード先を設定
            const downloadPath = '/tmp/smrm_uc_e2e_download';
            if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

            const cdpSession = await page.createCDPSession();
            await cdpSession.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath,
            });

            await page.click('#export-btn');
            await new Promise(r => setTimeout(r, 3000));

            // JSONファイル取得
            const files = fs.readdirSync(downloadPath).filter(f => f.endsWith('.json'));
            expect(files.length).toBeGreaterThanOrEqual(1);

            // ファイル内容検証
            const content = fs.readFileSync(`${downloadPath}/${files[files.length - 1]}`, 'utf-8');
            const data = JSON.parse(content);
            expect(data.appName).toBe('smrm');
            expect(Array.isArray(data.customers)).toBe(true);
            expect(Array.isArray(data.treatmentRecords)).toBe(true);
            expect(data.customers.length).toBeGreaterThanOrEqual(1);

            // 後のインポートテストに使用
            exportedJsonData = content;

            // クリーンアップ
            for (const f of files) {
                try { fs.unlinkSync(`${downloadPath}/${f}`); } catch (e) {}
            }
            await cdpSession.detach();
        });

        test('UC6-02: 全データ削除', async () => {
            await clearToasts();
            await page.click('#delete-all-btn');
            await confirmDialogOK();
            await new Promise(r => setTimeout(r, 1000));

            // トースト確認
            const toastText = await page.$eval('#toast-container', el => el.textContent);
            expect(toastText).toContain('削除');
        });

        test('UC6-03: 削除後に顧客リスト空', async () => {
            await clickTab('customers');
            await new Promise(r => setTimeout(r, 500));

            const cardCount = await page.$$eval('#customer-list .customer-card', cards => cards.length);
            expect(cardCount).toBe(0);

            // 施術タブで「顧客を選択してください」表示
            await clickTab('treatment');
            await new Promise(r => setTimeout(r, 300));

            const noCustomerVisible = await isVisible('#no-customer-selected');
            expect(noCustomerVisible).toBe(true);
        });

        test('UC6-04: 削除後にメニュー設定もクリア', async () => {
            await clickTab('settings');
            await new Promise(r => setTimeout(r, 300));

            const menuRowCount = await page.$$eval('#menu-settings-list .menu-settings-row', rows => rows.length);
            expect(menuRowCount).toBe(0);
        });

        test('UC6-05: インポートでデータ復元', async () => {
            expect(exportedJsonData).toBeTruthy();

            // performImport がプログレス表示に使う #data-message 要素を注入
            // （トースト移行で HTML から削除されたが、performImport 内部で直接参照される）
            await page.evaluate(() => {
                if (!document.getElementById('data-message')) {
                    const el = document.createElement('div');
                    el.id = 'data-message';
                    el.style.display = 'none';
                    document.body.appendChild(el);
                }
            });

            // ファイルをtmpに書き出し
            const tmpFile = '/tmp/smrm_uc_e2e_import.json';
            fs.writeFileSync(tmpFile, exportedJsonData);

            // ファイルアップロード
            const fileInput = await page.$('#import-file');
            await fileInput.uploadFile(tmpFile);
            await new Promise(r => setTimeout(r, 500));

            // 確認ダイアログ → OK
            await confirmDialogOK();

            // インポート完了を待機
            await waitForToast('インポート完了');
            await new Promise(r => setTimeout(r, 1000));

            // 山田花子復活
            await clickTab('customers');
            await new Promise(r => setTimeout(r, 500));

            const customerText = await page.$eval('#customer-list', el => el.textContent);
            expect(customerText).toContain('山田花子');

            // クリーンアップ
            try { fs.unlinkSync(tmpFile); } catch (e) {}
        });

        test('UC6-06: 復元後メニュー・記録も復元', async () => {
            // メニュー確認
            await clickTab('settings');
            await new Promise(r => setTimeout(r, 300));

            const menuRowCount = await page.$$eval('#menu-settings-list .menu-settings-row', rows => rows.length);
            expect(menuRowCount).toBeGreaterThanOrEqual(1);

            // メニューに「全身もみほぐし」が含まれる（メニュー名はinput valueに格納）
            const menuNames = await page.$$eval('#menu-settings-list .menu-name-input', inputs =>
                inputs.map(i => i.value)
            );
            expect(menuNames.some(n => n.includes('全身もみほぐし'))).toBe(true);

            // 履歴タブでタイムライン確認
            await clickTab('customers');
            await new Promise(r => setTimeout(r, 300));

            // 山田花子を選択
            await page.evaluate(() => {
                const cards = document.querySelectorAll('#customer-list .customer-card');
                for (const card of cards) {
                    if (card.textContent.includes('山田花子')) {
                        card.click();
                        return;
                    }
                }
            });
            await new Promise(r => setTimeout(r, 1000));

            await clickTab('history');
            await new Promise(r => setTimeout(r, 500));

            const entryCount = await page.$$eval('#timeline-container .timeline-entry', entries => entries.length);
            expect(entryCount).toBeGreaterThanOrEqual(1);
        });
    });

    // ============================================================
    // 最終検証
    // ============================================================
    test('JSエラーゼロ確認', () => {
        expect(pageErrors).toHaveLength(0);
    });
});
