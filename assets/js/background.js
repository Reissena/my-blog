/* ============================================================================
   背景图定时轮换 —— 两层交叉淡入（原生实现，零依赖）
   ----------------------------------------------------------------------------
   结构：#fc-bg 里两层 .fc-bg-layer（z-index -2，在可读性遮罩 body::after 的
   -1 之下、内容之下）。body::before 依旧保留着首屏那张 background.jpg ——
   JS 没跑到、跑得慢、或图片还没下载完，看到的都和以前完全一样，不会空白也不会闪。

   切换：每 30 秒把下一张放进当前隐藏的那层 → 确认它已经加载好 → 淡入 900ms
   → 交换角色。因为新图在淡入开始前就已经在浏览器缓存里（先预加载 + 每次切换前
   再确认一次 onload），所以全程无闪烁；加载失败就静默跳过这一张。

   起始索引每次访问都随机；顺序按注入的数组循环（background.jpg 也参与轮换）。

   图片 URL 不写死在 JS 里：由 Hugo 资源管线注入到 #fc-bg-data 的 JSON
   （assets/images/background.jpg + assets/images/bg/* 自动收集，加图只要丢进目录）。
   ========================================================================== */
(function () {
    'use strict';

    var box = document.getElementById('fc-bg');
    var data = document.getElementById('fc-bg-data');
    if (!box || !data) { return; }

    var images = [];
    try { images = JSON.parse(data.textContent) || []; } catch (e) { return; }
    if (images.length < 2) { return; }                     // 只有一张就不折腾

    var layers = [document.getElementById('fc-bg-a'), document.getElementById('fc-bg-b')];
    if (!layers[0] || !layers[1]) { return; }

    var INTERVAL = 30000;         // 每 30 秒换一张
    var idx = Math.floor(Math.random() * images.length);   // 起始索引随机
    var active = 0;               // 当前显示的是哪一层
    var timer = null;
    var ready = {};               // src -> 已加载

    function whenReady(src, cb) {
        if (!src) { return; }
        if (ready[src]) { cb(); return; }
        var img = new Image();
        img.onload = function () { ready[src] = 1; cb(); };
        img.onerror = function () { ready[src] = 1; cb(); };   // 失败也往下走，静默忽略
        img.src = src;
    }

    function show(src) {
        var next = layers[1 - active];
        next.style.backgroundImage = 'url("' + src + '")';
        void next.offsetWidth;        // 让新图先落定，再触发 opacity 过渡，避免淡到一半才出现
        next.classList.add('is-on');
        layers[active].classList.remove('is-on');
        active = 1 - active;
    }

    function tick() {
        idx = (idx + 1) % images.length;
        var src = images[idx];
        whenReady(src, function () { show(src); });     // 确认加载好才切
    }

    function stopTimer() {
        if (timer) { window.clearInterval(timer); timer = null; }
    }

    function startTimer() {
        stopTimer();
        timer = window.setInterval(tick, INTERVAL);
    }

    // JS 接管：显示随机起始图（同样是一次淡入，所以不会闪）
    whenReady(images[idx], function () {
        show(images[idx]);
        if (!document.hidden) { startTimer(); }
    });

    // 空闲时把其余几张预加载好，轮换时就不用等网络
    function preloadRest() {
        for (var i = 0; i < images.length; i++) {
            if (i !== idx) { whenReady(images[i], function () { }); }
        }
    }
    if (window.requestIdleCallback) {
        window.requestIdleCallback(preloadRest, { timeout: 3000 });
    } else {
        window.addEventListener('load', function () { window.setTimeout(preloadRest, 600); });
    }

    // 页面不可见就停掉（别在后台标签页里白换图），回来重新计时
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stopTimer(); }
        else { startTimer(); }
    });
})();
