---
name: rss
description: RSS/Atomフィードの取得・解析を行う汎用RSSリーダー。単一フィードの取得、複数フィードの一括チェック、新着記事の検出が可能。外部API不要（フィードURLに直接アクセス）。
---

# RSS Feed Reader

RSS/Atomフィードを直接取得・解析します。Inoreader等のサービスAPIは不要です。

## Prerequisites

- 外部依存なし（Node.js標準機能のみ使用）
- フィード設定ファイル: `/data/moltbot/rss/feeds.json`（複数フィード一括チェック時）

## Scripts

### 単一フィード取得
```bash
node /path/to/skills/rss/scripts/fetch-feed.js <feedUrl> [maxItems]
```
指定したURLのRSS/Atomフィードを取得・解析します。maxItemsはオプション（デフォルト: 10）。

### 複数フィード一括チェック
```bash
node /path/to/skills/rss/scripts/check-feeds.js [--new-only]
```
`feeds.json`に登録されたフィードを一括チェックします。
- `--new-only`: 前回チェック以降の新着記事のみ表示

## フィード設定ファイル

`/data/moltbot/rss/feeds.json` の形式：
```json
{
  "feeds": [
    {
      "name": "Hacker News",
      "url": "https://news.ycombinator.com/rss",
      "tags": ["tech", "news"]
    },
    {
      "name": "Cloudflare Blog",
      "url": "https://blog.cloudflare.com/rss/",
      "tags": ["cloudflare", "tech"]
    }
  ]
}
```

InoreaderからOPMLエクスポートしたフィードURLを登録できます。

## キャッシュ構造

```
/data/moltbot/rss/
  feeds.json             # フィード一覧設定
  cache/
    <urlHash>.json       # 各フィードの既読管理（最終チェック時刻、最終記事ID）
```

## 出力形式

各記事は以下の情報を含みます：
- タイトル
- リンクURL
- 公開日時
- 概要（descriptionまたはsummary）
- カテゴリ/タグ

## 運用方法

1. Inoreaderから購読フィードのOPMLをエクスポート
2. フィードURLを`feeds.json`に登録
3. Moltbotに「今日のニュースをチェックして」と指示

## トラブルシューティング

- **フィード取得エラー**: URLが正しいか、フィードが公開されているか確認
- **パースエラー**: RSS 2.0、Atom 1.0形式に対応。非標準形式は未対応の可能性あり
- **タイムアウト**: 10秒でタイムアウト。サーバーの応答が遅い場合はリトライ
