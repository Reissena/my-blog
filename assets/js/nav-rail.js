/* ============================================================================
 * 顶部导航的「滑轨」行为（手机窄屏、7 项放不下时）
 * ----------------------------------------------------------------------------
 * 纯 CSS 已经能滑（overflow-x: auto + nowrap），这个脚本只补三件 CSS 做不到的事：
 *   1. 边缘渐隐提示：内容真的溢出时才给 .fc-nav-rail 打 is-scrollable，
 *      并记下是不是已经滑到某一端（at-start / at-end），让那一侧的提示收起。
 *   2. 当前页那一项自动滚进视野 —— 进场时、切页后、转屏后都要。
 *   3. 键盘 Tab 走到看不见的项时，把它**连余量一起**拉进来
 *      （浏览器自带的会把目标贴到容器最边上，正好落在渐隐里，看着像没选中）。
 *
 * 为什么需要 MutationObserver：本站是 pjax 无刷新切页，导航本身不会被替换
 * （pjax.js 只换 main.main），但它会在切页后把 active / aria-current 照抄到 #menu 上，
 * 所以盯住这两个属性的变化就等于拿到了「切页完成」的通知，不用去改 pjax 核心逻辑。
 *
 * 桌面端（>768px）宽度富余，scrollWidth 恒等于 clientWidth：
 * is-scrollable 不会被打上，渐隐不出现，reveal() 也直接返回 —— 等于什么都没做。
 * 不写 localStorage，不引入依赖。
 * ========================================================================== */
(function () {
    'use strict';

    var rail = document.getElementById('fc-nav-rail');
    var menu = document.getElementById('menu');
    if (!rail || !menu) { return; }
    if (rail.getAttribute('data-fc-ready') === '1') { return; }   // 幂等
    rail.setAttribute('data-fc-ready', '1');

    /* 当前项与渐隐区之间留的余量：贴着边正好在渐隐里，看着像没选中 */
    var PAD = 10;

    function maxScroll() {
        return Math.max(0, menu.scrollWidth - menu.clientWidth);
    }

    function sync() {
        var max = maxScroll();
        rail.classList.toggle('is-scrollable', max > 1);
        rail.classList.toggle('at-start', menu.scrollLeft <= 1);
        rail.classList.toggle('at-end', menu.scrollLeft >= max - 1);
    }

    /* 把某个导航项滚进可见区；已经看得见就一点不动，避免每次切页都抖一下 */
    function reveal(el, smooth) {
        var max = maxScroll();
        if (max <= 1 || !el) { sync(); return; }

        var mr = menu.getBoundingClientRect();
        var ar = el.getBoundingClientRect();
        var left = ar.left - mr.left + menu.scrollLeft;   // 换算成内容坐标
        var right = left + ar.width;
        var view = menu.clientWidth;
        var target = menu.scrollLeft;

        if (left - PAD < target) {
            target = left - PAD;
        } else if (right + PAD > target + view) {
            target = right + PAD - view;
        }
        target = Math.max(0, Math.min(max, target));

        if (Math.abs(target - menu.scrollLeft) < 1) { sync(); return; }
        if (smooth && menu.scrollTo) {
            menu.scrollTo({ left: target, behavior: 'smooth' });
        } else {
            menu.scrollLeft = target;
        }
        sync();
    }

    function current() {
        return menu.querySelector('a.active') || menu.querySelector('[aria-current="page"]');
    }

    function revealCurrent(smooth) {
        reveal(current(), smooth);
    }

    /* 进场：当前页那一项得是看得见的 */
    revealCurrent(false);

    menu.addEventListener('scroll', sync, { passive: true });

    /* 键盘 Tab 走到滑轨外时把它拉进来（带余量） */
    menu.addEventListener('focusin', function (e) {
        var t = e.target;
        if (t && t.closest) { reveal(t.closest('a[href]'), false); }
    });

    /* 指针横拖滑动。（手机上「手指横拖」是浏览器原生的滚动，这段只管鼠标 ——
       滚动容器对鼠标**不会**原生支持拖拽平移，窄窗口里用鼠标的人就只能干瞪眼。）
       先看位移：横move 不到 6px 一律当点击，不影响正常点导航；
       一旦真的拖了，就把紧随其后的那次 click 吃掉，免得「拖着看」变成「点进去了」。 */
    var drag = null;
    var GRAB = 6;

    menu.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) { return; }
        if (maxScroll() <= 1) { return; }
        drag = { id: e.pointerId, x: e.clientX, left: menu.scrollLeft, moved: false };
    });

    menu.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) { return; }
        var dx = e.clientX - drag.x;
        if (!drag.moved) {
            if (Math.abs(dx) < GRAB) { return; }
            drag.moved = true;
            menu.classList.add('is-dragging');
            try { menu.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        }
        menu.scrollLeft = drag.left - dx;
        e.preventDefault();
    });

    function endDrag() {
        if (!drag) { return; }
        menu.classList.remove('is-dragging');
        drag = null;
    }

    menu.addEventListener('pointerup', endDrag);
    menu.addEventListener('pointercancel', endDrag);
    menu.addEventListener('dragstart', function (e) { e.preventDefault(); });

    menu.addEventListener('click', function (e) {
        if (drag && drag.moved) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    menu.addEventListener('click', function () { drag = null; });

    /* 滚轮/触控板横滑（deltaX）也让它能用；竖向的 deltaY 不拦，页面照常上下滚 */
    menu.addEventListener('wheel', function (e) {
        if (maxScroll() <= 1) { return; }
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) { return; }
        menu.scrollLeft += e.deltaX;
        e.preventDefault();
    }, { passive: false });

    /* 转屏 / 改窗口大小：宽度变了，能不能滑、当前项在哪都要重算 */
    var rt = null;
    window.addEventListener('resize', function () {
        if (rt) { clearTimeout(rt); }
        rt = setTimeout(function () { sync(); revealCurrent(false); }, 120);
    });

    /* pjax 切页完成的通知：盯 #menu 上的 active / aria-current 变化 */
    if (window.MutationObserver) {
        var raf = null;
        var mo = new MutationObserver(function () {
            if (raf) { return; }
            raf = requestAnimationFrame(function () {
                raf = null;
                sync();
                revealCurrent(false);
            });
        });
        mo.observe(menu, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
    }

    /* 字体加载完每项宽度会变一点，重新量一次 */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () { sync(); revealCurrent(false); });
    }

    sync();
})();
