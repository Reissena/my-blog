/* ============================================================================
   局部无刷新导航（pjax 式）—— 换页面时音乐不中断 + 切页"秒到"
   ----------------------------------------------------------------------------
   1) 拦截站内链接：fetch + DOMParser 取回目标页，只替换 <main class="main">
      （内容区，含 .fc-layout / 左导航 / 右侧栏 / 播放器大卡），再同步 <title>、
      顶部导航高亮、body 的类、页面专属 head 资源。
   2) 预取：鼠标悬停 / 键盘聚焦 / 移动端 touchstart 时提前把目标页 HTML 取回来
      存进内存缓存（Map，最多 20 条，LRU 淘汰），点击命中缓存就直接渲染，不等网络。
      同一个 URL 只取一次，正在取的不会重复发起；失败静默忽略；用过的缓存立即作废
      （页面内容可能已经变了）；响应带 no-store 或发生重定向时不缓存。
   3) 切页动画：把内容替换包进 document.startViewTransition()，给内容区用独立的
      view-transition-name（fc-page），持久播放器用 fc-player —— 都不碰 root，
      因为 root 那一对是留给「主题切换圆形扩散」的（见 fluent.css 第 10/12 节）。
      主题脚本会在扩散前临时摘掉这两个名字（window.fcViewNames），否则命名元素
      画在 root 之上、圆形盖不住它们。

   为什么音频不会断：<audio> 是 music-player.js 用 new Audio() 持有的，不在 DOM 里；
   迷你播放条与播放列表数据在 footer（内容区之外），永远不被替换；换完调用
   window.fcMusic.refresh() 把播放器状态画到新界面上。

   降级（任何情况都不能把站点搞坏）：
     · 缺 fetch / DOMParser / pushState → 整个脚本不启用，退化成普通多页站点
     · fetch 失败 / 超时 / 目标页结构不对 → location.href 正常跳转
     · 外链、target=_blank、download、data-no-pjax、纯 #hash、mailto: → 一律不拦
     · /search/ 不拦：主题的搜索脚本绑在 window load 上，无刷新换内容后不会重新
       初始化，这一页交给浏览器正常跳转最稳（只此一页有约半秒空档）
     · 不支持 startViewTransition / 开了「减少动效」/ 已有过渡在跑 → 直接换内容
     · 后退/前进 fetch 失败 → location.reload()，保证内容和地址栏一致
   ========================================================================== */
(function () {
    'use strict';

    if (!window.fetch || !window.DOMParser || !window.history || !history.pushState) { return; }

    var CONTENT = 'main.main';
    var content = document.querySelector(CONTENT);
    if (!content) { return; }

    var SKIP_PATH = /\/search\/?$/;
    var TIMEOUT = 10000;
    var CACHE_MAX = 20;      // 预取缓存条数上限（LRU）
    var HOVER_DELAY = 80;    // 悬停多久后才真的去预取（鼠标扫过不算）

    var inflight = null;
    var cache = new Map();
    var warming = {};
    var hoverTimer = null;
    var activeVT = null;     // 正在跑的 View Transition
    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    try { history.replaceState({ fc: 1, url: location.href, scroll: 0 }, ''); } catch (e) { /* 忽略 */ }

    /* --------------------------------------------------------- 链接判定 */
    function target(a, isClick, e) {
        if (!a) { return null; }
        if (isClick && (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) { return null; }
        if (a.target && a.target !== '_self') { return null; }
        if (a.hasAttribute('download') || a.hasAttribute('data-no-pjax')) { return null; }
        var raw = a.getAttribute('href') || '';
        if (!raw || raw.charAt(0) === '#') { return null; }
        if (/^(mailto:|tel:|javascript:|data:)/i.test(raw)) { return null; }
        var url;
        try { url = new URL(a.href, location.href); } catch (err) { return null; }
        if (url.origin !== location.origin) { return null; }
        if (url.pathname === location.pathname && url.search === location.search) { return null; }
        if (SKIP_PATH.test(url.pathname)) { return null; }
        return url;
    }

    function anchorFrom(e) {
        return e.target && e.target.closest ? e.target.closest('a[href]') : null;
    }

    /* ------------------------------------------------------------ 预取 */
    function remember(url, html) {
        cache.delete(url);   // 先删再插 → 变成"最近使用"
        cache.set(url, html);
        while (cache.size > CACHE_MAX) {
            cache.delete(cache.keys().next().value);   // 淘汰最久未用的
        }
    }

    function prefetch(href) {
        if (!href || cache.has(href) || warming[href]) { return; }
        warming[href] = true;
        fetch(href, { credentials: 'same-origin', headers: { 'X-PJAX-Prefetch': '1' } })
            .then(function (res) {
                if (!res.ok || res.redirected) { return null; }                     // 重定向了就别缓存
                if (/no-store/i.test(res.headers.get('cache-control') || '')) { return null; }
                return res.text();
            })
            .then(function (html) { if (html) { remember(href, html); } })
            .catch(function () { /* 预取失败：静默忽略，绝不打扰用户 */ })
            .then(function () { delete warming[href]; });
    }

    document.addEventListener('mouseover', function (e) {
        var url = target(anchorFrom(e), false, e);
        if (!url) { return; }
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { prefetch(url.href); }, HOVER_DELAY);
    }, false);

    document.addEventListener('mouseout', function () { clearTimeout(hoverTimer); }, false);

    document.addEventListener('focusin', function (e) {
        var url = target(anchorFrom(e), false, e);
        if (url) { prefetch(url.href); }
    }, false);

    document.addEventListener('touchstart', function (e) {
        var url = target(anchorFrom(e), false, e);
        if (url) { prefetch(url.href); }
    }, { passive: true });

    /* ------------------------------------------------------------ 点击 */
    document.addEventListener('click', function (e) {
        var url = target(anchorFrom(e), true, e);
        if (!url) { return; }
        e.preventDefault();
        clearTimeout(hoverTimer);
        go(url.href, 'push', 0);
    }, false);

    /* ------------------------------------------------------- 前进 / 后退 */
    window.addEventListener('popstate', function (e) {
        var st = e.state || {};
        var href = st.url || location.href;
        var url;
        try { url = new URL(href, location.href); } catch (err) { return; }
        if (SKIP_PATH.test(url.pathname)) { return; }
        go(href, 'pop', typeof st.scroll === 'number' ? st.scroll : 0);
    });

    /* ------------------------------------------------------------ 取页面 */
    function go(href, mode, scroll) {
        var cached = cache.get(href);
        if (cached) {                     // 预取命中：直接渲染，不等网络
            cache.delete(href);           // 用过即作废（页面可能已变化）
            render(cached, href, mode, scroll);
            return;
        }

        if (inflight && inflight.abort) { inflight.abort(); }
        inflight = window.AbortController ? new AbortController() : null;
        var init = { credentials: 'same-origin', headers: { 'X-PJAX': '1' } };
        if (inflight) { init.signal = inflight.signal; }
        var timer = setTimeout(function () { if (inflight) { inflight.abort(); } }, TIMEOUT);

        fetch(href, init).then(function (res) {
            if (!res.ok) { throw new Error('HTTP ' + res.status); }
            return res.text();
        }).then(function (html) {
            clearTimeout(timer);
            render(html, href, mode, scroll);
        }).catch(function () {
            clearTimeout(timer);
            if (mode === 'push') { location.href = href; }   // 正常跳转，绝不让链接点不动
            else { location.reload(); }
        });
    }

    /* --------------------------------------------------------- 渲染 / 替换 */
    function render(html, href, mode, scroll) {
        var doc, fresh;
        try {
            doc = new DOMParser().parseFromString(html, 'text/html');
            fresh = doc.querySelector(CONTENT);
        } catch (err) { doc = null; }
        if (!doc || !fresh) {
            if (mode === 'push') { location.href = href; } else { location.reload(); }
            return;
        }

        var update = function () {
            rememberScroll();
            content.innerHTML = fresh.innerHTML;   // 只换内容区
            if (doc.title) { document.title = doc.title; }
            syncNav(doc);
            syncBody(doc);
            mergeHead(doc);
            refreshCopyButtons();
            if (window.fcMusic && window.fcMusic.refresh) {
                try { window.fcMusic.refresh(); } catch (err) { /* 播放器自己兜底 */ }
            }
            if (mode === 'push') {
                try { history.pushState({ fc: 1, url: href, scroll: 0 }, '', href); } catch (err) { /* 忽略 */ }
                window.scrollTo(0, 0);
            } else {
                window.scrollTo(0, scroll || 0);
            }
        };

        // 只有两边都有 .fc-layout 时才做内容区动画（否则命名元素只出现在一侧，
        // 会出现"旧内容糊在新页面上"的观感，不如直接换）
        var canAnimate = !!document.startViewTransition && !(reduce && reduce.matches) && !activeVT
            && content.querySelector('.fc-layout') && fresh.querySelector('.fc-layout');

        if (canAnimate) {
            try {
                var vt = document.startViewTransition(update);
                activeVT = vt;
                var done = function () { activeVT = null; };
                if (vt && vt.finished && vt.finished.then) { vt.finished.then(done, done); }
                else { activeVT = null; }
                return;
            } catch (err) {
                activeVT = null;   // 起不来就当没这回事，下面直接换
            }
        }

        update();
        animate();   // 不支持 View Transitions 的浏览器：退化成轻微淡入
    }

    function rememberScroll() {
        try {
            var st = history.state || {};
            st.fc = 1;
            st.url = location.href;
            st.scroll = window.scrollY || 0;
            history.replaceState(st, '');
        } catch (err) { /* 忽略 */ }
    }

    /* 顶部 Segmented 导航高亮：从新文档里照抄 class / aria-current */
    function syncNav(doc) {
        var fresh = doc.querySelectorAll('#menu [href]');
        var mine = document.querySelectorAll('#menu [href]');
        if (!fresh.length || fresh.length !== mine.length) { return; }
        for (var i = 0; i < mine.length; i++) {
            var on = fresh[i].classList.contains('active');
            mine[i].classList.toggle('active', on);
            if (on) { mine[i].setAttribute('aria-current', 'page'); }
            else { mine[i].removeAttribute('aria-current'); }
        }
    }

    /* body 的类跟着新页面走（body.list 影响主题样式），但保留运行时加的类 */
    function syncBody(doc) {
        var keep = ['fc-has-mini'];
        var kept = keep.filter(function (c) { return document.body.classList.contains(c); });
        document.body.className = (doc.body.className || '') + (kept.length ? ' ' + kept.join(' ') : '');
    }

    /* 页面专属的 head 资源按需补进来 */
    function mergeHead(doc) {
        var sel = 'script[src], link[rel="stylesheet"]';
        var have = {};
        [].forEach.call(document.head.querySelectorAll(sel), function (n) {
            have[n.getAttribute('src') || n.getAttribute('href')] = 1;
        });
        [].forEach.call(doc.head.querySelectorAll(sel), function (n) {
            var url = n.getAttribute('src') || n.getAttribute('href');
            if (!url || have[url]) { return; }
            have[url] = 1;
            document.head.appendChild(n.cloneNode(true));
        });
    }

    /* 主题的「复制代码」按钮只在首次加载时创建一次，pjax 换页后新内容里的代码块
       就没有按钮了。这里用同样的类名和位置补一遍（文案沿用主题的中文 i18n），
       已经有按钮的块直接跳过，所以不会重复。 */
    function refreshCopyButtons() {
        var codes = content.querySelectorAll('pre > code');
        if (!codes.length) { return; }
        [].forEach.call(codes, function (code) {
            var pre = code.parentNode;
            var host = (pre.parentNode && pre.parentNode.classList.contains('highlight')) ? pre.parentNode : pre;
            if (host.querySelector('.copy-code')) { return; }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'copy-code';
            btn.textContent = '复制';
            btn.addEventListener('click', function () {
                var done = function () {
                    btn.textContent = '已复制！';
                    setTimeout(function () { btn.textContent = '复制'; }, 2000);
                };
                if (navigator.clipboard) { navigator.clipboard.writeText(code.textContent); done(); return; }
                var range = document.createRange();
                range.selectNodeContents(code);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                try { document.execCommand('copy'); done(); } catch (e) { /* 忽略 */ }
                sel.removeRange(range);
            });
            host.appendChild(btn);
        });
    }

    function animate() {
        if (reduce && reduce.matches) { return; }   // 尊重「减少动态效果」
        content.classList.remove('fc-swap-in');
        void content.offsetWidth;
        content.classList.add('fc-swap-in');
    }

    /* 给主题切换脚本用：圆形扩散要盖住整页，但内容区与迷你播放条带
       view-transition-name 时会画在 root 之上、盖不住，所以扩散前临时摘掉。 */
    window.fcViewNames = {
        clear: function () {
            var layout = content.querySelector('.fc-layout');
            if (layout) { layout.style.viewTransitionName = 'none'; }
            var mini = document.getElementById('fc-mini');
            if (mini) { mini.style.viewTransitionName = 'none'; }
        },
        restore: function () {
            var layout = content.querySelector('.fc-layout');
            if (layout) { layout.style.viewTransitionName = ''; }
            var mini = document.getElementById('fc-mini');
            if (mini) { mini.style.viewTransitionName = ''; }
        }
    };
})();
