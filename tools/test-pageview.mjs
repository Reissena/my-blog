/**
 * tools/test-pageview.mjs —— `worker/index.mjs` 的自测脚本（**手动跑，不在 CI 里**）。
 *
 * 为什么需要它：站点唯一的服务端代码就是那个 Worker，而它一旦判错**不会报错**，
 * 只会让数字悄悄不对；更糟的坏法是它把页面响应搞坏 —— 那是最不该发生的事。
 * 所以这里把两件事都钉住：
 *   · 口径：哪种请求算一次访问、哪种不算（每条都是一个用例，改口径时先看这里会不会红）；
 *   · 安全底线：**任何情况下返回的响应必须与 env.ASSETS.fetch 给出的是同一个对象**，
 *     包括打点抛错、绑定没配、Analytics Engine 整个不可用的时候。
 *
 * 跑法（本机 Node ≥ 18 即可，不需要装任何依赖、不需要联网、不需要 Cloudflare 账号）：
 *
 *     node tools/test-pageview.mjs
 *
 * 它**不会**真的写数据：`env.VISITS` 是个假的，写入被拦在内存里检查。
 */

import worker from '../worker/index.mjs';

let pass = 0;
const failures = [];

function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  failures.push(name + (extra === undefined ? '' : '  →  ' + JSON.stringify(extra)));
}

function eq(name, actual, expected) {
  ok(name, actual === expected, { actual: actual, expected: expected });
}

/* ---------------------------------------------------------------- 测试脚手架 */

const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/604.1';
const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/** 造一个请求。cf 是 Workers 私有的属性，Node 的 Request 上没有，得手动挂。 */
function makeRequest(path, opts = {}) {
  const headers = Object.assign({ 'User-Agent': UA_CHROME }, opts.headers || {});
  const req = new Request('https://yunblog.com.cn' + path, {
    method: opts.method || 'GET',
    headers: headers,
  });
  Object.defineProperty(req, 'cf', { value: opts.cf, configurable: true });
  return req;
}

/**
 * 跑一次 Worker 入口。
 * 返回 { response, writes, returnedSameResponse }：
 *   returnedSameResponse 为 true 表示「返回的就是资源服务器给的那个响应对象本身」——
 *   这是「静态资源路径没被改动」最直接的证据（不是内容像，而是同一个对象）。
 */
async function run(path, opts = {}) {
  const assetResponse = new Response(opts.body === undefined ? '<html>页面</html>' : opts.body, {
    status: opts.status || 200,
    headers: { 'content-type': 'text/html; charset=utf-8', etag: 'W/"abc"' },
  });

  const writes = [];
  const env = {
    ASSETS: { fetch: async () => assetResponse },
  };
  if (opts.withBinding !== false) {
    env.VISITS = {
      writeDataPoint: (point) => {
        if (opts.writeThrows) { throw new Error('模拟 Analytics Engine 打点失败'); }
        writes.push(point);
      },
    };
  }

  const pending = [];
  const ctx = { waitUntil: (p) => { pending.push(p); } };

  const response = await worker.fetch(makeRequest(path, opts), env, ctx);
  await Promise.allSettled(pending);   // 等后台打点跑完，否则断言会看不到写入

  return { response, writes, returnedSameResponse: response === assetResponse };
}

/** 从写入里取字段；没写入就返回 undefined */
const blob = (w, i) => (w[0] ? w[0].blobs[i - 1] : undefined);
const index = (w) => (w[0] ? w[0].indexes[0] : undefined);

/* ------------------------------------------------- ① 响应必须原封不动（底线） */

{
  const r = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', Accept: 'text/html' } });
  ok('① 正常页面：返回的就是资源服务器那个响应对象', r.returnedSameResponse);
  eq('① 正常页面：状态码原样', r.response.status, 200);
  eq('① 正常页面：正文原样', await r.response.text(), '<html>页面</html>');

  const img = await run('/images/background.jpg', { headers: { 'Sec-Fetch-Dest': 'image' } });
  ok('① 图片请求：返回的也是同一个响应对象', img.returnedSameResponse);
  eq('① 图片请求：不落库', img.writes.length, 0);

  const css = await run('/css/fluent.css', { headers: { 'Sec-Fetch-Dest': 'style', Accept: 'text/css' } });
  eq('① CSS 请求：不落库', css.writes.length, 0);

  const js = await run('/js/pjax.js', { headers: { 'Sec-Fetch-Dest': 'script', Accept: '*/*' } });
  eq('① JS 请求：不落库', js.writes.length, 0);

  const mp3 = await run('/music/a.mp3', { headers: { 'Sec-Fetch-Dest': 'audio' } });
  eq('① 音乐请求：不落库', mp3.writes.length, 0);
}

/* ------------------------------------- ② 打点失败 / 没绑定：页面必须照样正常 */

{
  const r = await run('/', {
    headers: { 'Sec-Fetch-Dest': 'document' },
    writeThrows: true,
  });
  ok('② 打点抛错：响应对象仍然原样返回（不是新拼的）', r.returnedSameResponse);
  eq('② 打点抛错：状态码 200', r.response.status, 200);
  eq('② 打点抛错：正文完整', await r.response.text(), '<html>页面</html>');

  const noBinding = await run('/', { headers: { 'Sec-Fetch-Dest': 'document' }, withBinding: false });
  ok('② 没配 VISITS 绑定：响应原样返回', noBinding.returnedSameResponse);
  eq('② 没配 VISITS 绑定：不抛错', noBinding.writes.length, 0);

  // 资源服务器给什么就返回什么：404 也得原样透出去，不能被统计逻辑改写成 200
  const notFound = await run('/nope/', { status: 404, body: '404', headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('② 404 页面：状态码原样透出', notFound.response.status, 404);
  eq('② 404 页面：不统计', notFound.writes.length, 0);
}

/* ------------------------------------------------------------ ③ 什么算一次访问 */

{
  const doc = await run('/posts/hello/', { headers: { 'Sec-Fetch-Dest': 'document', Accept: 'text/html' } });
  eq('③ 整页导航：算', doc.writes.length, 1);
  eq('③ 整页导航：载荷方式记为 load', blob(doc.writes, 5), 'load');
  eq('③ 整页导航：路径归一化去掉末尾斜杠', blob(doc.writes, 1), '/posts/hello');

  const pjax = await run('/posts/hello/', { headers: { 'X-PJAX': '1' } });
  eq('③ pjax 站内跳转（Sec-Fetch-Dest: empty）也算', pjax.writes.length, 1);
  eq('③ pjax：载荷方式记为 pjax', blob(pjax.writes, 5), 'pjax');

  const pjaxWarm = await run('/posts/hello/', { headers: { 'X-PJAX-Prefetch': '1' } });
  eq('③ pjax 悬停预取：不算（鼠标路过而已）', pjaxWarm.writes.length, 0);

  const spec = await run('/posts/hello/', {
    headers: { 'Sec-Fetch-Dest': 'document', 'Sec-Purpose': 'prefetch' },
  });
  eq('③ Speculation Rules 预取（Sec-Purpose: prefetch）：不算', spec.writes.length, 0);

  const old = await run('/', { headers: { 'Sec-Fetch-Dest': 'prefetch' } });
  eq('③ Sec-Fetch-Dest: prefetch：不算', old.writes.length, 0);

  const legacy = await run('/', { headers: { Accept: 'text/html,application/xhtml+xml' } });
  eq('③ 老浏览器（无 Sec-Fetch-*）靠 Accept 兜底：算', legacy.writes.length, 1);

  const fetchXhr = await run('/index.json', { headers: { 'Sec-Fetch-Dest': 'empty', Accept: '*/*' } });
  eq('③ 搜索索引等前端 fetch：不算', fetchXhr.writes.length, 0);

  const head = await run('/', { method: 'HEAD', headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('③ HEAD 请求：不算', head.writes.length, 0);

  const redirect = await run('/posts/hello', { status: 307, headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('③ 307 跳转（少一个斜杠那次）：不算，避免同一页记两遍', redirect.writes.length, 0);

  const notModified = await run('/', { status: 304, body: null, headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('③ 304（浏览器协商缓存）：必须算 —— 页面确实渲染了', notModified.writes.length, 1);

  const feed = await run('/index.xml', { headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('③ 直接打开 /index.xml：不算（不是网页）', feed.writes.length, 0);

  const indexHtml = await run('/index.html', { headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('③ /index.html 归一化到 /', blob(indexHtml.writes, 1), '/');
}

/* ----------------------------------------------------------------- ④ 爬虫过滤 */

{
  const bot = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'User-Agent': UA_GOOGLEBOT } });
  eq('④ Googlebot：不算', bot.writes.length, 0);

  for (const [name, ua] of Object.entries({
    'Bingbot': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Baiduspider': 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    'GPTBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
    'AhrefsBot': 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'curl': 'curl/8.4.0',
    'python-requests': 'python-requests/2.31.0',
    'HeadlessChrome': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36',
    'UptimeRobot': 'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
    '空 UA': '',
  })) {
    const r = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'User-Agent': ua } });
    eq('④ ' + name + '：不算', r.writes.length, 0);
  }

  const botPjax = await run('/posts/hello/', { headers: { 'X-PJAX': '1', 'User-Agent': UA_GOOGLEBOT } });
  eq('④ 爬虫假装 pjax：也不算', botPjax.writes.length, 0);
}

/* ------------------------------------------------------- ⑤ 字段内容与去重指纹 */

{
  const r = await run('/about/', {
    headers: { 'Sec-Fetch-Dest': 'document', Referer: 'https://www.google.com/search?q=yunblog' },
    cf: { country: 'CN' },
  });
  eq('⑤ 国家码来自 Cloudflare（免费给的那个）', blob(r.writes, 2), 'CN');
  eq('⑤ 站外来源只留主机名（不留完整网址与查询串）', blob(r.writes, 3), 'www.google.com');
  eq('⑤ 桌面 UA 归类 desktop', blob(r.writes, 4), 'desktop');
  eq('⑤ double1 恒为 1（sum 就是访问次数）', r.writes[0].doubles[0], 1);
  eq('⑤ indexes 只有一个值（给两个 Analytics Engine 会静默丢弃整条）', r.writes[0].indexes.length, 1);

  const mobile = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'User-Agent': UA_IPHONE } });
  eq('⑤ iPhone 归类 mobile', blob(mobile.writes, 4), 'mobile');
  const tablet = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'User-Agent': UA_IPAD } });
  eq('⑤ iPad 归类 tablet', blob(tablet.writes, 4), 'tablet');

  const internal = await run('/posts/hello/', { headers: { 'X-PJAX': '1', Referer: 'https://yunblog.com.cn/' } });
  eq('⑤ 站内来源记为 internal', blob(internal.writes, 3), 'internal');
  const direct = await run('/', { headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('⑤ 没有 Referer 记为 direct', blob(direct.writes, 3), 'direct');
  // 伪造/残缺的 Referer（真实浏览器不会发，但头可以随便伪造）。ASCII 之外还要
  // 用「看着像 URL 但不是」的值，否则测不到 decode 失败那条分支。
  const junkRef = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', Referer: '::::not a url:::' } });
  eq('⑤ Referer 是垃圾值：退回 direct，不抛错', blob(junkRef.writes, 3), 'direct');

  const noCf = await run('/', { headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('⑤ 拿不到 cf（本地 dev）：国家记 XX', blob(noCf.writes, 2), 'XX');

  // 去重指纹：同一天 + 同 IP + 同 UA → 同一个指纹；换 UA 就换指纹
  const a1 = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'CF-Connecting-IP': '1.2.3.4' } });
  const a2 = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'CF-Connecting-IP': '1.2.3.4' } });
  const b1 = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'CF-Connecting-IP': '5.6.7.8' } });
  eq('⑤ 同一天同一人：指纹一致（所以 UV 去得掉重）', index(a1.writes), index(a2.writes));
  ok('⑤ 换 IP：指纹不同', index(a1.writes) !== index(b1.writes));
  eq('⑤ 指纹是 32 位十六进制（不存原始 IP）', /^[0-9a-f]{32}$/.test(index(a1.writes) || ''), true);

  // 盐值每天换：把「今天」换成明天，同一份输入的指纹必须完全不同
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    toISOString() { return '2099-01-01T00:00:00.000Z'; }
  };
  const tomorrow = await run('/', { headers: { 'Sec-Fetch-Dest': 'document', 'CF-Connecting-IP': '1.2.3.4' } });
  globalThis.Date = RealDate;
  ok('⑤ 盐值每天换：跨天指纹对不上（断掉长期跟踪）', index(tomorrow.writes) !== index(a1.writes));

  // 路径长度上限：极长路径不该把 blob 撑爆
  const long = await run('/' + 'a'.repeat(500) + '/', { headers: { 'Sec-Fetch-Dest': 'document' } });
  eq('⑤ 超长路径被截断到 200 字符', blob(long.writes, 1).length, 200);
}

/* -------------------------------------------------------------------- 汇总 */

if (failures.length) {
  console.error('\n✗ 失败 ' + failures.length + ' 项，通过 ' + pass + ' 项：\n');
  for (const f of failures) { console.error('  · ' + f); }
  process.exit(1);
}
console.log('✓ 全部通过（' + pass + ' 项）：响应原样返回 · 打点失败不影响页面 · 口径与去重指纹符合预期');
