#!/usr/bin/env node
/**
 * 単一フィード取得スクリプト
 * RSS 2.0 / Atom 1.0 を取得・解析
 *
 * Usage: node fetch-feed.js <feedUrl> [maxItems]
 */

const https = require('https');
const http = require('http');

const REQUEST_TIMEOUT = 10000; // 10秒

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
      // リダイレクト処理
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
 * XMLからテキストコンテンツを抽出（簡易パーサー）
 */
function extractText(xml, tagName) {
  // CDATA対応
  const cdataPattern = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataPattern);
  if (cdataMatch) return cdataMatch[1].trim();

  // 通常のタグ
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(pattern);
  if (match) return decodeEntities(match[1].trim());

  return null;
}

/**
 * XMLの属性値を抽出
 */
function extractAttr(xml, tagName, attrName) {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']*)["'][^>]*/?>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1] : null;
}

/**
 * HTMLエンティティをデコード
 */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
}

/**
 * HTMLタグを除去
 */
function stripHtml(text) {
  return text.replace(/<[^>]+>/g, '').trim();
}

/**
 * RSS 2.0フィードを解析
 */
function parseRss(xml) {
  const feedTitle = extractText(xml, 'title') || '不明なフィード';
  const items = [];

  // <item>タグを抽出
  const itemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractText(itemXml, 'title') || '(タイトルなし)';
    const link = extractText(itemXml, 'link') || '';
    const pubDate = extractText(itemXml, 'pubDate') || '';
    const description = extractText(itemXml, 'description') || '';

    // カテゴリ取得
    const categories = [];
    const catPattern = /<category[^>]*>([\s\S]*?)<\/category>/gi;
    let catMatch;
    while ((catMatch = catPattern.exec(itemXml)) !== null) {
      categories.push(decodeEntities(catMatch[1].trim()));
    }

    items.push({
      title: stripHtml(title),
      link: link.trim(),
      pubDate: pubDate ? new Date(pubDate).toISOString() : '',
      description: stripHtml(description).slice(0, 300),
      categories
    });
  }

  return { title: feedTitle, items };
}

/**
 * Atom 1.0フィードを解析
 */
function parseAtom(xml) {
  // フィードタイトル（<feed>直下の<title>を取得、<entry>内は除外）
  const feedXmlBeforeEntries = xml.split(/<entry[\s>]/i)[0];
  const feedTitle = extractText(feedXmlBeforeEntries, 'title') || '不明なフィード';
  const items = [];

  // <entry>タグを抽出
  const entryPattern = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryPattern.exec(xml)) !== null) {
    const entryXml = match[1];
    const title = extractText(entryXml, 'title') || '(タイトルなし)';
    // Atomのリンクは<link href="..." />形式
    const link = extractAttr(entryXml, 'link', 'href') || extractText(entryXml, 'link') || '';
    const published = extractText(entryXml, 'published') || extractText(entryXml, 'updated') || '';
    const summary = extractText(entryXml, 'summary') || extractText(entryXml, 'content') || '';

    // カテゴリ取得
    const categories = [];
    const catPattern = /<category[^>]*term=["']([^"']*)["'][^>]*\/?>/gi;
    let catMatch;
    while ((catMatch = catPattern.exec(entryXml)) !== null) {
      categories.push(catMatch[1]);
    }

    items.push({
      title: stripHtml(title),
      link: link.trim(),
      pubDate: published ? new Date(published).toISOString() : '',
      description: stripHtml(summary).slice(0, 300),
      categories
    });
  }

  return { title: feedTitle, items };
}

/**
 * フィードを解析（RSS/Atom自動判定）
 */
function parseFeed(xml) {
  if (xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')) {
    return parseAtom(xml);
  }
  // Atom判定の追加パターン（xmlns指定が異なる場合）
  if (xml.includes('<feed') && xml.includes('</entry>')) {
    return parseAtom(xml);
  }
  return parseRss(xml);
}

async function fetchFeed(feedUrl, maxItems = 10) {
  try {
    console.log(`フィード取得中: ${feedUrl}\n`);

    const xml = await fetchUrl(feedUrl);
    const feed = parseFeed(xml);

    console.log(`📰 ${feed.title}`);
    console.log(`記事数: ${feed.items.length}件（最大${maxItems}件表示）\n`);

    const items = feed.items.slice(0, maxItems);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[${i + 1}] ${item.title}`);
      if (item.link) console.log(`    URL: ${item.link}`);
      if (item.pubDate) {
        const date = new Date(item.pubDate).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        console.log(`    日時: ${date}`);
      }
      if (item.description) console.log(`    概要: ${item.description.slice(0, 150)}${item.description.length > 150 ? '...' : ''}`);
      if (item.categories.length > 0) console.log(`    タグ: ${item.categories.join(', ')}`);
      console.log('');
    }
  } catch (error) {
    console.error('エラー:', error.message || error);
    process.exit(1);
  }
}

const feedUrl = process.argv[2];
const maxItems = parseInt(process.argv[3]) || 10;

if (!feedUrl) {
  console.error('Usage: node fetch-feed.js <feedUrl> [maxItems]');
  console.error('Example: node fetch-feed.js https://news.ycombinator.com/rss 5');
  process.exit(1);
}

fetchFeed(feedUrl, maxItems);
