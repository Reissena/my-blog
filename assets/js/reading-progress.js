/* ============================================================================
   阅读进度条 —— 只在文章页出现，零依赖
   ----------------------------------------------------------------------------
   · **元素由模板决定要不要渲染**（layouts/single.html 里 `.Section == "posts"`
     才输出 #fc-progress），所以「首页 / 列表页 / 技能页 / 音乐页不显示」这件事
     在 HTML 层面就成立了，不靠脚本去猜「这是不是文章页」—— 脚本这里只负责
     推进度，它找不到元素就什么都不干。
   · 脚本**不能**在「找不到元素」时提前 return：访客可能是从首页 pjax 切进
     文章的，那时候元素才刚被插进来。所以用 MutationObserver 盯 main.main
     （pjax 换页就是它的 childList 变动，与 nav-posts.js 同一套路）重新找元素。
   · 位置：粘在**粘性页头的下沿**（top: var(--fc-header-h)），z-index 49 —— 
     比页头的 50 低一层，所以**任何情况下都不可能盖住导航**（页头量矮了、
     在中间宽度折了行，最坏也只是被页头压住一点，不会反过来挡导航的点击）。
     没有放页面底部：底部已经被迷你播放条占了（≤768px 时它是 left/right 12px
     的贴底通栏，z-index 60），左下角还有清晰度滑块与樱花开关。
   · 节流：scroll 只负责「预约一帧」，真正的计算在 requestAnimationFrame 里做，
     所以一次滚动最多算一次，滚动过程中不会每个事件都去读 scrollHeight（那会
     触发强制重排）。resize 同样走这一条路。
   · 页头高度：≤880px 时页头会折成两行（站名一行 + 导航滑轨一行），高度变了，
     所以尺寸是**量出来的**（ResizeObserver，退化成 resize 事件），不是写死的；
     CSS 里的 55px 只是「脚本还没跑到」时的兜底。
   · **pjax 换页必须重置**：#fc-progress 在 main.main 里，pjax 换页时整块被换掉，
     新元素是新的 DOM、内联 transform 本来就是空的；这里仍显式清一次 0，双保险。
   · 尊重 prefers-reduced-motion：CSS 里那条 transform 过渡会被 media query 关掉，
     进度条变成「跟手即时到位」（不做动画本身也就是减少动效的写法）。
   ========================================================================== */
(function () {
    'use strict';

    var root = document.documentElement;

    /* 幂等守卫（沿用站内 data-fc-ready 那一套）：脚本被重复加载也不会绑出第二套 */
    if (root.getAttribute('data-fc-progress') === '1') { return; }
    /* CSS 靠这个属性决定显示进度条：没有 JS 时它不出现，也就不会留一根 0% 的空条 */
    root.setAttribute('data-fc-progress', '1');

    var content = document.querySelector('main.main');
    var header = document.querySelector('.header');
    var bar = null;      // 当前这一页的进度条元素（非文章页是 null）
    var fill = null;     // 里面那条填充
    var frame = 0;       // rAF 句柄，0 = 本帧还没预约

    function syncHeader() {
        if (!header) { header = document.querySelector('.header'); }
        if (!header) { return; }
        var h = header.getBoundingClientRect().height;
        if (h > 0) {
            root.style.setProperty('--fc-header-h', (Math.round(h * 100) / 100) + 'px');
        }
    }

    function paint() {
        frame = 0;
        if (!fill) { return; }
        var max = root.scrollHeight - window.innerHeight;
        var y = window.scrollY || root.scrollTop || 0;
        /* 除零守卫：整篇一屏就看完了（max<=0）时按 100% 算 —— 文章确实全在眼前，
           显示 0% 反倒像在说「你还没开始读」。
           实测：本站因为 body 有 min-height:100vh、页脚下面还有状态栏，
           正常页面在任何视口下都还有约 154px 可滚，所以这条**平时走不到**，
           它的实际作用是「别让 0 做出除法」。 */
        var p = max > 0 ? (y / max) : 1;
        if (!(p >= 0)) { p = 0; }          // NaN 兜底（滚动高度拿不到时）
        if (p > 1) { p = 1; }
        var pct = Math.round(p * 1000) / 10;
        /* 写 transform 而不是 width：width 每帧都会触发重排（布局→重绘→合成），
           scaleX 只走合成那一步。⚠️ 和 fluent.css 的 `.fc-progress-fill` 是**一对**：
           那边宽度是死的 100%、进度靠 scaleX 表达，这边要是还写 width，
           就会把元素缩成 0 宽，进度条直接消失 —— 改一边必须改两边。 */
        fill.style.transform = 'scaleX(' + (pct / 100) + ')';
        /* 声明了 role="progressbar" 就得自己同步 aria-valuenow，否则读屏报旧值
           （与左下角清晰度滑块同一条约定） */
        if (bar) { bar.setAttribute('aria-valuenow', String(Math.round(pct))); }
    }

    function schedule() {
        if (frame) { return; }
        frame = window.requestAnimationFrame(paint);
    }

    /* 重新找元素 + 把状态对齐当前页面。首次进场、每次 pjax 换页、窗口变化都走这里 */
    function sync() {
        var next = document.getElementById('fc-progress');
        if (next !== bar) {
            bar = next;
            fill = bar ? bar.querySelector('.fc-progress-fill') : null;
            /* pjax 刚换完页：从 A 文章切到 B 文章时，绝不能停在 A 的进度上 */
            if (fill) { fill.style.transform = 'scaleX(0)'; }
            if (bar) { bar.setAttribute('aria-valuenow', '0'); }
        }
        syncHeader();
        schedule();
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', sync, { passive: true });

    if (window.MutationObserver && content) {
        new MutationObserver(sync).observe(content, { childList: true });
    }

    /* 页头高度用 ResizeObserver 盯（折行 / 字体加载 / 转屏都会让它变），
       没有它就退回 resize 事件 —— 上面已经绑了，不至于量不到高度 */
    if (window.ResizeObserver && header) {
        try {
            new ResizeObserver(function () { syncHeader(); schedule(); }).observe(header);
        } catch (e) { /* 观察不了也不影响：resize 那条路还在 */ }
    }

    sync();
})();
