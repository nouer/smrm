#!/usr/bin/env node
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function main() {
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: '/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        defaultViewport: { width: 375, height: 812 }
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:8086', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.tab-nav', { timeout: 10000 });

    const samplePath = path.join(__dirname, '..', 'local_app', 'sample_data.json');
    const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));

    await page.evaluate(async (customers) => {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('smrm_db', 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        const tx = db.transaction('customers', 'readwrite');
        const store = tx.objectStore('customers');
        for (const c of customers) { store.put(c); }
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }, sampleData.customers.slice(0, 10));

    await page.goto('http://localhost:8086', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.tab-nav', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
        path: path.join(__dirname, '..', 'docs', 'images', '12_mobile_customers.png'),
        fullPage: false
    });
    console.log('Done');

    await page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('smrm_db', 1);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        const tx = db.transaction('customers', 'readwrite');
        tx.objectStore('customers').clear();
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    });

    await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
