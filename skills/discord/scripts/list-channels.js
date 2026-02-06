#!/usr/bin/env node
/**
 * チャンネル一覧取得スクリプト
 * Usage: node list-channels.js <guildId>
 */

const { discordApi } = require('./discord-client');

async function listChannels(guildId) {
  try {
    const channels = await discordApi(`/guilds/${guildId}/channels`);

    // テキストチャンネルのみフィルタ（type 0 = GUILD_TEXT）
    const textChannels = channels
      .filter(ch => ch.type === 0)
      .sort((a, b) => a.position - b.position);

    if (textChannels.length === 0) {
      console.log('テキストチャンネルがありません');
      return;
    }

    console.log(`テキストチャンネル一覧（${textChannels.length}件）:\n`);

    for (const ch of textChannels) {
      const category = ch.parent_id
        ? channels.find(c => c.id === ch.parent_id)?.name || ''
        : '';
      const categoryLabel = category ? ` [${category}]` : '';
      console.log(`ID: ${ch.id}`);
      console.log(`名前: #${ch.name}${categoryLabel}`);
      if (ch.topic) console.log(`トピック: ${ch.topic}`);
      console.log('---');
    }
  } catch (error) {
    console.error('エラー:', error.error?.message || error.message || error);
    process.exit(1);
  }
}

const guildId = process.argv[2];

if (!guildId) {
  console.error('Usage: node list-channels.js <guildId>');
  process.exit(1);
}

listChannels(guildId);
