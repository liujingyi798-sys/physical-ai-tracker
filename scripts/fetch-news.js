/**
 * Physical AI News Fetcher
 * 每天自动从 RSS 源抓取物理 AI / 具身智能 / 机器人相关新闻
 *
 * 用法: node scripts/fetch-news.js
 * GitHub Actions 每天定时运行，更新 data/news.json
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG
// ============================================================

const NEWS_FILE = path.join(__dirname, '..', 'data', 'news.json');
const MAX_ITEMS = 80; // 最多保留 80 条

// 关键词过滤（中英文）
const KEYWORDS = [
  // English
  'physical ai', 'embodied intelligence', 'humanoid robot', 'humanoid',
  'robot foundation model', 'spatial intelligence', 'world model',
  'robotics AI', 'autonomous driving', 'self-driving',
  'NVIDIA robot', 'GR00T', 'Isaac', 'Jetson',
  'Figure AI', 'Figure robot', 'Tesla Optimus', 'Boston Dynamics',
  'Physical Intelligence', 'Skild AI', 'World Labs',
  '1X Technologies', 'Agility Robotics', 'Covariant',
  'robot learning', 'robot manipulation', 'dexterous',
  // Chinese
  '物理AI', '具身智能', '人形机器人', '机器人基础模型',
  '空间智能', '世界模型', '宇树', '智元', '优必选',
  'Figure', 'Optimus', 'Atlas', 'GR00T',
  '自动驾驶', '端到端', '具身', '机械臂',
  '孙宇晨', '物理智能',
];

// RSS 数据源
const RSS_FEEDS = [
  // 英文科技媒体
  { url: 'https://techcrunch.com/category/robotics/feed/', name: 'TechCrunch Robotics' },
  { url: 'https://www.therobotreport.com/feed/', name: 'The Robot Report' },
  { url: 'https://www.sciencedaily.com/rss/computers_math/robotics.xml', name: 'ScienceDaily Robotics' },

  // 学术
  { url: 'https://rss.arxiv.org/rss/cs.RO', name: 'arXiv CS Robotics' },
  { url: 'https://rss.arxiv.org/rss/cs.AI', name: 'arXiv CS AI' },

  // 综合科技（含机器人/AI报道）
  { url: 'https://feeds.feedburner.com/TechCrunch/', name: 'TechCrunch（综合）' },

  // 中文科技媒体
  { url: 'https://www.jiqizhixin.com/rss', name: '机器之心' },
  { url: 'https://www.leiphone.com/feed', name: '雷锋网' },
];

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(`🤖 Physical AI News Fetcher — ${new Date().toISOString()}`);
  console.log(`📡 数据源: ${RSS_FEEDS.length} 个 RSS 频道\n`);

  // 读取现有新闻
  let existingData = { lastUpdated: '', source: 'auto', items: [] };
  try {
    existingData = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
    console.log(`📄 已有 ${existingData.items.length} 条新闻记录`);
  } catch (e) {
    console.log('📄 无现有记录，从头开始');
  }

  const existingLinks = new Set(existingData.items.map(i => i.link).filter(Boolean));
  const existingTitles = new Set(existingData.items.map(i => i.title.toLowerCase().trim()));
  let newItems = [];

  // 逐个抓取 RSS
  for (const feed of RSS_FEEDS) {
    try {
      console.log(`⏳ 抓取: ${feed.name}...`);
      const items = await fetchRSS(feed.url);
      console.log(`   ✅ 获取 ${items.length} 条`);

      for (const item of items) {
        // 去重（按链接或标题）
        if (item.link && existingLinks.has(item.link)) continue;
        const titleLower = (item.title || '').toLowerCase().trim();
        if (existingTitles.has(titleLower)) continue;

        // 关键词过滤
        if (!matchesKeywords(item, KEYWORDS)) continue;

        const newsItem = {
          title: item.title || 'Untitled',
          link: item.link || '',
          source: feed.name,
          date: formatDate(item.pubDate || item.isoDate || new Date()),
          tags: extractTags(item),
          summary: (item.contentSnippet || item.summary || item.content || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 280),
        };

        newItems.push(newsItem);
        existingLinks.add(newsItem.link);
        existingTitles.add(titleLower);
      }
    } catch (err) {
      console.log(`   ❌ 失败: ${err.message.substring(0, 80)}`);
    }
  }

  console.log(`\n🆕 新增 ${newItems.length} 条相关新闻`);

  // 合并、排序、截断
  const allItems = [...newItems, ...existingData.items]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ITEMS);

  const output = {
    lastUpdated: new Date().toISOString(),
    source: 'auto-fetched',
    totalFeeds: RSS_FEEDS.length,
    itemsFetched: newItems.length,
    items: allItems,
  };

  fs.writeFileSync(NEWS_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`💾 已保存: ${allItems.length} 条新闻 → ${NEWS_FILE}`);
  console.log('✅ 完成!\n');
}

// ============================================================
// HELPERS
// ============================================================

async function fetchRSS(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PhysicalAI-Tracker/1.0 (GitHub Actions Bot)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // 简易 XML 解析（不依赖第三方库，避免 GitHub Actions 安装问题）
    return parseRSSItems(xml);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRSSItems(xml) {
  const items = [];
  // 匹配 <item>...</item> 块
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      pubDate: extractTag(block, 'pubDate') || extractTag(block, 'dc:date'),
      isoDate: extractTag(block, 'dc:date'),
      contentSnippet: extractTag(block, 'description'),
      summary: extractTag(block, 'description'),
      content: extractTag(block, 'content:encoded'),
    });
  }

  // 也尝试 Atom feed 格式
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      items.push({
        title: extractTag(block, 'title'),
        link: extractLinkFromAtom(block),
        pubDate: extractTag(block, 'published') || extractTag(block, 'updated'),
        isoDate: extractTag(block, 'published') || extractTag(block, 'updated'),
        contentSnippet: extractTag(block, 'summary'),
        summary: extractTag(block, 'summary'),
        content: extractTag(block, 'content'),
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(regex);
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractLinkFromAtom(block) {
  const m = block.match(/<link[^>]*href="([^"]*)"/i);
  return m ? m[1] : extractTag(block, 'link');
}

function matchesKeywords(item, keywords) {
  const text = [
    item.title || '',
    item.contentSnippet || '',
    item.summary || '',
    item.content || '',
  ].join(' ').toLowerCase();

  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

function extractTags(item) {
  const text = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
  const tags = [];

  const tagMap = {
    'nvidia': 'nvidia',
    'gr00t': 'nvidia',
    'jetson': 'nvidia',
    'isaac': 'nvidia',
    'figure': 'figure-ai',
    'tesla optimus': 'tesla',
    'optimus': 'tesla',
    'boston dynamics': 'boston-dynamics',
    'atlas': 'boston-dynamics',
    '1x technologies': '1x',
    'neo robot': '1x',
    'physical intelligence': 'foundation-model',
    'skild': 'foundation-model',
    'world labs': 'spatial-intelligence',
    'spatial intelligence': 'spatial-intelligence',
    'covariant': 'industrial',
    'unitree': 'unitree',
    '宇树': 'unitree',
    'agibot': 'agibot',
    '智元': 'agibot',
    'ubtech': 'ubtech',
    '优必选': 'ubtech',
    'humanoid': 'humanoid',
    '人形': 'humanoid',
    'embodied': 'embodied',
    '具身': 'embodied',
    'foundation model': 'foundation-model',
    '基础模型': 'foundation-model',
    'funding': 'funding',
    '融资': 'funding',
    'investment': 'funding',
  };

  for (const [pattern, tag] of Object.entries(tagMap)) {
    if (text.includes(pattern) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) tags.push('general');
  return tags.slice(0, 4);
}

function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
  return date.toISOString().split('T')[0];
}

// ============================================================
// RUN
// ============================================================
main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
