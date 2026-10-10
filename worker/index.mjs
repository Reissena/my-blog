/**
 * worker/index.mjs —— 本站的「服务端逻辑」，目前只干一件事：**页面访问打点**。
 *
 * ⚠️ 这段代码真正的风险不是「统计不准」，而是**它可能把整个站点搞挂**。
 *   在它出现之前，这个 Worker 是纯静态资源托管 —— 没有脚本，就没有出错的机会。
 *   现在 `wrangler.toml` 里开了 `run_worker_first = true`，
 *   意味着**每一个请求（图片、CSS、JS、字体、音乐也一样）都要先过这里**。
 *   所以下面所有写法都围绕一条铁律：
 *
 *     页面响应与打点彻底解耦 —— 打点出任何事，页面都必须照常返回。
 *
 *   具体做法（三条都要留着，删任何一条都会把「打点」变成「故障源」）：
 *     1. `await env.ASSETS.fetch(request)` 拿到的就是**改动前那个一模一样的响应**，
 *        我们从头到尾不碰它、不改它、不包它；
 *     2. 打完点之前先判断，判断和写入分别包在自己的 try/catch 里；
 *     3. 写入走 `ctx.waitUntil()` 异步做，**不占页面响应的任何时间**，失败也没有人等它。
 *
 * 口径（什么算一次访问）、隐私处理、怎么查看与关闭，见 `docs/访问统计.md`。
 * 改口径就改本文件第 1 节的常量和 `shouldCount()` —— 那两个是唯一的判定入口。
 */

/* =====================================================================
   1. 口径常量（要调口径就改这里）
   ===================================================================== */

/**
 * 明显的爬虫 / 脚本 User-Agent 特征（小写子串匹配）。
 *
 * 为什么要自己列一串：Cloudflare 的「Bot 分数」要另开 Bot Management（付费），
 * 免费额度里拿不到；而访客数被自己人（搜索引擎、SEO 工具、监控探针）刷起来，
 * 数字就完全没法看了。
 *
 * ⚠️ 这里刻意**只放明显特征**，宁可漏掉几个不常见的爬虫：
 * 误杀一个真人访客（少算）比放过一群爬虫（虚高）更糟 —— 但两者都不如「看得懂数字怎么来的」重要，
 * 所以误判了就来这里加/删一行，不用改逻辑。
 * ⚠️ `bot` / `crawl` / `spider` 三条已经覆盖了绝大多数（Googlebot、Bingbot、Baiduspider、
 * YandexBot、DuckDuckBot…），下面单独列出的都是**名字里不带这几个词**的。
 */
const BOT_UA_MARKERS = [
  // 通用关键词（覆盖绝大多数爬虫）
  'bot', 'crawl', 'spider', 'slurp', 'scrape',
  // 名字里不带 bot/crawl/spider 的抓取器
  'bingpreview', 'facebookexternalhit', 'bytespider', 'petalbot',
  'ahrefs', 'semrush', 'mj12', 'dotbot', 'screaming frog', 'seznam', 'yandex',
  // 命令行 / 脚本 / HTTP 库（真人不会用这些访问网页）
  'curl', 'wget', 'httpie', 'python', 'go-http-client', 'okhttp',
  'axios', 'node-fetch', 'undici', 'libwww', 'winhttp', 'scrapy',
  'postman', 'insomnia', 'powershell', 'restsharp',
  // 无头浏览器 / 自动化 / 监控探针（它们报的请求数不是访客数）
  'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
  'lighthouse', 'pagespeed', 'pingdom', 'uptimerobot', 'statuscake',
  'site24x7', 'datadog', 'newrelic', 'monitoring',
  // AI 训练 / 问答抓取器（同样在刷页数，不是人）
  'gptbot', 'claudebot', 'ccbot', 'perplexity', 'applebot', 'amazonbot',
];

/**
 * 明显不是网页的文件后缀。
 *
 * 为什么还要这一道：`Sec-Fetch-Dest: document` 理论上已经能把图片/CSS 挡在外面，
 * 但**直接粘 URL 打开** `/index.xml`、`/favicon.ico` 时浏览器报的就是 document，
 * 那不该算「看了一个页面」。Hugo 的页面路径永远不会以这些后缀结尾，所以不会误杀。
 */
const NON_PAGE_EXT = /\.(?:css|js|mjs|json|xml|txt|md|ico|png|jpe?g|webp|gif|svg|avif|bmp|woff2?|ttf|otf|eot|mp3|m4a|ogg|wav|flac|mp4|webm|map|webmanifest|pdf|zip)$/i;

/* =====================================================================
   2. 判定：这一请求算不算「一次页面访问」
   ===================================================================== */

/** 站内无刷新跳转（pjax 真实导航）带的标记 —— 见 assets/js/pjax.js */
const PJAX_NAV_HEADER = 'X-PJAX';
/** pjax 的「悬停预取」带的标记 —— 它只说明鼠标停在链接上，**不代表有人点** */
const PJAX_PREFETCH_HEADER = 'X-PJAX-Prefetch';

/**
 * 是不是「预取 / 预渲染」，也就是**浏览器替访客先取回来、但访客可能永远不点**的请求。
 *
 * 为什么必须挡掉：本站 `<head>` 里有一段 Speculation Rules 的 prefetch（见
 * `layouts/_partials/extend_head.html`），鼠标扫过链接就可能触发一次完整的 HTML 请求。
 * 不挡的话，一屏文章列表扫一遍鼠标就能刷出十几次「访问」，数字直接翻倍。
 * 各家浏览器的头不一样，所以四个都查。
 */
function isSpeculativeFetch(h) {
  const raw = [h.get('Sec-Purpose'), h.get('Purpose'), h.get('X-Purpose'), h.get('X-Moz')]
    .filter(Boolean).join(' ');
  return /prefetch|prerender|preview/i.test(raw);
}

/** UA 看着像爬虫 / 脚本吗 */
function isBot(ua) {
  if (!ua) { return true; }   // 真浏览器一定会带 UA；不带的当爬虫处理
  const low = ua.toLowerCase();
  return BOT_UA_MARKERS.some(function (m) { return low.indexOf(m) !== -1; });
}

/** UA 粗分类：桌面 / 手机 / 平板（只用于看个大概，不追求准确） */
function deviceOf(ua) {
  // 平板必须排在手机前面判断：Android 平板默认**不带** Mobile 字样，
  // 而手机一定带，所以先认「iPad / 不带 Mobile 的 Android」，再认手机。
  if (/ipad|tablet|playbook|silk|kindle/i.test(ua)) { return 'tablet'; }
  if (/android/i.test(ua) && !/mobile/i.test(ua)) { return 'tablet'; }
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini|iemobile/i.test(ua)) { return 'mobile'; }
  return 'desktop';
}

/**
 * ★ 本站最要紧的一条判定 —— 判错了不报错，只是数字悄悄不对。
 *
 * 为什么不能只用 `Sec-Fetch-Dest: document`：**本站的站内跳转是 pjax（前端 fetch）**，
 * 不是整页导航，浏览器给那种请求报的是 `Sec-Fetch-Dest: empty`。
 * 只认 document 的话，「进来首页算 1 次，之后点开五篇文章算 0 次」，
 * 而本站访客大部分时间都在点文章 —— 那等于把统计废掉。
 * 好在 `assets/js/pjax.js` **本来就会带 `X-PJAX: 1`**（它用这个头做什么我们不管），
 * 所以这里直接认这个头就行，**一行 pjax 代码都不用改**。
 *
 * 已知的口径取舍（写进文档了，别以为漏了）：
 *   · pjax 的悬停预取（`X-PJAX-Prefetch`）**不算** —— 它只是鼠标路过；
 *   · 副作用：如果访客悬停够久、预取已经回来了，之后那次点击是**从 JS 缓存里渲染的、
 *     根本不发请求**，这一次就统计不到。所以本口径**只会少算、不会虚高**，
 *     数字应读作「真正到达服务器的页面请求数」的下限。
 *   · 少了 `Sec-Fetch-*` 的老浏览器（旧 Safari、部分 App 内置浏览器）：退回看 `Accept`。
 */
function isPageRequest(request) {
  const h = request.headers;

  if (h.get(PJAX_PREFETCH_HEADER)) { return false; }   // 悬停预取：可能没人点
  if (isSpeculativeFetch(h)) { return false; }        // 浏览器预取：同上

  // pjax 真实导航：浏览器 fetch，拿不到 document，只能靠自带的头认
  if (h.get(PJAX_NAV_HEADER) === '1') { return true; }

  const dest = h.get('Sec-Fetch-Dest');
  if (dest) { return dest === 'document'; }           // 现代浏览器：这个最可靠
  return /text\/html/i.test(h.get('Accept') || '');   // 老浏览器兜底
}

/**
 * 最终裁决：这一请求打不打点。
 *
 * 为什么还要看响应码：
 *   · 3xx（比如少一个斜杠的 `/posts/foo` → `/posts/foo/`）不是「看了一个页面」，
 *     浏览器紧接着会再请求一次带斜杠的地址，两次都记就成了同一页算两遍；
 *   · 4xx/5xx 不是正常访问（爬虫扫 `/wp-login.php` 那种就落在这里，UA 漏掉的也拦得住）。
 *   只认 200 与 304：**304 必须算** —— 老访客的浏览器走缓存协商时，
 *   服务器收到的就是 304，可页面确实在他屏幕上渲染出来了。
 */
function shouldCount(request, status) {
  if (request.method !== 'GET') { return false; }
  if (status !== 200 && status !== 304) { return false; }
  if (!isPageRequest(request)) { return false; }
  if (isBot(request.headers.get('User-Agent') || '')) { return false; }
  if (NON_PAGE_EXT.test(new URL(request.url).pathname)) { return false; }
  return true;
}

/* =====================================================================
   3. 打点：把这一条访问写进 Analytics Engine
   ===================================================================== */

/**
 * 把路径归一化，免得同一个页面对应出好几行。
 *
 * 起因：Hugo 的页面正规写法是 `/posts/foo/`，但 `/posts/foo`、`/posts/foo/index.html`
 * 在资源服务器眼里是同一页（前者会 307 过去）。不归一化，同一个页面就会以两三种写法
 * 散在结果里，看着像三个页面。**查询串（`?a=b`）一律丢掉** —— 它会让基数爆炸，
 * 而且可能带上别人的隐私参数。
 */
function normalizePath(pathname) {
  let p = pathname;
  if (p.length > 1 && p.endsWith('/')) { p = p.slice(0, -1); }
  if (p.endsWith('/index.html')) { p = p.slice(0, -'/index.html'.length); }
  return (p || '/').slice(0, 200);
}

/** 来源：站外只留**主机名**，不留完整网址（见 docs/访问统计.md 的隐私一节） */
function referrerOf(request, url) {
  const raw = request.headers.get('Referer') || request.headers.get('Referrer') || '';
  if (!raw) { return 'direct'; }
  try {
    const r = new URL(raw);
    if (r.host === url.host) { return 'internal'; }   // 站内跳转（pjax 的 Referer 就是当前页）
    return (r.host || 'direct').toLowerCase().slice(0, 100);
  } catch (_) {
    return 'direct';   // 头被伪造 / 残缺：当直接访问，绝不因为一个头就抛错
  }
}

/**
 * 访客指纹：`IP + UA + 当天盐值` 的 SHA-256，**永不保存原始 IP**。
 *
 * 为什么要加盐、而且盐**每天换**：
 *   不加盐的话，「IP+UA 的哈希」是个跨天不变的稳定标识，等于给每个访客发了一个
 *   长期跟踪号 —— 90 天留存期内谁拿到这张表，就能把同一个人的所有访问串起来。
 *   盐里带上当天日期，昨天和今天的哈希就完全对不上，**跨天关联被彻底切断**；
 *   同一天内哈希不变，所以「一天内同一个人算一次」还做得到 —— 这是本站唯一需要的粒度。
 *
 * 日期用 **UTC**（不是北京时间）：Analytics Engine 的 `timestamp` 也是 UTC，
 * 查询按 `toDate(timestamp)` 分组时才能和这里的「一天」严格对齐。
 * 代价是「一天」在北京时间早上 8 点换日，改法见文档。
 *
 * `env.VISIT_SALT` 是可选密钥（`npx wrangler secret put VISIT_SALT`）：
 * 不配也能跑（那时的盐只剩日期），但配上以后，即使有人同时拿到了这张表
 * 和这份源码，也没法靠穷举 IP 把哈希还原回某个人。
 */
async function visitorHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = request.headers.get('User-Agent') || '';
  const day = new Date().toISOString().slice(0, 10);
  const salt = (env.VISIT_SALT || '') + '|' + day;
  const bytes = new TextEncoder().encode(ip + '\n' + ua + '\n' + salt);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), function (b) {
    return b.toString(16).padStart(2, '0');
  }).join('').slice(0, 32);
}

/**
 * 真正写数据点。
 *
 * ⚠️ Analytics Engine 只认**一个** index —— 给两个的话这条数据**不会报错，直接不落库**，
 * 属于最难查的那类问题。所以 `indexes` 里永远只有一个值：访客指纹。
 * 它同时是采样键：真被采样了，同一个访客的当天数据也会整组一起被采样，UV 仍然算得准。
 *
 * 字段顺序**一旦上线就不能改**（Analytics Engine 是按位置存 blob1/double1 的），
 * 要加字段只能往后追加，并且在文档里同步说明：
 *   blob1 路径 · blob2 国家 · blob3 来源 · blob4 设备 · blob5 载荷方式
 *   double1 恒为 1（`sum(double1)` 就是访问次数）· index1 访客指纹
 */
async function record(request, env) {
  if (!env.VISITS) { return; }   // 本地没配绑定 / 绑定名对不上：安静退出，不许抛错

  const url = new URL(request.url);
  const ua = request.headers.get('User-Agent') || '';
  const cf = request.cf || {};   // ⚠️ 本地 dev 下 request.cf 可能整个是 undefined

  env.VISITS.writeDataPoint({
    indexes: [await visitorHash(request, env)],
    blobs: [
      normalizePath(url.pathname),
      typeof cf.country === 'string' ? cf.country : 'XX',
      referrerOf(request, url),
      deviceOf(ua),
      request.headers.get(PJAX_NAV_HEADER) === '1' ? 'pjax' : 'load',
    ],
    doubles: [1],
  });
}

/* =====================================================================
   4. 入口
   ===================================================================== */

export default {
  /**
   * ⚠️ 顺序不能调：**先拿响应，再考虑打点，最后原样返回响应**。
   * 反过来写（先打点再取资源）就等于把打点放到了页面响应的关键路径上，
   * 一旦 Analytics Engine 抖动或者代码抛错，用户看到的就是白屏而不是文章。
   */
  async fetch(request, env, ctx) {
    const response = await env.ASSETS.fetch(request);   // 与加统计之前完全同一条路径

    try {
      if (shouldCount(request, response.status)) {
        // waitUntil：响应立刻返回给访客，打点在后台跑；跑失败也只是这条统计丢了。
        // （ctx 在 Workers 里一定有 waitUntil，这里的兜底是给 tools/test-pageview.mjs 用的）
        const job = record(request, env).catch(function () { /* 打点失败：静默，绝不打扰访问 */ });
        if (ctx && typeof ctx.waitUntil === 'function') { ctx.waitUntil(job); }
      }
    } catch (_) {
      // shouldCount 自己抛错（比如 URL 解析不出来）：当这次不该统计，页面照常返回
    }

    return response;
  },
};
