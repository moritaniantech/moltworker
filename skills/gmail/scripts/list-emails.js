#!/usr/bin/env node
/**
 * メール一覧取得スクリプト
 * Usage: node list-emails.js [maxResults]
 */

const { gmailApi, base64urlDecode } = require('./gmail-client');

async function listEmails(maxResults = 10) {
  try {
    // メール一覧を取得
    const response = await gmailApi(`/messages?maxResults=${maxResults}&labelIds=INBOX`);

    if (!response.messages || response.messages.length === 0) {
      console.log('メールがありません');
      return;
    }

    console.log(`最新${response.messages.length}件のメール:\n`);

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

const maxResults = parseInt(process.argv[2]) || 10;
listEmails(maxResults);
