#!/usr/bin/env node
/**
 * メッセージ読み取りスクリプト
 * Usage: node read-messages.js <channelId> [limit]
 */

const { discordApi } = require('./discord-client');

async function readMessages(channelId, limit = 50) {
  try {
    // 最大100件まで
    limit = Math.min(limit, 100);

    const messages = await discordApi(`/channels/${channelId}/messages?limit=${limit}`);

    if (!messages || messages.length === 0) {
      console.log('メッセージがありません');
      return;
    }

    console.log(`最新${messages.length}件のメッセージ:\n`);

    // 古い順に表示（APIは新しい順で返す）
    const sorted = messages.reverse();

    for (const msg of sorted) {
      const date = new Date(msg.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
      const author = msg.author.username;

      console.log(`[${date}] ${author}: ${msg.content || '(テキストなし)'}`);

      // 添付ファイルがある場合
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          console.log(`  📎 ${att.filename} (${att.url})`);
        }
      }

      // 埋め込みがある場合
      if (msg.embeds && msg.embeds.length > 0) {
        for (const embed of msg.embeds) {
          if (embed.title) console.log(`  🔗 ${embed.title}: ${embed.url || ''}`);
          if (embed.description) console.log(`  ${embed.description.slice(0, 200)}`);
        }
      }
    }
  } catch (error) {
    console.error('エラー:', error.error?.message || error.message || error);
    process.exit(1);
  }
}

const channelId = process.argv[2];
const limit = parseInt(process.argv[3]) || 50;

if (!channelId) {
  console.error('Usage: node read-messages.js <channelId> [limit]');
  process.exit(1);
}

readMessages(channelId, limit);
