/**
 * Gmail API共通クライアント
 * Access Tokenの取得とAPI呼び出しを行う
 */

const https = require('https');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

/**
 * HTTPSリクエストをPromiseでラップ
 */
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ statusCode: res.statusCode, error: json });
          } else {
            resolve(json);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Refresh TokenからAccess Tokenを取得
 */
async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Gmail credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
  }

  const postData = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }).toString();

  const options = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const response = await httpsRequest(options, postData);
  return response.access_token;
}

/**
 * Gmail APIを呼び出す
 */
async function gmailApi(path, method = 'GET', body = null) {
  const accessToken = await getAccessToken();

  const options = {
    hostname: 'gmail.googleapis.com',
    path: `/gmail/v1/users/me${path}`,
    method: method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  const postData = body ? JSON.stringify(body) : null;
  if (postData) {
    options.headers['Content-Length'] = Buffer.byteLength(postData);
  }

  return httpsRequest(options, postData);
}

/**
 * Base64urlデコード
 */
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Base64urlエンコード
 */
function base64urlEncode(str) {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

module.exports = {
  gmailApi,
  base64urlDecode,
  base64urlEncode,
  getAccessToken
};
