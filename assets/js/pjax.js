/* ============================================================================
   局部无刷新导航（pjax 式）—— 换页面时音乐不中断
   ----------------------------------------------------------------------------
   只做一件事：点站内链接时用 fetch + DOMParser 取回目标页面，只替换
   <main class="main">（内容区，含 .fc-layout / 左导航 / 右侧栏 / 播放器大卡），
   再同步 <title>、顶部导航高亮、body 的类、以及页面专属的 head 资源。

   为什么音频不会断：
     · <audio> 是 music-player.js 用 new Audio() 持有的，根本不在 DOM 里；
     · 迷你播放条、播放列表数据在 footer（内容区之外），永远不被替换；
     · 换完内容调用 window.fcMusic.refresh()，播放器重新查询 DOM、把当前
       状态（歌名/歌手/进度/播放/音量/歌词）画到新界面上，音频一直连着放。

   降级（最重要的一条：任何情况都不能把站点搞坏）：
     · 缺 fetch / DOMParser / pushState → 整个脚本不启用，退化成普通多页站点
     · fetch 失败 / 超时 / 目标页结构不对 → location.href 正常跳转
     · 外链、target=_blank、download、data-no-pjax、纯 #hash、mailto: → 一律不拦
     · /search/ 不拦：主题的搜索脚本绑在 window load 上，无刷新换内容后不会
       重新初始化，这一页交给浏览器正常跳转最稳（只此一页有约半秒空档）
     · 后退/前进时 fetch 失败 → location.reload() 兜底，保证内容和地址栏一致
   ========================================================================== */
(function () {
    'use strict';

    if (!window.fetch || !window.DOMParser || !window.history || !history.pushState) { return; }

    var CONTENT = 'main.main';
    var content = document.querySelector(CONTENT);
    if (!content) { return; }

    var SKIP_PATH = /\/search\/?$/;
    var TIMEOUT = 10000;
    var inflight = null;
    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    // 记下初始 state，前进/后退时才有滚动位置可恢复
    try { history.replaceState({ fc: 1, url: location.href, scroll: 0 }, ''); } catch (e) { /* 忽略 */ }

    /* ------------------------------------------------------------ 点击拦截 */
    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) { return; }
        if (a.target && a.target !== '_self') { return; }
        if (a.hasAttribute('download') || a.hasAttribute('data-no-pjax')) { return; }
        var raw = a.getAttribute('href') || '';
        if (!raw || raw.charAt(0) === '#') { return; }
        if (/^(mailto:|tel:|javascript:|data:)/i.test(raw)) { return; }

        var url;
        try { url = new URL(a.href, location.href); } catch (err) { return; }
        if (url.origin !== location.origin) { return; }
        if (url.pathname === location.pathname && url.search === location.search) { return; } // 同页
        if (SKIP_PATH.test(url.pathname)) { return; }

        e.preventDefault();
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

    /* ------------------------------------------------------------- 取页面 */
    function go(href, mode, scroll) {
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
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var fresh = doc.querySelector(CONTENT);
            if (!fresh) { throw new Error('no content area'); }
            apply(doc, fresh, href, mode, scroll);
        }).catch(function () {
            clearTimeout(timer);
            if (mode === 'push') { location.href = href; }   // 正常跳转，绝不让链接点不动
            else { location.reload(); }                       // 后退失败：让地址栏和内容重新对上
        });
    }

    /* --------------------------------------------------------------- 替换 */
    function apply(doc, fresh, href, mode, scroll) {
        rememberScroll();
        content.innerHTML = fresh.innerHTML;   // 只换内容区
        if (doc.title) { document.title = doc.title; }
        syncNav(doc);
        syncBody(doc);
        mergeHead(doc);
        refreshCopyButtons();

        // 播放器视图重建（音频不在这里，完全不受影响）
        if (window.fcMusic && window.fcMusic.refresh) {
            try { window.fcMusic.refresh(); } catch (err) { /* 播放器自己兜底 */ }
        }

        if (mode === 'push') {
            try { history.pushState({ fc: 1, url: href, scroll: 0 }, '', href); } catch (err) { /* 忽略 */ }
            window.scrollTo(0, 0);
        } else {
            window.scrollTo(0, scroll || 0);
        }
        animate();
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

    /* 页面专属的 head 资源按需补进来（目前只有搜索页的脚本会用到） */
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
})();
