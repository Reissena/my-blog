/* ============================================================================
   樱花飘落 —— 全屏 canvas 氛围层（原生实现，零依赖）
   ----------------------------------------------------------------------------
   启动条件（重要）：只有「非 prefers-reduced-motion: reduce」时才创建 canvas
   与开关按钮；开启减少动效时这个脚本直接返回，连 canvas 都不会被创建。

   与 pjax / View Transitions 的关系：
     · canvas 与开关按钮都挂在 <body> 上（内容区 main.main 之外），pjax 只替换
       内容区，所以切页时它们不重建、不闪；rAF 也不会被打断
     · canvas 刻意不加 view-transition-name，不参与切页过渡动画
       （过渡期间它是 root 快照的一部分，240ms 后自然恢复，不会有独立动效）

   性能：
     · 花瓣数按视口宽度自适应（手机 14 / 平板 24 / 桌面 34–40）
     · devicePixelRatio 封顶 2；花瓣是预渲染好的精灵图，每帧只做 drawImage
     · 页面切到后台（visibilitychange → hidden）停掉 rAF，回来再继续
     · resize 节流 180ms

   开关：
     · 左下角小樱花按钮（内联 SVG），点击切开关；状态存 localStorage，默认开
     · 关闭 = 停 rAF + 清空画布（不是单纯隐藏）
   ========================================================================== */
(function () {
    'use strict';

    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (reduce && reduce.matches) { return; }          // 开启减少动效：完全不启动

    var STORE_KEY = 'fc-sakura';
    var DPR_MAX = 2;
    var SPRITE = 64;                                   // 精灵图边长（设备像素）

    /* 花瓣配色：从 CSS 变量读（fluent.css 第 13 节的 --fc-sakura-1..4），
       颜色统一在主题层维护，JS 不再硬编码色值；万一读不到就用下面这份兜底
       （同一粉色系，深色模式另有一套，见那条 [data-theme="dark"] 规则）。 */
    var VAR_NAMES = ['--fc-sakura-1', '--fc-sakura-2', '--fc-sakura-3', '--fc-sakura-4'];
    var FALLBACK = [[255, 199, 214], [253, 221, 231], [247, 168, 192], [254, 233, 239]];

    function readColors() {
        var cs = window.getComputedStyle ? window.getComputedStyle(document.documentElement) : null;
        var out = [];
        for (var i = 0; i < VAR_NAMES.length; i++) {
            var parts = cs ? String(cs.getPropertyValue(VAR_NAMES[i])).trim().split(/[\s,]+/) : [];
            if (parts.length >= 3 && parts[0] !== '') {
                out.push([parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, parseInt(parts[2], 10) || 0]);
            } else {
                out.push(FALLBACK[i]);
            }
        }
        return out;
    }

    var ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<ellipse cx="12" cy="6.6" rx="3" ry="4.2"/>' +
        '<ellipse cx="12" cy="6.6" rx="3" ry="4.2" transform="rotate(72 12 12)"/>' +
        '<ellipse cx="12" cy="6.6" rx="3" ry="4.2" transform="rotate(144 12 12)"/>' +
        '<ellipse cx="12" cy="6.6" rx="3" ry="4.2" transform="rotate(216 12 12)"/>' +
        '<ellipse cx="12" cy="6.6" rx="3" ry="4.2" transform="rotate(288 12 12)"/>' +
        '<circle cx="12" cy="12" r="1.6" fill="#fff" opacity=".75"/>' +
        '</svg>';

    /* ------------------------------------------------------- 花瓣精灵（3 种形状 × 4 种颜色）*/
    function makeSprite(shape, color) {
        var c = document.createElement('canvas');
        c.width = c.height = SPRITE;
        var g = c.getContext('2d');
        g.translate(SPRITE / 2, SPRITE / 2);
        var r = SPRITE * 0.40;
        g.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
        g.beginPath();
        if (shape === 0) {                       // 纯椭圆
            g.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
        } else if (shape === 1) {                // 带缺口的花瓣形
            g.moveTo(0, r);
            g.quadraticCurveTo(r * 1.08, r * 0.15, r * 0.32, -r * 0.9);
            g.quadraticCurveTo(0, -r * 0.5, -r * 0.32, -r * 0.9);   // 顶部小缺口
            g.quadraticCurveTo(-r * 1.08, r * 0.15, 0, r);
        } else {                                 // 心形花瓣
            g.moveTo(0, r * 0.95);
            g.bezierCurveTo(r * 1.2, -r * 0.2, r * 0.5, -r * 1.05, 0, -r * 0.4);
            g.bezierCurveTo(-r * 0.5, -r * 1.05, -r * 1.2, -r * 0.2, 0, r * 0.95);
        }
        g.closePath();
        g.fill();
        return c;
    }

    var SPRITES = [];
    function buildSprites() {
        var colors = readColors();
        SPRITES = [];
        for (var shape = 0; shape < 3; shape++) {
            for (var i = 0; i < colors.length; i++) { SPRITES.push(makeSprite(shape, colors[i])); }
        }
    }
    buildSprites();

    // 主题切换后按新主题的变量重建精灵图（深浅两套粉色略有差别）；
    // 数量固定 3×4，所以已经飞着的花瓣用旧索引照样取得到，不会出错
    if (window.MutationObserver) {
        new MutationObserver(buildSprites).observe(document.documentElement, {
            attributes: true, attributeFilter: ['data-theme']
        });
    }

    /* --------------------------------------------------------------- 视图状态 */
    var view = { w: 0, h: 0, dpr: 1, ctx: null, wind: 5 };
    var petals = [];
    var raf = 0;
    var running = false;
    var last = 0;
    var enabled = true;
    var canvas = null;
    var btn = null;

    function countFor(w) {
        if (w < 600) { return 14; }      // 手机：12–18
        if (w < 1024) { return 24; }     // 平板
        if (w < 1600) { return 34; }     // 小桌面
        return 40;                       // 大屏：30–40
    }

    function resetPetal(p, atTop) {
        var w = view.w;
        var h = view.h;
        p.baseX = Math.random() * w;
        p.x = p.baseX;
        p.y = atTop ? (-20 - Math.random() * h * 0.4) : (Math.random() * h);
        p.size = 9 + Math.random() * 12;                      // 9–21 CSS px（比初版 6–15 大约 1.4 倍）
        p.vy = 12 + Math.random() * 26;                       // 下落 12–38 px/s
        p.amp = 10 + Math.random() * 34;                      // 摇摆幅度
        p.phase = Math.random() * Math.PI * 2;                // 摇摆相位各自随机
        p.wave = 0.35 + Math.random() * 0.75;                 // 摇摆角速度
        p.rot = Math.random() * Math.PI * 2;
        p.spin = (Math.random() - 0.5) * 0.9;                 // 自转
        p.alpha = 0.64 + Math.random() * 0.11;                // 0.64–0.75（比初版明显，但单篇封顶 0.75 不发闷）
        p.sprite = (Math.random() * SPRITES.length) | 0;
    }

    function seedPetals(n, atTop) {
        petals = [];
        for (var i = 0; i < n; i++) {
            var p = {};
            resetPetal(p, atTop);
            petals.push(p);
        }
    }

    /* ----------------------------------------------------------------- 绘制 */
    function draw(dt) {
        var ctx = view.ctx;
        var w = view.w;
        var h = view.h;
        if (!ctx) { return; }
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < petals.length; i++) {
            var p = petals[i];
            p.phase += p.wave * dt;
            p.baseX += view.wind * dt;                        // 缓慢的横向风
            p.x = p.baseX + Math.sin(p.phase) * p.amp;        // 正弦左右摇摆
            p.y += p.vy * dt;                                 // 下落
            p.rot += p.spin * dt;                             // 自转
            if (p.y > h + 28 || p.x < -80 || p.x > w + 80) {  // 飘出屏幕 → 回到顶部
                resetPetal(p, true);
                continue;
            }
            var sc = p.size / SPRITE;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(sc, sc);
            ctx.drawImage(SPRITES[p.sprite], -SPRITE / 2, -SPRITE / 2);
            ctx.restore();
        }
    }

    function frame(ts) {
        if (!running) { return; }
        if (!last) { last = ts; }
        var dt = Math.min((ts - last) / 1000, 0.05);   // 封顶 50ms，切回标签页不会瞬移
        last = ts;
        draw(dt);
        raf = window.requestAnimationFrame(frame);
    }

    function start() {
        if (running || !enabled || document.hidden) { return; }
        running = true;
        last = 0;
        raf = window.requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    }

    function clear() {
        if (view.ctx) { view.ctx.clearRect(0, 0, view.w, view.h); }
    }

    /* ----------------------------------------------------------- 尺寸自适应 */
    function resize() {
        var w = window.innerWidth;
        var h = window.innerHeight;
        var dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
        view.w = w;
        view.h = h;
        view.dpr = dpr;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // 之后都按 CSS 像素画
        var want = countFor(w);
        if (petals.length !== want) {
            seedPetals(want, false);
        }
        // 注意：这里不 clear()。下一帧 draw() 自己会先 clearRect 再画，
        // 而 pjax 换页时页面高度变化会触发 resize（滚动条出现/消失），
        // 在这里清屏会让画布空一帧 —— 所以只调整尺寸与数量，不动内容。
    }

    /* --------------------------------------------------------------- 开关 */
    function setEnabled(on, persist) {
        enabled = on;
        if (persist) {
            try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch (e) { /* 忽略 */ }
        }
        btn.classList.toggle('is-off', !on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.title = on ? '樱花飘落：开（点击关闭）' : '樱花飘落：关（点击开启）';
        if (on) {
            resize();
            start();
        } else {
            stop();
            clear();          // 真正停掉 rAF 并清空画布
        }
    }

    /* --------------------------------------------------------------- 初始化 */
    if (!document.createElement('canvas').getContext) { return; }

    canvas = document.createElement('canvas');
    canvas.className = 'fc-sakura';
    canvas.id = 'fc-sakura';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    view.ctx = canvas.getContext('2d');
    if (!view.ctx) { canvas.remove(); return; }

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fc-sakura-toggle';
    btn.className = 'fc-sakura-toggle';
    btn.setAttribute('aria-label', '樱花飘落特效开关');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = ICON;
    document.body.appendChild(btn);
    btn.addEventListener('click', function () { setEnabled(!enabled, true); });

    // 初始状态：默认开，只有明确存过 'off' 才关
    try { enabled = localStorage.getItem(STORE_KEY) !== 'off'; } catch (e) { enabled = true; }

    view.wind = 3 + Math.random() * 7;      // 每次加载风向速度略有不同
    setEnabled(enabled, false);

    var resizeTimer = null;
    window.addEventListener('resize', function () {
        if (resizeTimer) { return; }
        resizeTimer = setTimeout(function () {
            resizeTimer = null;
            if (enabled) { resize(); }
        }, 180);
    });

    // 标签页切到后台 → 停 rAF；回来 → 继续（省电，也不会有时间跳变）
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stop(); }
        else if (enabled) { start(); }
    });
})();
