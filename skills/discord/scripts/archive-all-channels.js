#!/usr/bin/env node
/**
 * 全チャンネル一括アーカイブスクリプト
 * サーバーの全テキストチャンネルをアーカイブ
 *
 * Usage: node archive-all-channels.js <guildId> [--backfill]
 */

const { discordApi, sleep } = require('./discord-client');

// archive-messages.jsのarchiveMessages関数を動的に利用するため、
// 子プロセスとして実行する
const { execSync } = require('child_process');
const path = require('path');

async function archiveAllChannels(guildId, backfill = false) {
  try {
    // サーバーのチャンネル一覧を取得
    const channels = await discordApi(`/guilds/${guildId}/channels`);

    // テキストチャンネルのみフィルタ（type 0 = GUILD_TEXT）
    const textChannels = channels
      .filter(ch => ch.type === 0)
      .sort((a, b) => a.position - b.position);

    if (textChannels.length === 0) {
      console.log('テキストチャンネルがありません');
      return;
    }

    console.log(`${textChannels.length}個のテキストチャンネルをアーカイブします\n`);

    const archiveScript = path.join(__dirname, 'archive-messages.js');
    let successCount = 0;
    let errorCount = 0;

    for (const ch of textChannels) {
      console.log(`\n=== #${ch.name} (${ch.id}) ===`);

      try {
        const backfillFlag = backfill ? ' --backfill' : '';
        execSync(
          `node "${archiveScript}" ${ch.id}${backfillFlag}`,
          {
            stdio: 'inherit',
            env: process.env,
            timeout: 600000 // 10分タイムアウト
          }
        );
        successCount++;
      } catch (error) {
        console.error(`  #${ch.name} のアーカイブに失敗:`, error.message);
        errorCount++;
      }

      // チャンネル間の待機
      await sleep(1000);
    }

    console.log(`\n=== アーカイブ完了 ===`);
    console.log(`成功: ${successCount}/${textChannels.length}`);
    if (errorCount > 0) {
      console.log(`失敗: ${errorCount}/${textChannels.length}`);
    }
  } catch (error) {
    console.error('エラー:', error.error?.message || error.message || error);
    process.exit(1);
  }
}

const guildId = process.argv[2];
const backfill = process.argv.includes('--backfill');

if (!guildId) {
  console.error('Usage: node archive-all-channels.js <guildId> [--backfill]');
  console.error('  --backfill: 全チャンネルの全メッセージを取得');
  process.exit(1);
}

archiveAllChannels(guildId, backfill);
