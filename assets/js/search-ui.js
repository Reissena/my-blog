/* ============================================================================
   搜索页提示条（空状态 / 无结果 / 条数）—— 只读观察者，零依赖
   ----------------------------------------------------------------------------
   主题的 fastsearch.js 负责真正的搜索与键盘操作，这里一个字都不改它：
     · 监听输入框的 input / search 事件
     · 监听结果列表的 childList 变化（脚本重建列表时会触发）
     · 监听输入框 disabled 属性（索引加载完成后脚本会把它置为 false）
   然后只更新 #fc-search-hint 的文案。索引加载失败（一直 disabled）也会给出提示。
   ========================================================================== */
(function () {
    'use strict';

    var input = document.getElementById('searchInput');
    var list = document.getElementById('searchResults');
    var hint = document.getElementById('fc-search-hint');
    if (!input || !list || !hint) { return; }

    var EMPTY = '输入关键词开始搜索，例如「Hugo」「音乐」';

    function update() {
        if (input.disabled) {
            hint.textContent = '正在加载搜索索引…';
            return;
        }
        var q = (input.value || '').trim();
        var n = list.children.length;
        if (!q) {
            hint.textContent = EMPTY;
        } else if (n === 0) {
            hint.textContent = '没有找到与「' + q + '」相关的内容，换个关键词试试';
        } else {
            hint.textContent = '找到 ' + n + ' 条与「' + q + '」相关的内容';
        }
    }

    // 结果列表被脚本重建 → 刷新提示
    if (window.MutationObserver) {
        new MutationObserver(update).observe(list, { childList: true });
        new MutationObserver(update).observe(input, { attributes: true, attributeFilter: ['disabled'] });
    }

    input.addEventListener('input', update);
    input.addEventListener('search', update);          // 输入框右侧的清除按钮
    input.addEventListener('change', update);
    document.addEventListener('keydown', function (e) {
        // Esc 会被主题脚本用于清空输入，等它跑完再刷新提示
        if (e.key === 'Escape') { window.setTimeout(update, 0); }
    });
    window.addEventListener('load', function () { window.setTimeout(update, 200); });

    update();
})();
