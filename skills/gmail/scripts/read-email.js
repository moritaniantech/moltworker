#!/usr/bin/env node
/**
 * メール本文取得スクリプト
 * Usage: node read-email.js <messageId>
 */

const { gmailApi, base64urlDecode } = require('./gmail-client');

function extractBody(payload) {
  // シンプルなメールの場合
  if (payload.body && payload.body.data) {
    return base64urlDecode(payload.body.data);
  }

  // マルチパートメールの場合
  if (payload.parts) {
    for (const part of payload.parts) {
      // text/plain を優先
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return base64urlDecode(part.body.data);
      }
      // ネストしたパートを再帰的に探索
      if (part.parts) {
        const body = extractBody(part);
        if (body) return body;
      }
    }
    // text/plain がなければ text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return base64urlDecode(part.body.data);
      }
    }
  }

  return null;
}

async function readEmail(messageId) {
  try {
    const detail = await gmailApi(`/messages/${messageId}?format=full`);

    const headers = detail.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '不明';
    const to = headers.find(h => h.name === 'To')?.value || '不明';
    const subject = headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    console.log('=== メール詳細 ===');
    console.log(`ID: ${messageId}`);
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Date: ${date}`);
    console.log('');
    console.log('=== 本文 ===');

    const body = extractBody(detail.payload);
    if (body) {
      console.log(body);
    } else {
      console.log('(本文を取得できませんでした)');
    }
  } catch (error) {
    console.error('エラー:', error.error?.error?.message || error.message || error);
    process.exit(1);
  }
}

const messageId = process.argv[2];
if (!messageId) {
  console.error('Usage: node read-email.js <messageId>');
  console.error('Example: node read-email.js 18d1234abcd5678');
  process.exit(1);
}

readEmail(messageId);
