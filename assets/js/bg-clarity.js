/* ============================================================================
   左下角「背景清晰度」竖直滑块
   ----------------------------------------------------------------------------
   刻度 0~70，遮罩不透明度 = 100 − 清晰度（0 = 背景全遮住，70 = 只遮 30%）。

   为什么这么写：
   · 只改**一个** CSS 自定义属性 --fc-clarity。渐变本身写在 fluent.css 里，用
     calc((100 - var(--fc-clarity)) / 100 …) 从它算出来 —— 所以拖动时不重拼渐变
     字符串、不碰任何别的样式，每次输入只写一个变量。
   · 默认档位来自模板：hugo.toml 的 params.bgClarityDefault 由 extend_head.html /
     extend_footer.html 注入，脚本里没有硬编码数字；<input> 的 value 就是唯一真相。
   · 拖动 / 触摸 / 键盘全部交给原生 <input type=range>：input 事件在拖动过程中
     连续触发（change 只在松手时触发，所以不用它），手机上的拖拽手势也是浏览器
     原生支持的，不需要自己写 pointer 事件。方向键 / Home / End 同样自带。
   · 刻意不写 localStorage：用户要的是「所有访客进来都是默认值 40」。
   · 滑块由 extend_footer.html 渲染在 main.main 之外，pjax 只替换内容区，
     所以它不会被换掉、不会重复挂载、数值也不会被重置；下面再加一道守卫双保险。
   ========================================================================== */
(function () {
    'use strict';

    var box = document.getElementById('fc-clarity');
    var input = document.getElementById('fc-clarity-range');
    var out = document.getElementById('fc-clarity-value');
    if (!box || !input) { return; }

    // 幂等守卫：万一脚本被加载两次也不会重复绑事件（参考樱花开关的做法）
    if (box.getAttribute('data-fc-ready') === '1') { return; }
    box.setAttribute('data-fc-ready', '1');

    var root = document.documentElement;

    function apply(value) {
        var v = String(value);
        root.style.setProperty('--fc-clarity', v);
        // 显式声明了 role="slider"，aria-valuenow 得自己跟着同步，否则读屏会报旧值
        input.setAttribute('aria-valuenow', v);
        if (out) { out.textContent = v; }
    }

    input.addEventListener('input', function () { apply(input.value); });

    // 首屏对齐一次：以模板写进 value 的默认档位为准
    apply(input.value);
})();
