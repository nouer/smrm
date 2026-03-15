# Lessons Learned

セッション中に得た教訓・パターンを記録し、同じミスを繰り返さないようにする。

---

## CLAUDE.md の管理

- CLAUDE.md には開発に必要な最小限の情報（コマンド・規約・ワークフロー）を記載する
- 詳細なアーキテクチャ情報（ファイル構成・スキーマ・UI構成）は肥大化の原因になるため、必要時にコードから直接確認する方が良い

## コーディング規約の遵守

- `smrm.calc.js` は純粋関数のみ。DOM操作・IndexedDB操作は `script.js` に集約する
- 外部ライブラリは追加禁止。vanilla JS のみで実装する
- HTML特殊文字は必ず `escapeHtml()` でエスケープする（XSS対策）

## Service Workerキャッシュ不整合への防御的コーディング

- `getElementById().addEventListener()` は必ずnullチェックを入れる（SWキャッシュ不整合で旧HTML+新JSの組み合わせが発生しうるため）
- 新規HTML要素を追加した場合、JSからの参照箇所すべてで防御的コーディング（`if (el)` ガード）を行う
- `initUpdateBanner()` の `if (el)` パターンを標準とする
- Playwright/Puppeteer E2Eテストは常にクリーンブラウザで実行されるため、キャッシュ遷移バグは検出不能。手動検証が必要
