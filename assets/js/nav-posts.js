/* ============================================================================
 * 左栏「文章」折叠组：点标题行开合，展开后只铺「最近 N 篇」
 * ----------------------------------------------------------------------------
 * 模板（layouts/_partials/site_nav.html）已经把结构、默认状态、最近 N 篇、
 * 「查看全部文章 →」和「当前文章钉一条」全部渲染好了，这个脚本只负责三件事：
 *
 *   1) 开合：点 <button.fc-nav-toggle> 切换 aria-expanded / hidden，
 *      并给面板做一次高度过渡（0 → scrollHeight，过渡结束再回到 auto，
 *      这样面板里内容以后变高也不会被写死的像素值切掉）。
 *      <button> 天然支持 Enter / Space，不需要另写键盘处理。
 *
 *   2) 记住访客这一次浏览里的选择：同一个闭包变量，pjax 换页也不丢；
 *      但**当前文章必须可见**这条优先 —— 模板在文章页 / /posts/ 上写了
 *      data-fc-default-open="1"，那种页面一律强制展开，不管他之前收没收起。
 *      不写 localStorage（沿用站点约定：不跨会话记忆）。
 *
 *   3) pjax 兼容：pjax 只替换 main.main 的内容（左栏在里面，会被换掉），
 *      所以这里用**事件委托**绑在 document 上（只绑一次，不会随换页叠加），
 *      再用 MutationObserver 盯 main.main 的直接子节点变化 —— 那正好是 pjax
 *      换页完成的信号 —— 把访客的选择重新套到新 DOM 上。
 *      脚本本身在 main.main 之外（extend_footer.html），永远只跑一次。
 *
 * 不重复挂载：这里**从不创建/克隆任何节点**，列表与按钮都是模板渲染的，
 * 换页时整块被替换，所以切多少次页都只有一套。幂等守卫见 data-fc-navposts。
 * ========================================================================== */
(function () {
    'use strict';

    var HOST = '[data-fc-nav-posts]';
    var SETTLE = 340;   // 比 CSS 里的过渡（260ms）多留一点余量

    var content = document.querySelector('main.main');
    if (!content) { return; }

    var doc = document.documentElement;
    if (doc.getAttribute('data-fc-navposts') === '1') { return; }   // 幂等
    doc.setAttribute('data-fc-navposts', '1');

    /* null = 还没手动开合过 → 听模板的默认（文章页 / /posts/ 展开、别处收起） */
    var choice = null;
    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    function parts(host) {
        var btn = host.querySelector('.fc-nav-toggle');
        var panel = host.querySelector('.fc-nav-panel');
        return (btn && panel) ? { btn: btn, panel: panel } : null;
    }

    /* 「该展开还是收起」的唯一判定，顺序不能调换：
         ① 模板标了 data-fc-default-open="1"（文章页 / /posts/）→ **一律展开**，
            压过访客的手动开合。看着像 bug（「我明明收起来了，怎么又开了」），
            其实是刻意的：那一页的正文就是文章，把当前文章藏进折叠里更糟。
         ② 否则才轮到 choice —— null 表示访客还没手动开合过，听模板的默认（收起）。 */
    function want(host) {
        if (host.getAttribute('data-fc-default-open') === '1') { return true; }
        return choice === null ? false : choice;
    }

    /* 已经处于目标状态就别再动它 —— sync() 会被反复调用（切页、其它 DOM 变化），
       否则正在播的过渡会被打断 */
    function settled(host, p, open) {
        return host.getAttribute('data-fc-ready') === '1'
            && host.classList.contains('is-open') === open
            && p.btn.getAttribute('aria-expanded') === (open ? 'true' : 'false')
            && p.panel.hidden === !open;
    }

    function apply(host, open, animate) {
        var p = parts(host);
        if (!p) { return; }
        host.setAttribute('data-fc-ready', '1');
        host.classList.toggle('is-open', open);
        p.btn.setAttribute('aria-expanded', open ? 'true' : 'false');

        /* 快速连点时，只有最后一次的收尾回调允许生效 */
        var token = (host.__fcNavPostsToken || 0) + 1;
        host.__fcNavPostsToken = token;

        /* 收起时如果焦点还在面板里（键盘用户），收完会把焦点丢到 body —— 挪回按钮上 */
        if (!open && p.panel.contains(document.activeElement)) {
            try { p.btn.focus(); } catch (err) { /* 忽略 */ }
        }

        if (!animate || (reduce && reduce.matches)) {
            p.panel.style.height = '';
            p.panel.hidden = !open;
            return;
        }

        var target;
        if (open) {
            p.panel.style.height = '';       // 先回到 auto，量出真实高度
            p.panel.hidden = false;
            target = p.panel.scrollHeight;
            if (!target) { p.panel.style.height = ''; return; }   // 面板是空的：不必过渡
            p.panel.style.height = '0px';
            void p.panel.offsetHeight;       // 强制一次布局，让 0px 真正落地
            p.panel.style.height = target + 'px';
        } else {
            target = p.panel.scrollHeight;
            p.panel.style.height = target + 'px';
            void p.panel.offsetHeight;
            p.panel.style.height = '0px';
        }

        setTimeout(function () {
            if (host.__fcNavPostsToken !== token) { return; }   // 已被更新的开合取代
            p.panel.style.height = '';                          // open: 回到 auto
            if (!open) { p.panel.hidden = true; }
        }, SETTLE);
    }

    function host() {
        var el = content.querySelector(HOST);
        return (el && el.querySelector('.fc-nav-toggle')) ? el : null;
    }

    /* 把「该是什么状态」套到当前 DOM 上（切页后 / 首次进场都走这里） */
    function sync() {
        var el = host();
        if (!el) { return; }
        var p = parts(el);
        if (!p) { return; }
        var open = want(el);
        if (settled(el, p, open)) { return; }
        apply(el, open, false);
    }

    /* 事件委托：绑一次，pjax 换掉左栏也照样有效 */
    document.addEventListener('click', function (e) {
        var t = e.target;
        var btn = (t && t.closest) ? t.closest('.fc-nav-toggle') : null;
        if (!btn) { return; }
        var el = btn.closest(HOST);
        if (!el || !content.contains(el)) { return; }
        var open = btn.getAttribute('aria-expanded') !== 'true';
        choice = open;                      // 记住访客这次的选择（同一次浏览内有效）
        apply(el, open, true);
    }, false);

    /* pjax 换页的信号：它把 main.main 的 innerHTML 整个换掉，直接子节点必然变动。
       这里用同步回调（不排 rAF）：view transition 的新快照就在这次微任务之后拍，
       状态得赶在快照前套好，否则新页面会先闪一下「收起」再弹开。 */
    if (window.MutationObserver) {
        new MutationObserver(sync).observe(content, { childList: true });
    }

    sync();
})();
