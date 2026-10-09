/* ============================================================================
   主题切换的「圆形扩散」过渡 —— 原生 View Transitions API，零依赖
   ----------------------------------------------------------------------------
   设计要点：
   1) 主题本身的切换逻辑一个字都没改。它仍然是主题 footer.html 里那个监听器：
          document.getElementById("theme-toggle").addEventListener("click", ...)
      负责改 html.dataset.theme 并写 localStorage 的 pref-theme。
   2) 这里用「捕获阶段拦截 + 在过渡回调里重新派发一次点击」把它整个包起来：
      · 捕获阶段（addEventListener 第三个参数 true）一定早于按钮自身的监听器；
      · 拦截时 stopPropagation()，所以按钮上的原监听器这次不会执行；
      · startViewTransition(回调) 里再 btn.click() 一次，原监听器在「新快照」里
        正常完成切换（localStorage / dataset.theme / 图标显隐全部照旧）。
      · replaying 标志避免这次重新派发的点击又被自己拦一次。
   3) 圆心的两种来源：鼠标点击坐标；键盘触发（Enter/Space，clientX/Y 为 0）
      时退回按钮中心。半径 = 圆心到视口四个角里最远那个角的距离。
   4) 降级：不支持 View Transitions 的浏览器（如 Firefox）直接放行，原有逻辑
      照常瞬间切换，不报错、不卡住。
   5) 尊重 prefers-reduced-motion：开启时同样直接放行，不做动画。
   ========================================================================== */
(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var replaying = false;

    /* 把圆心与半径写进 CSS 变量，交给 fluent.css 里
       ::view-transition-new(root) 的 clip-path 使用 */
    function setCircleVars(x, y) {
        var radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );
        root.style.setProperty('--fc-vt-x', x + 'px');
        root.style.setProperty('--fc-vt-y', y + 'px');
        root.style.setProperty('--fc-vt-r', radius + 'px');
    }

    document.addEventListener('click', function (event) {
        if (replaying) {
            return; // 放行我们自己在过渡里重新派发的那一次点击
        }

        var target = event.target;
        var btn = target && target.closest ? target.closest('#theme-toggle') : null;
        if (!btn) {
            return; // 不是主题切换按钮，别管
        }
        if (typeof document.startViewTransition !== 'function') {
            return; // 降级：浏览器不支持 → 直接走原有切换逻辑
        }
        if (reduceMotion.matches) {
            return; // 减少动效：直接切换，不做扩散动画
        }

        var x = event.clientX;
        var y = event.clientY;
        if (!x && !y) {
            // 键盘触发时没有鼠标坐标，用按钮中心
            var rect = btn.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }

        // 先掐断这次点击，避免原监听器在「旧快照」里就把主题改掉
        event.preventDefault();
        event.stopPropagation();

        setCircleVars(x, y);

        var switched = false;
        function switchTheme() {
            if (switched) {
                return;
            }
            switched = true;
            replaying = true;
            try {
                btn.click(); // 触发主题原有的监听器
            } finally {
                replaying = false;
            }
        }

        // pjax 给内容区和迷你播放条起了 view-transition-name（切页动画用），
        // 它们会画在 root 之上、圆形盖不住 —— 所以扩散前临时摘掉，结束再恢复。
        var names = window.fcViewNames;
        if (names) { try { names.clear(); } catch (e) { /* 忽略 */ } }

        function restoreNames() {
            if (names) { try { names.restore(); } catch (e) { /* 忽略 */ } }
        }

        try {
            var vt = document.startViewTransition(switchTheme);
            if (vt && vt.finished && vt.finished.then) { vt.finished.then(restoreNames, restoreNames); }
            else { restoreNames(); }
        } catch (err) {
            // 极端情况（例如文档不可见）下退回直接切换，保证功能不受影响
            switchTheme();
            restoreNames();
        }
    }, true);
})();
