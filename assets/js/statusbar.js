/* ============================================================================
   页脚状态栏：北京时间时钟 + 本站已稳定运行 + 技术栈徽章 —— 原生实现，零依赖
   ----------------------------------------------------------------------------
   · 只有一个 setInterval(1000)，同时驱动时钟与运行时间（不额外开定时器）
   · 页面不可见时清掉定时器，回到前台立即刷新一次再重新计时（不在后台空转）
   · 幂等：start() 一律先 clear 旧的再建新的；脚本被重复执行时走
     window.fcStatusbar.start() 分支，不会出现第二个定时器
   · pjax 只替换 main.main，页脚属于常驻区域，所以切页时这个脚本不会被重跑，
     时钟自然不重置、不闪
   · 时钟固定北京时间（Asia/Shanghai，UTC+8），不跟随访客本地时区；
     起始日期来自 hugo.toml 的 params.siteLaunchDate（读 data-since 属性）
   ========================================================================== */
(function () {
    'use strict';

    var bar = document.getElementById('fc-statusbar');
    if (!bar) { return; }

    var clockEl = document.getElementById('fc-statusbar-clock');
    var uptimeEl = document.getElementById('fc-statusbar-uptime');
    if (!clockEl || !uptimeEl) { return; }

    // 已经初始化过了（脚本被重复执行）：只重置定时器，绝不建第二个
    if (window.fcStatusbar && typeof window.fcStatusbar.start === 'function') {
        window.fcStatusbar.start();
        return;
    }

    // 起始时间：hugo.toml 的 params.siteLaunchDate，按北京时间当天 00:00 算
    var raw = bar.getAttribute('data-since') || '2026-09-30';
    var since = Date.parse(raw + 'T00:00:00+08:00');
    if (isNaN(since)) { since = Date.now(); }

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    // 北京时间：交给 Intl 按时区算，和访客本机时区无关
    var fmt = null;
    try {
        fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Shanghai', hour12: false,
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch (e) { fmt = null; }

    function clockText(d) {
        if (fmt) { return fmt.format(d); }
        // 极端降级：手动按 UTC+8 换算
        var t = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
        return pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());
    }

    function uptimeText(ms) {
        var mins = Math.floor(ms / 60000);
        if (mins < 60) { return '本站已稳定运行：' + mins + '分钟'; }
        var hours = Math.floor(mins / 60);
        if (hours < 8760) {                       // 不足 365 天：X天X小时
            return '本站已稳定运行：' + Math.floor(hours / 24) + '天' + (hours % 24) + '小时';
        }
        var years = Math.floor(hours / 8760);     // 超过 365 天：X年X天
        return '本站已稳定运行：' + years + '年' + Math.floor((hours % 8760) / 24) + '天';
    }

    function tick() {
        var d = new Date();
        clockEl.textContent = clockText(d);
        uptimeEl.textContent = uptimeText(Math.max(0, d.getTime() - since));
    }

    var timer = null;

    function stop() {
        if (timer !== null) {
            window.clearInterval(timer);
            timer = null;
        }
    }

    function start() {
        stop();                 // 幂等的关键：先清旧的再建新的
        tick();                 // 立即刷新一次，回前台不用等满 1 秒
        timer = window.setInterval(tick, 1000);
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stop(); } else { start(); }
    });

    if (document.hidden) { tick(); } else { start(); }

    // 暴露一个幂等入口：万一有代码重复执行到这里，或多个模块想重置定时器
    window.fcStatusbar = { start: start, stop: stop };
})();
