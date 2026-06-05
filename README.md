# 🤖 Physical AI Tracker

具身智能 / 物理 AI 赛道追踪面板 —— 你的个人研究仪表盘。

**🔗 在线访问：** `https://<你的用户名>.github.io/physical-ai-tracker/`

---

## ✨ 功能

| 模块 | 说明 | 数据来源 |
|------|------|---------|
| 🗺️ **赛道地图** | 人形机器人、自动驾驶、空间智能、工业物流 | 手动维护 |
| 📰 **新闻动态** | 最新物理 AI 新闻，自动去重 + 关键词过滤 | **GitHub Actions 每日自动抓取** |
| 🏢 **公司追踪** | 15+ 核心公司（中美双阵营） | 手动维护 |
| 📅 **时间线** | 2022-2026 关键事件 | 手动维护 |
| 💰 **融资动态** | 标志性融资轮次 | 手动维护 |
| 📝 **笔记** | 个人分析，浏览器 localStorage 保存 | 你自己 |

---

## 🚀 快速开始

### 本地预览

```bash
# 方法 1：用 npm
npm run serve

# 方法 2：用 Python
python -m http.server 3000

# 方法 3：用 npx
npx serve . -p 3000
```

然后打开 `http://localhost:3000`

> ⚠️ 直接双击 index.html 可能无法加载数据（CORS），请用本地服务器。

### 手动抓取新闻

```bash
npm run fetch
# 或
node scripts/fetch-news.js
```

---

## 🔧 自动更新机制

```
┌─────────────────────────────────────────────┐
│  GitHub Actions (每天 UTC 0:00 & 12:00)      │
│  ├─ 抓取 8 个 RSS 源                         │
│  ├─ 关键词过滤（物理AI/具身智能/人形机器人...） │
│  ├─ 去重 + 排序                              │
│  └─ git commit & push → data/news.json       │
├─────────────────────────────────────────────┤
│  GitHub Pages                                 │
│  └─ 自动部署 → 浏览器访问即可看最新数据         │
└─────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
physical-ai-tracker/
├── index.html                 # 主页面（动态加载 JSON）
├── data/
│   ├── companies.json         # 公司追踪数据
│   ├── timeline.json          # 关键事件时间线
│   ├── funding.json           # 融资记录
│   └── news.json              # 新闻（自动抓取 + 手动补充）
├── scripts/
│   └── fetch-news.js          # RSS 新闻抓取脚本
├── .github/workflows/
│   └── update-news.yml        # GitHub Actions 定时任务
├── package.json
└── README.md
```

---

## 🚢 部署到 GitHub Pages

1. 在 GitHub 创建新仓库 `physical-ai-tracker`
2. 推送代码：
   ```bash
   git remote add origin git@github.com:<你的用户名>/physical-ai-tracker.git
   git push -u origin main
   ```
3. 在仓库 Settings → Pages → Source 选 `main` 分支，根目录
4. 等几分钟，访问 `https://<用户名>.github.io/physical-ai-tracker/`
5. GitHub Actions 会自动开始每日抓取新闻 🎉

---

## ⚠️ 声明

本页面仅为个人学习研究记录，**不构成任何投资建议**。新闻由自动化脚本从公开 RSS 抓取，未经人工审核，可能包含错误或过时信息。
