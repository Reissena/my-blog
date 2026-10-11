/**
 * tools/fetch-site-stats.mjs —— **构建时**查一次「累计访问量」，写进 data/site_stats.yaml，
 * 供站点数据页 /site/ 显示（`layouts/site.html` 读 hugo.Data.site_stats）。
 *
 * 为什么要有这个脚本（而不是让 Hugo 模板自己去查）：
 *   · 模板里查（resources.GetRemote）会让**每一次 Hugo 构建**都依赖一次网络请求，
 *     还要在 hugo.toml 里给 os.Getenv 开白名单、在模板里解析 JSON ——
 *     而这一切的失败面全都压在「构建」上：接口抖一下就可能让站发不出去。
 *   · 拆成独立脚本之后，失败只有一个后果：**不写文件**。Hugo 连网络都不碰，
 *     页面照常是完整的（少了那一张卡片而已）。这条是本次设计的核心，别合并回去。
 *
 * 口径：与 `tools/query-visits.mjs` 的「总览」查询**同一条 SQL**
 * （`SUM(_sample_interval * double1)`）—— 只数页面访问次数这一个总数，
 * 不查任何「访问者层面」的东西（没有 IP、来源、设备、地理、时间曲线、独立访客数）。
 * 不带 WHERE：Analytics Engine 固定只保留 3 个月，所以「累计」= 近三个月。
 * ⚠️ 口径要改就改下面的 SQL，并且与 query-visits.mjs / docs/访问统计.md 一起改。
 *
 * 凭据（**只读**令牌，两个名字认一个，方便本地复用 query-visits.mjs 的习惯）：
 *   CF_ANALYTICS_TOKEN   ← GitHub 仓库 Secrets 里的名字（workflow 用 env 传进来）
 *   CLOUDFLARE_API_TOKEN ← 本地跑的时候可以用这个（与 query-visits.mjs 一致）
 * 账号 ID 不是敏感信息：先看 CLOUDFLARE_ACCOUNT_ID，没有就从
 * `.github/workflows/deploy.yml` 里读现成的那个 —— **不在本文件里再抄一份**，
 * 免得哪天账号换了、这里悄悄指向旧的。
 *
 * ⚠️ 三条硬约束（改动时别破坏）：
 *   1. **绝不打印令牌**：不打印请求头、不打印原始响应体（响应体里可能有别人的数据）；
 *      所有输出都过一遍 `log()`，它会把令牌串替换成 ***，算是最后一道保险。
 *   2. **绝不中断构建**：任何失败都 `exit 0`，只跳过写文件。
 *      失败原因用中文说清楚（HTTP 几 / 什么错），但不 echo 凭据。
 *   3. **绝不写半个文件**：先写 .tmp 再 rename —— 万一写到一半挂了，
 *      留一个语法不完整的 YAML 会让 Hugo 构建直接失败，那正是本脚本要避免的事。
 *
 * 用法：
 *   node tools/fetch-site-stats.mjs                 # 构建时由 workflow 调（见 deploy.yml）
 *   $env:CLOUDFLARE_API_TOKEN = "只读令牌"; node tools/fetch-site-stats.mjs   # 本地手动跑一次
 */

import { readFile, writeFile, rename } from 'node:fs/promises';

const DATASET = 'my_blog_pageviews';
const OUT = new URL('../data/site_stats.yaml', import.meta.url);
const OUT_TMP = new URL('../data/site_stats.yaml.tmp', import.meta.url);

/** 与 query-visits.mjs 的「总览」一致：累计访问次数（乘 _sample_interval 才对得上采样） */
const SQL = `SELECT SUM(_sample_interval * double1) AS pv FROM ${DATASET}`;

const TOKEN_NAMES = ['CF_ANALYTICS_TOKEN', 'CLOUDFLARE_API_TOKEN'];
const token = TOKEN_NAMES.map((n) => (process.env[n] || '').trim()).find(Boolean) || '';

/**
 * 所有输出都走这里。令牌串一旦出现在任何消息里就替换掉 ——
 * `env:` 传入的值 GitHub 自己也会打码，但本地跑、或者以后有人改了调用方式时
 * 这层保险仍然有效，而且它把「不许泄露凭据」这件事写在了代码里，不只是文档里。
 */
function log(msg) {
  const safe = token ? String(msg).split(token).join('***') : String(msg);
  console.log(safe);
}

/** 失败也必须是 0：这个脚本的唯一职责是「查到了就写文件」，不是「把关」 */
function done(msg) {
  log(msg);
  process.exit(0);
}

/** 账号 ID：环境变量 → deploy.yml（与 query-visits.mjs 同一个来源） */
async function accountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) { return process.env.CLOUDFLARE_ACCOUNT_ID.trim(); }
  try {
    const yml = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
    const m = /^\s*accountId:\s*([0-9a-f]{32})\s*$/m.exec(yml);
    if (m) { return m[1]; }
  } catch (_) { /* 读不到就走下面的提示 */ }
  return '';
}

/**
 * 把 Cloudflare 的错误说成人话。
 * ⚠️ **只挑 code / message 两个字段**，绝不打印整个响应体：那里面可能有查询结果
 * （也就是访问数据本身），也可能带上别的敏感字段。
 *
 * ⚠️ **实测踩到的坑（2026-10-11）**：令牌无效时 Cloudflare 不一定回 401 ——
 * 拿一个格式不对的令牌打真接口，回来的是 **400 + `code 9106` "Authentication failed"**。
 * 只按状态码给提示的话，站主会看到「多半是 SQL 写错了」，然后跑去查一句根本没问题的
 * SQL。所以这里**先认认证类错误**（消息里有 auth，或 code 9106），再退回状态码。
 */
function describeError(status, text) {
  const tips = {
    400: '多半是 SQL 写错了（400）',
    401: '令牌无效或已被删除（401）',
    403: '令牌权限不够：需要 Account → Account Analytics → Read（403）',
    404: '数据集还不存在：它是第一次有访客写入时才自动创建的（404）',
    429: '查询次数超了免费额度（429）',
  };

  let code = '';
  let message = '';
  let isJson = false;
  try {
    const j = JSON.parse(text);
    isJson = true;
    const first = Array.isArray(j.errors) && j.errors.length ? j.errors[0] : null;
    if (first) {
      code = first.code === undefined ? '' : first.code;
      message = String(first.message || '');
    }
  } catch (_) { /* 不是 JSON：只按状态码给通用解释 */ }

  const authLike = /auth/i.test(message) || String(code) === '9106';
  const hint = authLike
    ? '令牌无效 / 被截断 / 权限不够（Cloudflare 报的是「认证失败」）'
    : (tips[status] || '接口返回了非预期的状态码');
  const tail = message
    ? ` Cloudflare 说：${message}${code === '' ? '' : `（code ${code}）`}`
    : (isJson ? '' : '  （响应体不是 JSON，已忽略不打印）');

  return `HTTP ${status}｜${hint}${tail}`.slice(0, 300);
}

/* ------------------------------------------------------------------ 主流程 */
try {
  if (!token) {
    done(`· 没有 ${TOKEN_NAMES.join(' / ')}，跳过查询（/site/ 会少一张「累计访问量」卡片，这是预期行为）`);
  }

  const account = await accountId();
  if (!account) {
    done('· 找不到 Cloudflare 账号 ID（既没有 CLOUDFLARE_ACCOUNT_ID，也没能从 deploy.yml 里读到），跳过查询');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`;

  /* 网络层重试 3 次：本机/CI 连 api.cloudflare.com 都偶发连不上（curl 报 HTTP 000），
     隔一秒重跑就好。SQL 写错那类 4xx 不重试 —— 重试多少次都一样。 */
  let res = null;
  let text = '';
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },   // 令牌只在请求头里，绝不进 URL
        body: SQL,
        signal: AbortSignal.timeout(10000),               // 超时就放弃：宁可少一个数字，别拖住部署
      });
      text = await res.text();
      break;
    } catch (err) {
      if (attempt >= 3) {
        /* 说清楚「是网络问题，不是 SQL 问题」：fetch 失败时 err.message 只有一句
           "fetch failed"，真正有用的原因（ECONNREFUSED / ENOTFOUND…）在 err.cause 里。
           这些都不含凭据，可以安全打印。 */
        const why = err.name === 'TimeoutError' ? '请求超时（10 秒）'
          : (err.cause && err.cause.code) ? `${err.cause.code}（网络不通 / 连不上）`
            : (err.message || String(err));
        done(`· 连接 Cloudflare 查询接口失败（重试 3 次都失败）：${why}｜这是网络问题，不是 SQL 问题`);
      }
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }

  if (!res.ok) {
    done(`· 累计访问量这次没查到，跳过写文件（页面照常部署，只是少一张卡片）：${describeError(res.status, text)}`);
  }

  /* 解析：拿到的必须是「一个数字」。结构变了、字段没了、值是 null（表还是空的）
     —— 全都当「没查到」，绝不硬写一个 0 进去冒充数据。 */
  let pv = null;
  try {
    const payload = JSON.parse(text);
    const row = Array.isArray(payload.data) && payload.data.length ? payload.data[0] : null;
    if (row && typeof row.pv === 'number' && Number.isFinite(row.pv)) { pv = row.pv; }
  } catch (_) { /* 下面统一报 */ }

  if (pv === null) {
    done('· 接口返回的 JSON 里没有可用的 pv 数字（结构可能变了 / 数据集还是空的），跳过写文件');
  }

  /* 数据时间按**北京时间**（UTC+8）标注，与页脚那个时钟、页面上「构建于」一致。
     这里刻意不用 Intl/时区库：加 8 小时等价、也不会因为构建机缺 tzdata 而失败。 */
  const updated = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const visits = Math.round(pv);

  /* updated 一定要带引号：YAML 里裸写 2026-10-11 会被解析成**时间类型**，
     页面上会显示成 "2026-10-11 00:00:00 +0000 UTC"，非常难看。 */
  const yaml = [
    '# 这个文件是构建时由 tools/fetch-site-stats.mjs 生成的，不进仓库（见 .gitignore）。',
    '# 页面：/site/（layouts/site.html）。口径与失败时的行为见 docs/访问统计.md §7.5。',
    `visits: ${visits}`,
    `updated: "${updated}"`,
    '',
  ].join('\n');

  /* 先写 .tmp 再 rename：避免留下半个 YAML —— 那种文件会让 hugo 直接构建失败 */
  await writeFile(OUT_TMP, yaml, 'utf8');
  await rename(OUT_TMP, OUT);

  log(`✓ 累计访问量 = ${visits}（截至 ${updated}），已写入 data/site_stats.yaml`);
  process.exit(0);
} catch (err) {
  /* 意料之外的异常（磁盘写不进去等）同样不许拖累构建 */
  done(`· 查询累计访问量时出了意料之外的错，跳过写文件：${err && err.message ? err.message : err}`);
}
