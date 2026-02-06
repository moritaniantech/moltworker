#!/usr/bin/env node
/**
 * メッセージアーカイブスクリプト（単一チャンネル）
 * チャンネルのメッセージをR2にJSONL形式で保存
 *
 * Usage: node archive-messages.js <channelId> [--backfill]
 *   --backfill: チャンネルの全メッセージを取得（初回実行時に使用）
 */

const fs = require('fs');
const path = require('path');
const { discordApi, sleep } = require('./discord-client');

const ARCHIVE_DIR = '/data/moltbot/discord/messages';
const BATCH_SIZE = 100; // Discord APIの最大取得件数
const RATE_LIMIT_DELAY = 500; // バッチ間の待機時間（ms）

/**
 * メッセージをJSONL行に変換
 */
function messageToJsonl(msg) {
  return JSON.stringify({
    id: msg.id,
    author: { id: msg.author.id, username: msg.author.username },
    content: msg.content,
    timestamp: msg.timestamp,
    edited_timestamp: msg.edited_timestamp,
    attachments: (msg.attachments || []).map(a => ({
      id: a.id, filename: a.filename, url: a.url, size: a.size
    })),
    embeds: (msg.embeds || []).map(e => ({
      title: e.title, description: e.description, url: e.url, type: e.type
    }))
  });
}

/**
 * メッセージを月ごとのファイルに書き込み
 */
function appendToMonthFile(channelDir, msg, line) {
  const date = new Date(msg.timestamp);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const filePath = path.join(channelDir, `${monthKey}.jsonl`);
  fs.appendFileSync(filePath, line + '\n');
  return monthKey;
}

/**
 * カーソル（最後にアーカイブしたメッセージID）を読み取り
 */
function readCursor(channelDir) {
  const cursorPath = path.join(channelDir, '.cursor');
  try {
    return fs.readFileSync(cursorPath, 'utf-8').trim();
  } catch {
    return null;
  }
}

/**
 * カーソルを書き込み
 */
function writeCursor(channelDir, messageId) {
  const cursorPath = path.join(channelDir, '.cursor');
  fs.writeFileSync(cursorPath, messageId);
}

async function archiveMessages(channelId, backfill = false) {
  const channelDir = path.join(ARCHIVE_DIR, channelId);
  fs.mkdirSync(channelDir, { recursive: true });

  const cursor = backfill ? null : readCursor(channelDir);
  let totalArchived = 0;
  let latestMessageId = null;
  const monthFiles = new Set();

  console.log(`チャンネル ${channelId} のアーカイブを開始...`);
  if (cursor) {
    console.log(`前回のカーソル: ${cursor}（以降のメッセージを取得）`);
  } else {
    console.log('全メッセージを取得します（backfillモード）');
  }

  if (backfill) {
    // 古いメッセージから順に取得（after パラメータ使用）
    let afterId = '0'; // 最初から取得
    let hasMore = true;

    while (hasMore) {
      const queryParams = `limit=${BATCH_SIZE}&after=${afterId}`;
      const messages = await discordApi(`/channels/${channelId}/messages?${queryParams}`);

      if (!messages || messages.length === 0) {
        hasMore = false;
        break;
      }

      // APIは新しい順で返すので逆順にして古い順に処理
      const sorted = messages.reverse();

      for (const msg of sorted) {
        const line = messageToJsonl(msg);
        const monthKey = appendToMonthFile(channelDir, msg, line);
        monthFiles.add(monthKey);
        totalArchived++;
      }

      // 最新のメッセージIDを記録
      latestMessageId = sorted[sorted.length - 1].id;
      afterId = latestMessageId;

      console.log(`  ${totalArchived}件アーカイブ済み...`);

      if (messages.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        await sleep(RATE_LIMIT_DELAY);
      }
    }
  } else {
    // 新しいメッセージのみ取得（after=cursor）
    let afterId = cursor || '0';
    let hasMore = true;

    while (hasMore) {
      const queryParams = `limit=${BATCH_SIZE}&after=${afterId}`;
      const messages = await discordApi(`/channels/${channelId}/messages?${queryParams}`);

      if (!messages || messages.length === 0) {
        hasMore = false;
        break;
      }

      // 古い順にソート
      const sorted = messages.reverse();

      for (const msg of sorted) {
        const line = messageToJsonl(msg);
        const monthKey = appendToMonthFile(channelDir, msg, line);
        monthFiles.add(monthKey);
        totalArchived++;
      }

      latestMessageId = sorted[sorted.length - 1].id;
      afterId = latestMessageId;

      if (messages.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        await sleep(RATE_LIMIT_DELAY);
      }
    }
  }

  // カーソルを更新
  if (latestMessageId) {
    writeCursor(channelDir, latestMessageId);
  }

  console.log(`\nアーカイブ完了:`);
  console.log(`  チャンネル: ${channelId}`);
  console.log(`  アーカイブ件数: ${totalArchived}`);
  console.log(`  保存先: ${channelDir}`);
  if (monthFiles.size > 0) {
    console.log(`  月別ファイル: ${Array.from(monthFiles).sort().join(', ')}`);
  }
  if (latestMessageId) {
    console.log(`  カーソル更新: ${latestMessageId}`);
  }
}

const channelId = process.argv[2];
const backfill = process.argv.includes('--backfill');

if (!channelId) {
  console.error('Usage: node archive-messages.js <channelId> [--backfill]');
  console.error('  --backfill: チャンネルの全メッセージを取得');
  process.exit(1);
}

archiveMessages(channelId, backfill).catch(error => {
  console.error('エラー:', error.error?.message || error.message || error);
  process.exit(1);
});
