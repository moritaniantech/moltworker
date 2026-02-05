#!/usr/bin/env node
/**
 * メール検索スクリプト
 * Usage: node search-emails.js <query> [maxResults]
 */

const { gmailApi } = require('./gmail-client');

async function searchEmails(query, maxResults = 10) {
  try {
    // メール検索
    const encodedQuery = encodeURIComponent(query);
    const response = await gmailApi(`/messages?maxResults=${maxResults}&q=${encodedQuery}`);

    if (!response.messages || response.messages.length === 0) {
      console.log(`検索結果: 0件 (query: ${query})`);
      return;
    }

    console.log(`検索結果: ${response.messages.length}件 (query: ${query})\n`);

    // 各メールの詳細を取得
    for (const msg of response.messages) {
      const detail = await gmailApi(`/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);

      const headers = detail.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '不明';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      console.log(`ID: ${msg.id}`);
      console.log(`From: ${from}`);
      console.log(`Subject: ${subject}`);
      console.log(`Date: ${date}`);
      console.log('---');
    }
  } catch (error) {
    console.error('エラー:', error.error?.error?.message || error.message || error);
    process.exit(1);
  }
}

const query = process.argv[2];
const maxResults = parseInt(process.argv[3]) || 10;

if (!query) {
  console.error('Usage: node search-emails.js <query> [maxResults]');
  console.error('');
  console.error('Example queries:');
  console.error('  "from:example@gmail.com"  - 特定の送信者から');
  console.error('  "is:unread"               - 未読メール');
  console.error('  "subject:重要"            - 件名に含む');
  console.error('  "has:attachment"          - 添付ファイルあり');
  console.error('  "after:2024/01/01"        - 指定日以降');
  process.exit(1);
}

searchEmails(query, maxResults);
