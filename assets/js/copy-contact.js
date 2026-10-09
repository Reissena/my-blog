/* ============================================================================
   联系方式一键复制（QQ 号 / 邮箱）—— 原生实现，零依赖
   ----------------------------------------------------------------------------
   · 事件委托挂在 document 上：pjax 换页后新插进来的 [data-copy] 按钮照样能用，
     不需要在换页后重新绑定，也不会重复绑定
   · 复制的值与提示语来自按钮自己的属性：data-copy / data-copy-done
   · 剪贴板：优先 navigator.clipboard.writeText（HTTPS 才有）；
     不可用或被拒绝时退回 document.execCommand('copy') + 临时 textarea；
     两条路都失败就提示「复制失败」，绝不静默失败
   · 提示条是常驻在 <body> 上的一个玻璃小条（role=status），连续点击只重置计时，
     不会叠一堆；1.6 秒后淡出
   ========================================================================== */
(function () {
    'use strict';

    var SHOW_MS = 1600;
    var toastEl = null;
    var hideTimer = null;

    function ensureToast() {
        if (toastEl && toastEl.parentNode) { return toastEl; }
        toastEl = document.createElement('div');
        toastEl.className = 'fc-copy-toast fc-glass';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastEl);
        return toastEl;
    }

    function toast(msg, ok) {
        var el = ensureToast();
        el.textContent = msg;
        if (ok) { el.classList.remove('is-bad'); } else { el.classList.add('is-bad'); }
        // 连续点击时把动画重新开始（先摘掉再强制回流），而不是叠出好几条
        el.classList.remove('is-on');
        void el.offsetWidth;
        el.classList.add('is-on');
        if (hideTimer) { window.clearTimeout(hideTimer); }
        hideTimer = window.setTimeout(function () {
            hideTimer = null;
            if (toastEl) { toastEl.classList.remove('is-on'); }
        }, SHOW_MS);
    }

    /* 降级方案：临时 textarea + execCommand，尽量不打断用户原来的选区 */
    function legacyCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);

        var sel = document.getSelection ? document.getSelection() : null;
        var saved = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;

        var ok = false;
        try {
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            ok = document.execCommand('copy');
        } catch (e) {
            ok = false;
        }

        if (ta.parentNode) { ta.parentNode.removeChild(ta); }
        if (sel) {
            sel.removeAllRanges();
            if (saved) { sel.addRange(saved); }
        }
        return ok;
    }

    function copy(text, doneMsg) {
        var fallback = function () {
            if (legacyCopy(text)) { toast(doneMsg, true); }
            else { toast('复制失败', false); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                navigator.clipboard.writeText(text).then(function () {
                    toast(doneMsg, true);
                }, fallback);
            } catch (e) {
                fallback();
            }
        } else {
            fallback();
        }
    }

    document.addEventListener('click', function (e) {
        var t = e.target;
        var el = (t && t.closest) ? t.closest('[data-copy]') : null;
        if (!el) { return; }
        var text = el.getAttribute('data-copy') || '';
        if (!text) { return; }
        e.preventDefault();       // 万一以后又变成链接，也不让它跳走
        copy(text, el.getAttribute('data-copy-done') || '已复制');
    }, false);
})();
