#!/usr/bin/env node
/**
 * 複数フィード一括チェックスクリプト
 * feeds.jsonに登録されたフィードを一括チェック
 *
 * Usage: node check-feeds.js [--new-only]
 *   --new-only: 前回チェック以降の新着記事のみ表示
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const RSS_DIR = '/data/moltbot/rss';
const FEEDS_FILE = path.join(RSS_DIR, 'feeds.json');
const CACHE_DIR = path.join(RSS_DIR, 'cache');
const REQUEST_TIMEOUT = 10000;

/**
 * URLからコンテンツを取得
 */
function fetchUrl(url, redirectCount = 0) {
  if (redirectCount > 5) {
    return Promise.reject(new Error('リダイレクトが多すぎます'));
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: REQUEST_TIMEOUT, headers: {
      'User-Agent': 'MoltbotRSSReader/1.0',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
    }}, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        resolve(fetchUrl(redirectUrl, redirectCount + 1));
        return;
      }

      if (res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`タイムアウト: ${url}`));
    });
  });
}

/**
 * 簡易XMLパーサー（fetch-feed.jsと同じロジック）
 */
function extractText(xml, tagName) {
  const cdataPattern = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataPattern);
  if (cdataMatch) return cdataMatch[1].trim();

  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(pattern);
  if (match) return decodeEntities(match[1].trim());
  return null;
}

function extractAttr(xml, tagName, attrName) {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']*)["'][^>]*/?>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1] : null;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, '').trim();
}

function parseFeed(xml) {
  const isAtom = (xml.includes('<feed') && xml.includes('</entry>'));
  const items = [];

  if (isAtom) {
    const feedXmlBeforeEntries = xml.split(/<entry[\s>]/i)[0];
    const feedTitle = extractText(feedXmlBeforeEntries, 'title') || '不明';

    const entryPattern = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = entryPattern.exec(xml)) !== null) {
      const e = match[1];
      items.push({
        title: stripHtml(extractText(e, 'title') || '(タイトルなし)'),
        link: (extractAttr(e, 'link', 'href') || extractText(e, 'link') || '').trim(),
        pubDate: extractText(e, 'published') || extractText(e, 'updated') || '',
        description: stripHtml(extractText(e, 'summary') || extractText(e, 'content') || '').slice(0, 200)
      });
    }
    return { title: feedTitle, items };
  }

  // RSS 2.0
  const feedTitle = extractText(xml, 'title') || '不明';
  const itemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const e = match[1];
    items.push({
      title: stripHtml(extractText(e, 'title') || '(タイトルなし)'),
      link: (extractText(e, 'link') || '').trim(),
      pubDate: extractText(e, 'pubDate') || '',
      description: stripHtml(extractText(e, 'description') || '').slice(0, 200)
    });
  }
  return { title: feedTitle, items };
}

/**
 * URLのハッシュを生成（キャッシュキーに使用）
 */
function urlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * キャッシュを読み取り
 */
function readCache(url) {
  const cachePath = path.join(CACHE_DIR, `${urlHash(url)}.json`);
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * キャッシュを書き込み
 */
function writeCache(url, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${urlHash(url)}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
}

async function checkFeeds(newOnly = false) {
  // feeds.jsonを読み込み
  if (!fs.existsSync(FEEDS_FILE)) {
    console.error(`フィード設定ファイルが見つかりません: ${FEEDS_FILE}`);
    console.error('\n以下の形式で作成してください:');
    console.error(JSON.stringify({
      feeds: [
        { name: "Example Feed", url: "https://example.com/feed.xml", tags: ["tech"] }
      ]
    }, null, 2));
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(FEEDS_FILE, 'utf-8'));
  const feeds = config.feeds || [];

  if (feeds.length === 0) {
    console.log('登録されたフィードがありません');
    return;
  }

  console.log(`${feeds.length}個のフィードをチェック中...\n`);

  let totalNewItems = 0;

  for (const feed of feeds) {
    try {
      const xml = await fetchUrl(feed.url);
      const parsed = parseFeed(xml);
      const cache = readCache(feed.url);
      const now = new Date().toISOString();

      let items = parsed.items;

      // 新着フィルタ
      if (newOnly && cache?.lastChecked) {
        const lastChecked = new Date(cache.lastChecked);
        items = items.filter(item => {
          if (!item.pubDate) return true; // 日付不明は新着扱い
          return new Date(item.pubDate) > lastChecked;
        });
      }

      // キャッシュ更新
      writeCache(feed.url, {
        lastChecked: now,
        feedTitle: parsed.title,
        itemCount: parsed.items.length
      });

      if (items.length === 0 && newOnly) {
        continue; // 新着なしはスキップ
      }

      const tags = feed.tags ? ` [${feed.tags.join(', ')}]` : '';
      console.log(`📰 ${feed.name || parsed.title}${tags}`);
      console.log(`   ${items.length}件${newOnly ? '（新着）' : ''}`);

      // 最大5件表示
      const displayItems = items.slice(0, 5);
      for (const item of displayItems) {
        const date = item.pubDate
          ? new Date(item.pubDate).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
          : '';
        console.log(`   - ${item.title}${date ? ` (${date})` : ''}`);
        if (item.link) console.log(`     ${item.link}`);
      }
      if (items.length > 5) {
        console.log(`   ... 他${items.length - 5}件`);
      }
      console.log('');

      totalNewItems += items.length;
    } catch (error) {
      console.error(`❌ ${feed.name || feed.url}: ${error.message}`);
      console.log('');
    }
  }

  console.log(`---`);
  console.log(`合計: ${totalNewItems}件${newOnly ? '（新着）' : ''}`);
}

const newOnly = process.argv.includes('--new-only');
checkFeeds(newOnly).catch(error => {
  console.error('エラー:', error.message || error);
  process.exit(1);
});
