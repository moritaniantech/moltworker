---
name: discord
description: Discord Bot API経由でメッセージの読み取り・送信・アーカイブを行う。チャンネル一覧取得、メッセージ読み取り、メッセージ送信、R2へのメッセージアーカイブが可能。DISCORD_BOT_TOKEN環境変数が必要。
---

# Discord Integration

Discord Bot APIを使用してメッセージの読み取り・送信・アーカイブを行います。

## Prerequisites

以下の環境変数が設定されている必要があります：
- `DISCORD_BOT_TOKEN` - Discord Bot Token

Discord Developer Portalで以下を有効化：
- `MESSAGE_CONTENT` Privileged Intent
- `Read Message History` パーミッション
- `Send Messages` パーミッション

## Scripts

### チャンネル一覧取得
```bash
node /path/to/skills/discord/scripts/list-channels.js <guildId>
```
指定したサーバーのテキストチャンネル一覧を取得します。

### メッセージ読み取り
```bash
node /path/to/skills/discord/scripts/read-messages.js <channelId> [limit]
```
指定したチャンネルの最新メッセージを取得します。limitはオプション（デフォルト: 50、最大: 100）。

### メッセージ送信
```bash
node /path/to/skills/discord/scripts/send-message.js <channelId> <message>
```
指定したチャンネルにメッセージを送信します。

### メッセージアーカイブ（単一チャンネル）
```bash
node /path/to/skills/discord/scripts/archive-messages.js <channelId> [--backfill]
```
チャンネルのメッセージをR2にJSONL形式で保存します。
- デフォルト: 前回のカーソルから新しいメッセージのみ取得
- `--backfill`: チャンネルの全メッセージを取得（初回実行時に使用）

### 全チャンネル一括アーカイブ
```bash
node /path/to/skills/discord/scripts/archive-all-channels.js <guildId> [--backfill]
```
サーバーの全テキストチャンネルを一括アーカイブします。

## R2保存構造

```
/data/moltbot/discord/
  messages/<channelId>/
    YYYY-MM.jsonl        # メッセージ（月ごと）
    .cursor              # 最後にアーカイブしたメッセージID
```

## JSONL形式

各行は以下のJSON形式：
```json
{
  "id": "メッセージID",
  "author": {"id": "ユーザーID", "username": "ユーザー名"},
  "content": "メッセージ本文",
  "timestamp": "ISO 8601タイムスタンプ",
  "attachments": [],
  "embeds": []
}
```

## API制限

- Discord API: 50リクエスト/秒（グローバル）
- メッセージ取得: 100件/リクエスト
- backfillモード時はレート制限に配慮して0.5秒の間隔を設定

## トラブルシューティング

- **401 Unauthorized**: Bot Tokenが無効です。再取得してください。
- **403 Forbidden**: Botにそのチャンネルへのアクセス権がありません。
- **429 Too Many Requests**: レート制限。ヘッダーのretry_afterに従って待機します。
