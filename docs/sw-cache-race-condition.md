# Service Worker キャッシュ競合（Race Condition）対策ガイド

## 概要

PWAアプリにおいて、Service Workerの `skipWaiting()` + `clients.claim()` + cache-first戦略の組み合わせにより、旧HTMLと新JSが混在するキャッシュ不整合が発生する。この不整合により、新JSが参照するDOM要素が旧HTMLに存在せず、null参照エラーでアプリ全体が機能不全に陥る。

## 発生条件

1. ブラウザに旧Service Workerが稼働中（旧キャッシュ保持）
2. サーバーに新ファイルが配置される（Dockerリビルド等）
3. ページアクセス時、旧SWが旧 `index.html` をキャッシュから返す
4. 新SWが `skipWaiting()` で即座にアクティベート → `clients.claim()`
5. `<script src="script.js">` のフェッチが新SWに切り替わり、新JSがロードされる
6. **旧HTML（新要素なし）+ 新JS（新要素操作コードあり）= null参照エラー**

## 影響

- `initApp()` 内でTypeErrorが発生すると、それ以降のイベントリスナー登録がすべて中断
- アプリ全体（顧客詳細、設定、メディア添付等）が操作不能になる
- E2Eテストでは毎回クリーンブラウザのため検出不能

## 修正パターン

### イベントリスナー登録（initApp内）

```javascript
// NG: nullの場合にTypeErrorで後続処理が全て中断
document.getElementById('some-element').addEventListener('click', handler);

// OK: initUpdateBanner() パターンに準拠
const el = document.getElementById('some-element');
if (el) {
    el.addEventListener('click', handler);
}
```

### DOM操作関数

```javascript
// NG: overlay要素が存在しない場合にTypeError
const overlay = document.getElementById('some-overlay');
overlay.dataset.someId = id;

// OK: 早期リターンで安全に処理
const overlay = document.getElementById('some-overlay');
if (!overlay) return;
overlay.dataset.someId = id;
```

## 各アプリの対応状況

同様のSW+PWA構成を持つ全6アプリに同じ脆弱性が存在する。

| アプリ | 脆弱な呼び出し数 | 防御パターン数 | リスク |
|--------|-----------------|---------------|--------|
| pado   | 43              | 4             | HIGH   |
| sbpr   | 22              | 1             | HIGH   |
| smrm   | 20              | 4             | MEDIUM |
| semr   | 19              | 0             | MEDIUM |
| stok   | 13              | 0             | MEDIUM |
| tana   | 3               | 1             | LOW    |

## 対応優先度

1. **smrm** — 本ドキュメントの発端。Phase 1-2で修正済み
2. **pado** — 脆弱な呼び出し最多（43箇所）。優先対応推奨
3. **sbpr** — 防御パターンが1箇所のみ。対応推奨
4. **semr** — 防御パターンなし。対応推奨
5. **stok** — 防御パターンなし。対応推奨
6. **tana** — 脆弱な呼び出しが少ない。低優先度

## コーディング規約への反映

- `getElementById().addEventListener()` は必ずnullチェックを入れる
- 新規HTML要素追加時は、JSからの参照箇所すべてで `if (el)` ガードを行う
- `initUpdateBanner()` の `if (el)` パターンを標準とする

## 補足: nginxキャッシュヘッダーについて

SWの cache-first 戦略（`sw.js` の `caches.match()`）が全リクエストを横取りするため、nginxのHTTPキャッシュヘッダーはSW経由のリクエストには無効。JS側の防御的コーディングが唯一の対策となる。
