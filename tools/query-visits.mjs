/**
 * tools/query-visits.mjs —— 查「页面访问统计」（**手动跑，不在 CI 里**）。
 *
 * 数据落在 Cloudflare Analytics Engine 的 `my_blog_pageviews` 数据集里（见 wrangler.toml），
 * 官方查看入口是 Cloudflare 后台，**那个入口不需要任何凭据，优先用那个**（步骤见
 * `docs/访问统计.md`）。这个脚本是**备选路线**：当后台那个查询框用不了、
 * 或者你想把结果存下来 / 定时跑的时候用它。
 *
 * 为什么要有备选：查询接口（SQL API）是要凭据的，而后台那个查询框属于
 * 「看到了才知道长什么样」的东西 —— 与其赌它在，不如给一条一定能跑通的路。
 *
 * 用法（需要一个**只读**令牌，创建步骤见 docs/访问统计.md §7.4）：
 *
 *     $env:CLOUDFLARE_API_TOKEN = "你的令牌"
 *     node tools/query-visits.mjs              # 默认看最近 7 天的总览
 *     node tools/query-visits.mjs 页面 30      # 最近 30 天最热的页面
 *
 * ⚠️ 令牌只从环境变量读，**绝不写进仓库、绝不打印出来**。
 *    账号 ID 不是敏感信息：先看环境变量 CLOUDFLARE_ACCOUNT_ID，
 *    没有就从 `.github/workflows/deploy.yml` 里读现成的那个（省得再抄一遍）。
 */

import { readFile } from 'node:fs/promises';

const DATASET = 'my_blog_pageviews';
const API = (accountId) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

/* --------------------------------------------------------------- 查询清单 */

/** `GROUP BY` 的别名在 SQL 里可以直接用（Analytics Engine 兼容这一套） */
const pv = 'SUM(_sample_interval * double1)';
const uv = 'count(DISTINCT index1)';
const since = (days) => `timestamp > NOW() - INTERVAL '${days}' DAY`;

/**
 * ⚠️ **列别名只能用 ASCII。**
 * 实测（2026-10-10）：写 `AS 访问次数` 会被 SQL 解析器直接拒掉 ——
 * HTTP 422 `sql parser error: Expected an identifier after AS, found: 访`，
 * 于是**八条查询全部报错**，而这件事只有真跑一次接口才会发现
 * （只做语法检查、只读代码都看不出来）。
 * 所以这里一律用英文别名，显示之前再由 LABELS 翻成中文。
 */
const LABELS = {
  pv: '访问次数', uv: '访客数', path: '页面', country: '国家',
  src: '来源', device: '设备', mode: '载荷方式', day: '日期', timestamp: '时间',
};

const QUERIES = {
  总览: (d) => `
    SELECT ${pv} AS pv, ${uv} AS uv
    FROM ${DATASET} WHERE ${since(d)}`,

  每日: (d) => `
    SELECT toDate(timestamp) AS day, ${pv} AS pv, ${uv} AS uv
    FROM ${DATASET} WHERE ${since(d)}
    GROUP BY day ORDER BY day DESC`,

  页面: (d) => `
    SELECT blob1 AS path, ${pv} AS pv, ${uv} AS uv
    FROM ${DATASET} WHERE ${since(d)}
    GROUP BY path ORDER BY pv DESC LIMIT 25`,

  国家: (d) => `
    SELECT blob2 AS country, ${pv} AS pv, ${uv} AS uv
    FROM ${DATASET} WHERE ${since(d)}
    GROUP BY country ORDER BY pv DESC LIMIT 25`,

  来源: (d) => `
    SELECT blob3 AS src, ${pv} AS pv, ${uv} AS uv
    FROM ${DATASET} WHERE ${since(d)}
    GROUP BY src ORDER BY pv DESC LIMIT 25`,

  设备: (d) => `
    SELECT blob4 AS device, ${pv} AS pv, ${uv} AS uv
    FROM ${DATASET} WHERE ${since(d)}
    GROUP BY device ORDER BY pv DESC`,

  // 「整页进入」与「pjax 站内跳转」的比例。拿它验证 pjax 那条判定真的生效了：
  // 如果 pjax 一行都没有，说明 assets/js/pjax.js 的 X-PJAX 头那条链路断了。
  方式: (d) => `
    SELECT blob5 AS mode, ${pv} AS pv, ${uv} AS uv
    FROM ${DATASET} WHERE ${since(d)}
    GROUP BY mode ORDER BY pv DESC`,

  最近: (d) => `
    SELECT timestamp, blob1 AS path, blob2 AS country,
           blob3 AS src, blob4 AS device, blob5 AS mode
    FROM ${DATASET} WHERE ${since(d)}
    ORDER BY timestamp DESC LIMIT 30`,
};

/* ------------------------------------------------------------------ 辅助 */

async function accountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) { return process.env.CLOUDFLARE_ACCOUNT_ID.trim(); }
  // 部署工作流里写死了账号 ID（它不算敏感信息），直接复用，省得站主再找一遍
  try {
    const yml = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
    const m = /^\s*accountId:\s*([0-9a-f]{32})\s*$/m.exec(yml);
    if (m) { return m[1]; }
  } catch (_) { /* 文件没了也不要紧，下面会提示 */ }
  return '';
}

/** 把 {"meta":[…],"data":[…] } 或裸数组统一成 {columns, rows}，顺手把英文列名翻成中文 */
function normalize(payload) {
  const data = Array.isArray(payload) ? payload : (payload && payload.data) || [];
  const raw = data.length ? Object.keys(data[0]) : [];
  const columns = raw.map((c) => LABELS[c] || c);
  return { columns, rows: data.map((r) => raw.map((c) => r[c])) };
}

function printTable({ columns, rows }) {
  if (!rows.length) {
    console.log('（这个时间范围内没有数据）\n');
    return;
  }
  const cells = [columns, ...rows.map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))))];
  const width = columns.map((_, i) => Math.max(...cells.map((row) => [...row[i]].length)));
  for (const [ri, row] of cells.entries()) {
    console.log(row.map((c, i) => (i === 0 ? c.padEnd(width[i]) : c.padStart(width[i]))).join('  '));
    if (ri === 0) { console.log(width.map((w) => '-'.repeat(w)).join('  ')); }
  }
  console.log('');
}

/* -------------------------------------------------------------------- 主流程 */

const which = process.argv[2] || '总览';
const days = String(Number(process.argv[3]) || 7);

if (!QUERIES[which]) {
  console.error(`不认识的查询「${which}」。可用的有：${Object.keys(QUERIES).join(' / ')}`);
  process.exit(2);
}

const token = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!token) {
  console.error('缺少 CLOUDFLARE_API_TOKEN。\n'
    + '  PowerShell:  $env:CLOUDFLARE_API_TOKEN = "你的只读令牌"\n'
    + '  创建步骤（权限只要 Account Analytics: Read）见 docs/访问统计.md §7.4');
  process.exit(2);
}

const account = await accountId();
if (!account) {
  console.error('找不到账号 ID。设一个环境变量即可：\n'
    + '  $env:CLOUDFLARE_ACCOUNT_ID = "你的 32 位账号 ID"   （Cloudflare 后台右下角 / 网址里都有）');
  process.exit(2);
}

const sql = QUERIES[which](days).trim();

/**
 * ⚠️ 网络层要重试、且必须接住异常。
 * 实测（2026-10-10）从本机连 api.cloudflare.com 会**偶发连不上**（curl 报 `HTTP 000`，
 * 同一句 SQL 隔一秒再跑就 200），而 `fetch` 在连不上时是**抛异常**的 ——
 * 不接住就只甩出一段 node 堆栈，看不出到底哪坏了。
 * SQL 写错（4xx）不重试：那重试多少次都一样。
 */
let res;
let text;
for (let attempt = 1; ; attempt++) {
  try {
    res = await fetch(API(account), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: sql,
    });
    text = await res.text();
    break;
  } catch (err) {
    if (attempt >= 3) {
      console.error(`连不上 Cloudflare 的查询接口（重试 3 次都失败）：${err.message}\n`
        + '这是网络问题、不是 SQL 的问题 —— 换个网络或过一会儿重跑一次即可。');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
}

if (!res.ok) {
  console.error(`查询失败：HTTP ${res.status}`);
  // 只回显 Cloudflare 的错误信息，绝不回显令牌本身
  console.error(text.slice(0, 800));
  if (res.status === 401 || res.status === 403) {
    console.error('\n多半是令牌不对或权限不够：需要 Account → Account Analytics → Read。\n'
      + '也可能数据集还没建起来 —— 它是在**第一次有访客**之后才自动创建的。');
  }
  if (res.status === 404) {
    console.error(`\n数据集 ${DATASET} 还不存在。它是第一次写入时自动建的；\n`
      + '确认改动已经部署上线，并且已经有人访问过站点。');
  }
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(text);
} catch (_) {
  console.log(text);      // 万一返回的不是 JSON，原样打出来总比吞掉好
  process.exit(0);
}

console.log(`\n【${which}】最近 ${days} 天 · 数据集 ${DATASET}\n`);
printTable(normalize(payload));
