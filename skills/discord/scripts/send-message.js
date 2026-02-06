#!/usr/bin/env node
/**
 * メッセージ送信スクリプト
 * Usage: node send-message.js <channelId> <message>
 */

const { discordApi } = require('./discord-client');

async function sendMessage(channelId, content) {
  try {
    const response = await discordApi(`/channels/${channelId}/messages`, 'POST', {
      content: content
    });

    console.log('メッセージ送信成功');
    console.log(`Channel: ${channelId}`);
    console.log(`Message ID: ${response.id}`);
    console.log(`Content: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`);
  } catch (error) {
    console.error('エラー:', error.error?.message || error.message || error);
    process.exit(1);
  }
}

const channelId = process.argv[2];
const content = process.argv.slice(3).join(' ');

if (!channelId || !content) {
  console.error('Usage: node send-message.js <channelId> <message>');
  console.error('Example: node send-message.js 123456789 "Hello from Moltbot!"');
  process.exit(1);
}

sendMessage(channelId, content);
