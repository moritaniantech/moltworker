---
name: gmail
description: Gmail API経由でメールの読み取り・送信・検索を行う。メール一覧取得、本文読み取り、メール送信、検索クエリによるフィルタリングが可能。GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN環境変数が必要。
---

# Gmail Integration

Gmail APIを使用してメールの読み取り・送信・検索を行います。

## Prerequisites

以下の環境変数が設定されている必要があります：
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `GOOGLE_REFRESH_TOKEN` - Google OAuth Refresh Token

## Scripts

### メール一覧取得
```bash
node /path/to/skills/gmail/scripts/list-emails.js [maxResults]
```
最新のメール一覧を取得します。maxResultsはオプション（デフォルト: 10）。

### メール本文取得
```bash
node /path/to/skills/gmail/scripts/read-email.js <messageId>
```
指定したIDのメール本文を取得します。

### メール送信
```bash
node /path/to/skills/gmail/scripts/send-email.js <to> <subject> <body>
```
メールを送信します。

### メール検索
```bash
node /path/to/skills/gmail/scripts/search-emails.js <query> [maxResults]
```
Gmailの検索クエリでメールを検索します。

## 検索クエリの例

| クエリ | 説明 |
|--------|------|
| `from:example@gmail.com` | 特定の送信者から |
| `to:example@gmail.com` | 特定の宛先へ |
| `subject:重要` | 件名に「重要」を含む |
| `is:unread` | 未読メール |
| `has:attachment` | 添付ファイルあり |
| `after:2024/01/01` | 指定日以降 |
| `label:inbox` | 受信トレイ |

複数条件は組み合わせ可能: `from:boss@company.com is:unread`

## API制限

- Gmail API: 1日あたり1,000,000,000クォータユニット
- 通常の使用では制限に達することはほぼありません

## トラブルシューティング

- **401 Unauthorized**: Refresh Tokenが無効です。再取得してください。
- **403 Forbidden**: Gmail APIが有効化されていないか、スコープが不足しています。
- **429 Too Many Requests**: レート制限。しばらく待ってから再試行してください。
