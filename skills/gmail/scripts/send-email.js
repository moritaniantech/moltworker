#!/usr/bin/env node
/**
 * メール送信スクリプト
 * Usage: node send-email.js <to> <subject> <body>
 */

const { gmailApi, base64urlEncode } = require('./gmail-client');

async function sendEmail(to, subject, body) {
  try {
    // RFC 2822形式のメールを作成
    const email = [
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'Content-Type: text/plain; charset=UTF-8',
      'MIME-Version: 1.0',
      '',
      body
    ].join('\r\n');

    // Base64urlエンコード
    const encodedEmail = base64urlEncode(email);

    // 送信
    const response = await gmailApi('/messages/send', 'POST', {
      raw: encodedEmail
    });

    console.log('メール送信成功');
    console.log(`Message ID: ${response.id}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
  } catch (error) {
    console.error('エラー:', error.error?.error?.message || error.message || error);
    process.exit(1);
  }
}

const to = process.argv[2];
const subject = process.argv[3];
const body = process.argv.slice(4).join(' ');

if (!to || !subject || !body) {
  console.error('Usage: node send-email.js <to> <subject> <body>');
  console.error('Example: node send-email.js user@example.com "Hello" "This is test message"');
  process.exit(1);
}

sendEmail(to, subject, body);
