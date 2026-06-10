/**
 * Physical AI Weekly Insights Generator
 * 每周从 news.json 中提取最重要的事件，调用 DeepSeek API 生成洞察报告
 *
 * 运行方式:
 *   node scripts/generate-insights.js          # 使用环境变量 DEEPSEEK_API_KEY
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/...   # 直接传入
 *
 * GitHub Actions 每周自动运行，报告存入 data/insights.json
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG
// ============================================================
const NEWS_FILE = path.join(__dirname, '..', 'data', 'news.json');
const INSIGHTS_FILE = path.join(__dirname, '..', 'data', 'insights.json');
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';
const DAYS_TO_ANALYZE = 7; // 分析最近 7 天的新闻
const MAX_NEWS_FOR_PROMPT = 30; // 最多塞 30 条进 prompt

// ============================================================
// MAIN
// ============================================================
async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌ 请设置环境变量 DEEPSEEK_API_KEY');
    console.error('   Windows: $env:DEEPSEEK_API_KEY="sk-xxx"');
    console.error('   或在项目根目录创建 .env 文件（已加入 .gitignore）');
    process.exit(1);
  }

  console.log('🤖 Physical AI 每周洞察生成器');
  console.log(`📅 ${new Date().toISOString()}\n`);

  // 1. 读取新闻
  let newsData;
  try {
    newsData = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
  } catch (e) {
    console.error('❌ 无法读取 news.json:', e.message);
    process.exit(1);
  }

  const allNews = newsData.items || [];
  const cutoff = new Date(Date.now() - DAYS_TO_ANALYZE * 24 * 60 * 60 * 1000);
  const recentNews = allNews.filter(item => new Date(item.date) >= cutoff);

  if (recentNews.length === 0) {
    console.log('📭 本周无新闻，跳过分析');
    return;
  }

  console.log(`📰 本周共 ${recentNews.length} 条新闻，选取最近 ${Math.min(recentNews.length, MAX_NEWS_FOR_PROMPT)} 条分析...`);

  // 2. 读取已有洞察（用于对比 + 检查是否需要重新生成）
  let existingInsights = { reports: [] };
  try {
    existingInsights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf-8'));
  } catch (e) {
    // 文件不存在，从空开始
  }

  // 如果最近 6 天内已生成过洞察，跳过
  if (existingInsights.reports.length > 0) {
    const lastReport = new Date(existingInsights.reports[0].generatedAt);
    const daysSince = (Date.now() - lastReport.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 6) {
      console.log(`⏭️ 上次洞察生成于 ${daysSince.toFixed(1)} 天前，跳过（每 7 天最多生成一次）`);
      return;
    }
  }

  // 3. 构建分析 prompt
  const newsForPrompt = recentNews.slice(0, MAX_NEWS_FOR_PROMPT);
  const prompt = buildPrompt(newsForPrompt, existingInsights);

  // 4. 调用 DeepSeek API
  console.log('🧠 正在调用 DeepSeek 进行分析...');
  const analysis = await callDeepSeek(apiKey, prompt);

  // 5. 保存洞察报告
  const report = {
    generatedAt: new Date().toISOString(),
    period: {
      start: cutoff.toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
    newsCount: recentNews.length,
    analyzedCount: newsForPrompt.length,
    summary: analysis.summary || '',
    topEvents: analysis.topEvents || [],
    trendJudgment: analysis.trendJudgment || '',
    companiesToWatch: analysis.companiesToWatch || [],
    noiseAlert: analysis.noiseAlert || '',
  };

  existingInsights.reports.unshift(report);
  // 只保留最近 12 周的洞察
  if (existingInsights.reports.length > 12) {
    existingInsights.reports = existingInsights.reports.slice(0, 12);
  }
  existingInsights.lastUpdated = new Date().toISOString();

  fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(existingInsights, null, 2), 'utf-8');
  console.log(`💾 洞察报告已保存 → ${INSIGHTS_FILE}`);
  console.log(`✅ 完成！报告摘要: ${report.summary.substring(0, 120)}...`);
}

// ============================================================
// PROMPT BUILDER
// ============================================================
function buildPrompt(newsItems, existingInsights) {
  const newsText = newsItems.map((item, i) =>
    `[${i + 1}] ${item.date} | 来源: ${item.source}
     标题: ${item.title}
     摘要: ${(item.summary || '').substring(0, 300)}`
  ).join('\n\n');

  const previousSummary = existingInsights.reports.length > 0
    ? `\n上周分析摘要（供对比）: ${existingInsights.reports[0].summary}\n`
    : '';

  return `你是一位物理 AI / 具身智能赛道的高级产业分析师。请根据以下本周新闻，生成一份中文洞察报告。

${previousSummary}

=== 本周新闻（共 ${newsItems.length} 条）===
${newsText}

=== 请严格按照以下 JSON 格式返回（不要加任何其他文字）===
{
  "summary": "用一段话总结本周物理 AI 赛道最重要的事（100-200字）",
  "topEvents": [
    {
      "title": "事件标题",
      "importance": "为什么重要（1-2句话）",
      "impact": "对赛道的影响（1-2句话）"
    }
  ],
  "trendJudgment": "相比上周，赛道是在加速/匀速/降温？依据是什么？（50-100字）",
  "companiesToWatch": [
    {
      "name": "公司名称",
      "reason": "为什么本周值得关注"
    }
  ],
  "noiseAlert": "本周哪些新闻可能是噪音/炒作，不值得过度关注？（如果没有明显的，写'本周无明显噪音'）"
}

要求：
- TopEvents 最多 5 个，按重要性排序
- CompaniesToWatch 最多 3 个
- 语言简洁、有判断力、不模棱两可
- 如果是孙宇晨相关，标注其预测准确度历史`;
}

// ============================================================
// DEEPSEEK API CALL
// ============================================================
async function callDeepSeek(apiKey, prompt) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一位物理AI产业分析师。你只返回有效的JSON，从不加解释性文字。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API 错误 (${res.status}): ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  // 解析 JSON（处理可能的 markdown 代码块包裹）
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('⚠️ DeepSeek 返回的不是合法 JSON，原始内容:');
    console.error(content.substring(0, 500));
    // 返回一个基本结构
    return {
      summary: content.substring(0, 300),
      topEvents: [],
      trendJudgment: 'AI 返回格式异常，请检查日志',
      companiesToWatch: [],
      noiseAlert: '',
    };
  }
}

// ============================================================
// RUN
// ============================================================
main().catch(err => {
  console.error('❌ 致命错误:', err.message);
  process.exit(1);
});
