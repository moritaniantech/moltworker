/**
 * Discord API共通クライアント
 * Bot Tokenを使用してDiscord APIを呼び出す
 */

const https = require('https');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_VERSION = 'v10';

/**
 * HTTPSリクエストをPromiseでラップ
 */
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // レート制限の処理
        if (res.statusCode === 429) {
          const retryAfter = parseFloat(res.headers['retry-after'] || '1');
          reject({ statusCode: 429, retryAfter, error: JSON.parse(data) });
          return;
        }

        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ statusCode: res.statusCode, error: json });
          } else {
            resolve(json);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject({ statusCode: res.statusCode, error: data });
          } else {
            resolve(data);
          }
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * レート制限対応のリトライ付きリクエスト
 */
async function requestWithRetry(options, postData = null, maxRetries = 3) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await httpsRequest(options, postData);
    } catch (err) {
      if (err.statusCode === 429 && i < maxRetries) {
        const waitTime = (err.retryAfter || 1) * 1000;
        console.error(`レート制限。${err.retryAfter}秒後にリトライ...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Discord APIを呼び出す
 */
async function discordApi(path, method = 'GET', body = null) {
  if (!BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN が設定されていません');
  }

  const options = {
    hostname: 'discord.com',
    path: `/api/${API_VERSION}${path}`,
    method: method,
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MoltbotDiscordSkill (https://github.com/moritaniantech/create-moltworker, 1.0)'
    }
  };

  const postData = body ? JSON.stringify(body) : null;
  if (postData) {
    options.headers['Content-Length'] = Buffer.byteLength(postData);
  }

  return requestWithRetry(options, postData);
}

/**
 * 指定時間待機
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  discordApi,
  sleep
};
