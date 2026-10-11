/* ============================================================================
   正文图片灯箱 —— 用浏览器原生 <dialog> 实现，零依赖
   ----------------------------------------------------------------------------
   为什么是 <dialog> + showModal()：
     · showModal() 一次给齐三样本来要手写的东西 —— **焦点陷阱**（Tab 不会跑出
       对话框）、**Esc 关闭**、以及 ::backdrop 遮罩层。这三样恰好是这类组件最
       容易写错的地方（焦点跑丢、Esc 被别的监听器吃掉、遮罩挡不住点击穿透）。
     · dialog 打开后进入浏览器的**顶层（top layer）**：本站 body 上的
       overflow-x: clip、卡片的 isolation、以及 §1.4 那张 z-index 阶梯
       （页头 50 / 樱花 55 / 迷你条 60）**统统管不到它** —— 不需要去阶梯里抢号，
       也不会出现「被谁的层盖住一半」。
     · dialog 是**建一次、用一辈子**的：它挂在 <body> 上（main.main 之外），
       pjax 只换内容区，所以它既不会被换掉、也不会被建出第二个 ——
       这就是「连着切页也不会重复弹出」的根本原因（没有第二份 DOM 可弹）。
     · 刻意**不做滚动锁定**：给 <html> 加 overflow: hidden 会让桌面端滚动条消失，
       底下的内容横向抖一下（站内所有 fixed 元素都跟着动）。为了一个「背景别跟着
       滚」的小体验去换一次整页跳动不值当，就不做。

   为什么只认 .fc-article .post-content 里的图片（两层容器都要命中）：
     站上还有封面图（.fc-post-cover，列表页里它整块是卡片链接的点击区）、
     作者卡头像、联系方式图标排、播放器封面 —— 它们各自有别的用途，变成
     「点了放大」会破坏原本的行为。所以选择器同时限定「文章卡片」与「正文」。
     ⚠️ 关于页 / 简历页的正文也带 .post-content 类（它们故意复用正文排版），
     但它们的图片不在 .fc-article 里，所以不会被选中。以后若想让公告页的图片
     也能放大，把 .fc-about-body 补进 SELECTOR 就行。

   键盘可达：<img> 本身不可聚焦，所以脚本给命中的图片补上
   tabindex="0" + role="button" + aria-label（Tab 能停在图上）；
   <img> 没有原生激活行为，所以回车 / 空格要自己处理（见 keydown）。
   打开前记住是哪张图，关闭时把焦点**还给它** —— 不还的话，键盘用户按一下 Esc
   就被丢回文档开头，得重新 Tab 一遍才能回到刚才那张图。
   ========================================================================== */
(function () {
    'use strict';

    var SELECTOR = '.fc-article .post-content img';
    var root = document.documentElement;

    /* 幂等守卫：脚本被加载两次（或被人手动再引一遍）也不会建出第二个 dialog */
    if (root.getAttribute('data-fc-lightbox') === '1') { return; }
    root.setAttribute('data-fc-lightbox', '1');

    var content = document.querySelector('main.main');
    var dialog = null;    // 唯一的那个 <dialog>，惰性创建
    var shot = null;      // 对话框里那张大图
    var opener = null;    // 「是哪张图把我打开的」——关闭时焦点还给它

    /* 这张图该不该变成「可点放大」 */
    function qualify(img) {
        if (!img || img.tagName !== 'IMG' || !img.closest) { return false; }
        if (img.hasAttribute('data-no-zoom')) { return false; }
        /* 图片自己就是个链接（比如后台插图时勾了链接）：别抢它的行为 */
        if (img.closest('a')) { return false; }
        return !!img.closest('.fc-article .post-content');
    }

    /* 给命中的图片补上「可聚焦 + 读屏能念」的属性。
       data-fc-zoom 是幂等守卫：同一张图只加工一次，pjax 反复换页也不会叠加。 */
    function decorate(img) {
        if (!qualify(img) || img.getAttribute('data-fc-zoom') === '1') { return; }
        img.setAttribute('data-fc-zoom', '1');
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        img.setAttribute('aria-haspopup', 'dialog');
        var alt = img.getAttribute('alt');
        img.setAttribute('aria-label', alt ? '查看大图：' + alt : '查看大图');
    }

    function decorateAll(scope) {
        var host = scope || document;
        if (!host.querySelectorAll) { return; }
        var list = host.querySelectorAll(SELECTOR);
        for (var i = 0; i < list.length; i++) { decorate(list[i]); }
    }

    function build() {
        if (dialog && dialog.parentNode) { return dialog; }

        dialog = document.createElement('dialog');
        dialog.id = 'fc-lightbox';
        dialog.className = 'fc-lightbox';
        dialog.setAttribute('aria-label', '图片预览');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fc-lightbox-close';
        btn.setAttribute('aria-label', '关闭图片（Esc）');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"'
            + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
            + '<path d="M6 6l12 12M18 6L6 18"/></svg>';

        shot = document.createElement('img');
        shot.className = 'fc-lightbox-img';
        shot.decoding = 'async';
        shot.alt = '';

        dialog.appendChild(btn);
        dialog.appendChild(shot);

        /* 点背景关闭：dialog 自己铺满整个视口，里面只有「关闭按钮 + 一张图」两个孩子，
           所以「点到 dialog 本身」就等于点到图周围的背景（图片不背这个锅 ——
           点图片本身不关闭，避免想看细节时手一抖就没了）。 */
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog && dialog.open) { dialog.close(); }
        });

        btn.addEventListener('click', function () {
            if (dialog.open) { dialog.close(); }
        });

        /* Esc 由 <dialog> 原生处理（会先派发 cancel，再 close），不用自己监听键盘。
           关闭只有这一条收尾路径，焦点归还写在这里就够了。 */
        dialog.addEventListener('close', function () {
            var back = opener;
            opener = null;
            if (back && document.contains(back)) {
                try { back.focus(); } catch (e) { /* 焦点还不了也不能报错 */ }
            }
        });

        document.body.appendChild(dialog);
        return dialog;
    }

    function open(img) {
        var d = build();
        opener = img;
        /* currentSrc：响应式图片（srcset）里浏览器实际选中的那张。
           不写死 img.src —— 那可能是一张从没下载过的候选图。 */
        var src = img.currentSrc || img.getAttribute('src');
        if (src) { shot.setAttribute('src', src); }
        shot.setAttribute('alt', img.getAttribute('alt') || '');
        /* 已经开着就别再 showModal()：连点两次会抛 InvalidStateError */
        if (!d.open) { d.showModal(); }
    }

    /* 事件委托挂在 document 上：pjax 换页后新插进来的图片照样能点，
       不需要在换页后重新绑定，也不会重复绑定（和 copy-contact.js 同一套路）。 */
    document.addEventListener('click', function (e) {
        var t = e.target;
        var img = (t && t.closest) ? t.closest('img') : null;
        if (!qualify(img)) { return; }
        e.preventDefault();
        open(img);
    }, false);

    document.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || e.repeat) { return; }
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') { return; }
        var t = e.target;
        var img = (t && t.closest) ? t.closest('img') : null;
        if (!qualify(img)) { return; }
        e.preventDefault();   // 空格默认是「向下翻一屏」，不挡掉会一边放大一边滚
        open(img);
    }, false);

    /* pjax 换页的信号：它把 main.main 的 innerHTML 整个换掉（childList 变动），
       新页面里的图片要重新加工一遍。观察器只建一次，所以不会随换页叠加。 */
    if (window.MutationObserver && content) {
        new MutationObserver(function () { decorateAll(content); })
            .observe(content, { childList: true });
    }

    decorateAll(content || document);
})();
