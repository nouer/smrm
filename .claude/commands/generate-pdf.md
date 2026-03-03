---
description: MarkdownファイルをPDFに変換
argument-hint: <markdown-file> [output-pdf]
allowed-tools: [Bash(python3 scripts/md-to-pdf.py:*)]
---

## タスク

指定されたMarkdownファイルをPDFに変換します。

引数: $ARGUMENTS

## 手順

1. 引数からMarkdownファイルパスを取得する（引数がなければ `docs/manual.md` を使用）
2. `python3 scripts/md-to-pdf.py <入力ファイル> [出力ファイル]` を実行する
3. 結果をユーザーに報告する
