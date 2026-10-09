/* ============================================================================
   全站音乐播放器 —— 原生 Audio + 自写 LRC 解析，零第三方库
   ----------------------------------------------------------------------------
   两种展示形态（同一份状态、同一组控制函数，页面上有哪个就驱动哪个）：
     · 首页：#fc-player 播放器大卡 + #fc-lyric 歌词条（在内容区，pjax 后会被重建）
     · 其它页：#fc-mini 右下角迷你播放条（在 footer 里，常驻、永不被替换）
   音频对象由 JS 持有（new Audio()，不在 DOM 里），所以配合 pjax.js 的局部无刷新
   导航时音频**完全不会中断**；pjax 换完内容后调用 window.fcMusic.refresh()，
   这里重新查询 DOM、重绑控件、把当前状态刷到新界面上。
   没有 pjax（JS 被禁 / 老浏览器）时退化成整页跳转：localStorage 记录
   {曲目, 进度, 播放状态}，新页面读回来 seek 到同一位置，再尝试续播
   （被浏览器自动播放策略拒绝时老实停在暂停态，位置已就位）。
   ========================================================================== */
(function () {
    'use strict';

    var dataEl = document.getElementById('fc-music-data');
    if (!dataEl) { return; }

    var PLAYLIST;
    try { PLAYLIST = JSON.parse(dataEl.textContent || '[]'); } catch (e) { return; }
    if (!PLAYLIST || !PLAYLIST.length) { return; }

    var STORE_KEY = 'fc-music-state';   // 曲目 / 进度 / 是否在播
    var VOL_KEY = 'fc-music-volume';    // 音量 / 静音（全局，不随曲目变化）
    var SAVE_EVERY = 1000;              // 播放中最多每秒写一次 localStorage

    // 制作信息角色名单（两种 LRC 格式都可能出现）—— 与 tools/prepare-music.py 保持一致
    var CREDIT_ROLES = ['作词', '作曲', '编曲', '制作人', '监制', '出品', '混音', '母带', '录音', '和声',
        '吉他', '贝斯', '鼓', '键盘', '弦乐', '原曲', '演唱', '调教', '曲绘', 'pv', '动画',
        'lyrics', 'lyricist', 'music', 'compose', 'composer', 'arrange', 'arranger',
        'producer', 'mixing', 'mix', 'mastering', 'master', 'vocal', 'vocals', 'guitar'];

    /* ---------------------------------------------------------------- 状态 */
    var audio = new Audio();
    audio.preload = 'metadata';

    var index = 0;
    var pendingSeek = null;
    var autoPlay = false;
    var dragging = false;
    var lastSave = 0;
    var failed = false;
    var lyrics = { lines: [], idx: -1, loading: false };
    var lyricCache = {};
    var dom = {};

    var vol = readVolume();
    audio.volume = vol.v;
    audio.muted = vol.m;
    if (audio.volume === 0 && !audio.muted) { audio.volume = 0.8; }

    /* -------------------------------------------------------------- 工具 */
    function fmt(sec) {
        if (!isFinite(sec) || sec < 0) { sec = 0; }
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function current() { return PLAYLIST[index]; }

    function creditsText(t) {
        if (!t.credits || !t.credits.length) { return ''; }
        return t.credits.map(function (c) { return c.role + ' ' + c.name; }).join(' · ');
    }

    function each(sel, fn) { [].forEach.call(document.querySelectorAll(sel), fn); }

    /* -------------------------------------------------------- 持久化：曲目 */
    function save() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify({
                id: current().id,
                time: audio.currentTime || 0,
                playing: !audio.paused,
                at: Date.now()
            }));
        } catch (e) { /* 隐私模式忽略 */ }
    }

    function readState() {
        var s = null;
        try { s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { s = null; }
        if (!s || !s.id) { return null; }
        for (var k = 0; k < PLAYLIST.length; k++) {
            if (PLAYLIST[k].id === s.id) {
                return { index: k, time: typeof s.time === 'number' ? s.time : 0, playing: !!s.playing };
            }
        }
        return null;
    }

    /* -------------------------------------------------------- 持久化：音量 */
    function readVolume() {
        var v = { v: 0.8, m: false };
        try {
            var s = JSON.parse(localStorage.getItem(VOL_KEY) || 'null');
            if (s && typeof s.v === 'number') {
                v.v = Math.min(1, Math.max(0, s.v));
                v.m = !!s.m;
            }
        } catch (e) { /* 忽略 */ }
        return v;
    }

    function saveVolume() {
        try {
            localStorage.setItem(VOL_KEY, JSON.stringify({ v: audio.volume, m: audio.muted }));
        } catch (e) { /* 忽略 */ }
    }

    /* ------------------------------------------------------------ 渲染 */
    function cacheDom() {
        dom = {
            big: document.getElementById('fc-player'),
            cover: document.getElementById('fc-cover'),
            title: document.getElementById('fc-title'),
            artist: document.getElementById('fc-artist'),
            credits: document.getElementById('fc-credits'),
            seek: document.querySelector('[data-fc="seek"]'),
            cur: document.getElementById('fc-time-cur'),
            total: document.getElementById('fc-time-total'),
            lyricCur: document.querySelector('#fc-lyric [data-lyric="cur"]'),
            lyricMain: document.querySelector('#fc-lyric [data-lyric="main"]'),
            lyricSub: document.querySelector('#fc-lyric [data-lyric="sub"]'),
            lyricPrev: document.querySelector('#fc-lyric [data-lyric="prev"]'),
            lyricNext: document.querySelector('#fc-lyric [data-lyric="next"]'),
            mini: document.getElementById('fc-mini'),
            miniCover: document.getElementById('fc-mini-cover'),
            miniTitle: document.getElementById('fc-mini-title'),
            miniArtist: document.getElementById('fc-mini-artist')
        };
    }

    /* 迷你条只在「没有播放器大卡」的页面出现（首页有大卡就藏起来）。
       用 #fc-player 是否存在来判断，比按 URL 猜更稳：pjax 换完页面也成立。 */
    function toggleMiniVisibility() {
        if (!dom.mini) { return; }
        // 显式写 inline style（而不是清空），这样首页那份「先藏起来防闪烁」的
        // <style>#fc-mini{display:none}</style> 不会在 pjax 换页后继续生效
        dom.mini.style.display = dom.big ? 'none' : 'flex';
        if (document.body) { document.body.classList.toggle('fc-has-mini', !dom.big); }
    }

    function renderMeta() {
        var t = current();
        if (dom.cover) { dom.cover.src = t.cover; dom.cover.alt = t.title + ' 专辑封面'; }
        if (dom.title) { dom.title.textContent = t.title; }
        if (dom.artist) { dom.artist.textContent = t.artist; }
        if (dom.credits) { dom.credits.textContent = creditsText(t); }
        if (dom.miniCover) { dom.miniCover.src = t.cover; }
        if (dom.miniTitle) { dom.miniTitle.textContent = t.title; }
        if (dom.miniArtist) { dom.miniArtist.textContent = t.artist; }
    }

    function setPlayingUI() {
        var playing = !audio.paused && !failed;
        [dom.big, dom.mini].forEach(function (node) {
            if (node) { node.classList.toggle('is-playing', playing); }
        });
    }

    function updateVolumeUI() {
        var muted = audio.muted || audio.volume === 0;
        each('[data-fc="mute"]', function (b) { b.classList.toggle('is-muted', muted); });
        each('[data-fc="vol"]', function (s) { s.value = Math.round(audio.volume * 100); });
        each('[data-fc="vol-val"]', function (n) { n.textContent = Math.round(audio.volume * 100); });
    }

    function updateTime() {
        if (!dom.seek) { return; }
        var d = audio.duration;
        if (dragging) {
            if (dom.cur && isFinite(d) && d > 0) {
                dom.cur.textContent = fmt((parseFloat(dom.seek.value) / 1000) * d);
            }
            return;
        }
        if (isFinite(d) && d > 0) {
            dom.seek.value = Math.round((audio.currentTime / d) * 1000);
            if (dom.total) { dom.total.textContent = fmt(d); }
        }
        if (dom.cur) { dom.cur.textContent = fmt(audio.currentTime); }
    }

    /* ------------------------------------------------------------ 歌词 */
    /* 两种 LRC 都要认：
       ① 网易云：开头是 {"t":0,"c":[{"tx":"作词: "},{"tx":"かませ虎"}]} 这样的 JSON 元数据
       ② 常见格式：制作信息写成带时间轴的 [00:00.00] 作词 : Renko（中英文冒号、两侧可能有空格）
     两种里面的制作信息行都不能当歌词显示；同一时间戳连续两行 = 原文 + 翻译，配成
     「主行 + 译文」一起渲染。 */
    function matchCredit(text) {
        var m = /^\s*([A-Za-z\u4e00-\u9fff]{1,8})\s*[:：]\s*(\S.*?)\s*$/.exec(text);
        if (!m) { return false; }
        var role = m[1];
        return CREDIT_ROLES.indexOf(role.toLowerCase()) >= 0 || CREDIT_ROLES.indexOf(role) >= 0;
    }

    function parseLrc(text) {
        var rows = String(text).split(/\r?\n/);
        var entries = [];
        for (var i = 0; i < rows.length; i++) {
            var s = rows[i].trim();
            if (!s || s.charAt(0) === '{') { continue; } // 网易云 JSON 元数据行
            var m = /^\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]\s*(.*)$/.exec(s);
            if (!m) { continue; }
            var sec = parseInt(m[1], 10) * 60 + parseFloat(m[2].replace(':', '.'));
            var txt = m[3].trim();
            if (!txt) { continue; }
            if (txt.indexOf('纯音乐') === 0 && txt.length <= 12) { continue; } // 「纯音乐，请欣赏」
            if (matchCredit(txt)) { continue; }                               // 带时间轴的制作信息行
            entries.push({ t: sec, text: txt });
        }
        var out = [];
        for (var k = 0; k < entries.length; k++) {
            var cur = entries[k];
            var sub = '';
            if (k + 1 < entries.length && Math.abs(entries[k + 1].t - cur.t) < 0.01) {
                sub = entries[k + 1].text; // 同一时间戳的第二行 = 译文
                k++;
            }
            out.push({ t: cur.t, text: cur.text, sub: sub });
        }
        return out;
    }

    function loadLyrics(t) {
        lyrics = { lines: [], idx: -1, loading: false };
        if (!t.lyrics) { paintLyrics(); return; }
        if (lyricCache[t.id]) { lyrics.lines = lyricCache[t.id]; paintLyrics(); return; }
        lyrics.loading = true;
        paintLyrics();
        fetch(t.lyrics).then(function (r) {
            return r.ok ? r.text() : '';
        }).then(function (text) {
            var lines = parseLrc(text);
            lyricCache[t.id] = lines;
            if (current().id !== t.id) { return; }
            lyrics.lines = lines;
            lyrics.loading = false;
            lyrics.idx = -1;
            paintLyrics();
            updateLyric();
        }).catch(function () {
            if (current().id !== t.id) { return; }
            lyrics.loading = false;
            paintLyrics();
        });
    }

    function setLine(node, text, isPlaceholder) {
        if (!node) { return; }
        var changed = node.textContent !== text;
        node.textContent = text;
        node.classList.toggle('is-placeholder', !!isPlaceholder);
        if (changed) { restart(node); }
    }

    function restart(node) { // 重新触发一次 CSS 动画
        if (!node) { return; }
        node.classList.remove('is-swap');
        void node.offsetWidth;
        node.classList.add('is-swap');
    }

    function paintLyrics() {
        if (!dom.lyricCur) { return; }
        var t = current();
        if (!lyrics.lines.length) {
            var msg = '暂无歌词';
            if (failed) { msg = '音频加载失败'; }
            else if (t.instrumental) { msg = '纯音乐，请欣赏'; }
            else if (lyrics.loading) { msg = '歌词加载中…'; }
            setLine(dom.lyricPrev, '');
            setLine(dom.lyricMain || dom.lyricCur, msg, true);
            if (dom.lyricSub) { dom.lyricSub.textContent = ''; dom.lyricSub.classList.add('is-empty'); }
            setLine(dom.lyricNext, '');
            return;
        }
        var i = lyrics.idx < 0 ? 0 : lyrics.idx;
        var L = lyrics.lines;
        setLine(dom.lyricPrev, i > 0 ? L[i - 1].text : '');
        setLine(dom.lyricMain || dom.lyricCur, L[i].text);
        if (dom.lyricSub) {
            dom.lyricSub.textContent = L[i].sub || '';
            dom.lyricSub.classList.toggle('is-empty', !L[i].sub);
            if (L[i].sub) { restart(dom.lyricSub); }
        }
        setLine(dom.lyricNext, i + 1 < L.length ? L[i + 1].text : '');
    }

    function updateLyric() {
        if (!lyrics.lines.length) { return; }
        var now = audio.currentTime;
        var i = lyrics.idx < 0 ? 0 : lyrics.idx;
        while (i + 1 < lyrics.lines.length && lyrics.lines[i + 1].t <= now) { i++; }
        while (i > 0 && lyrics.lines[i].t > now) { i--; }
        if (i !== lyrics.idx) { lyrics.idx = i; paintLyrics(); }
    }

    /* ------------------------------------------------------------ 播放控制 */
    function load(i, opt) {
        opt = opt || {};
        index = ((i % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
        var t = current();
        pendingSeek = (typeof opt.time === 'number' && opt.time > 0) ? opt.time : null;
        autoPlay = !!opt.play;
        failed = false;
        audio.src = t.file;
        if (dom.seek) { dom.seek.value = 0; }
        if (dom.cur) { dom.cur.textContent = '00:00'; }
        if (dom.total) { dom.total.textContent = '00:00'; }
        renderMeta();
        loadLyrics(t);
        setPlayingUI();
        save();
    }

    function togglePlay() {
        if (failed) { load(index, { play: true }); return; }
        if (audio.paused) {
            var p = audio.play();
            if (p && p.catch) { p.catch(function () { setPlayingUI(); }); }
        } else {
            audio.pause();
        }
    }

    function toggleMute() {
        audio.muted = !audio.muted;
        if (!audio.muted && audio.volume === 0) { audio.volume = 0.8; }
        saveVolume();
        updateVolumeUI();
    }

    function setVolume(v01) {
        audio.volume = Math.min(1, Math.max(0, v01));
        if (audio.volume > 0 && audio.muted) { audio.muted = false; } // 拖动即取消静音
        saveVolume();
        updateVolumeUI();
    }

    /* ------------------------------------------------------------ 事件绑定 */
    /* 只绑一次：pjax 换页后大卡是新的元素，迷你条是常驻的旧元素，
       dataset.fcBound 保证同一元素不会被重复绑定。 */
    function bindControls() {
        each('[data-fc="toggle"]', function (b) {
            if (b.dataset.fcBound) { return; }
            b.dataset.fcBound = '1';
            b.addEventListener('click', function (e) { e.preventDefault(); togglePlay(); });
        });
        each('[data-fc="next"]', function (b) {
            if (b.dataset.fcBound) { return; }
            b.dataset.fcBound = '1';
            b.addEventListener('click', function () { load(index + 1, { play: true }); });
        });
        each('[data-fc="prev"]', function (b) {
            if (b.dataset.fcBound) { return; }
            b.dataset.fcBound = '1';
            b.addEventListener('click', function () { load(index - 1, { play: true }); });
        });
        each('[data-fc="mute"]', function (b) {
            if (b.dataset.fcBound) { return; }
            b.dataset.fcBound = '1';
            b.addEventListener('click', function () { toggleMute(); });
        });
        each('[data-fc="seek"]', function (s) {
            if (s.dataset.fcBound) { return; }
            s.dataset.fcBound = '1';
            s.addEventListener('input', function () { dragging = true; updateTime(); });
            s.addEventListener('change', function () {
                var d = audio.duration;
                if (isFinite(d) && d > 0) {
                    try { audio.currentTime = (parseFloat(s.value) / 1000) * d; } catch (e) { /* 忽略 */ }
                }
                dragging = false;
                updateTime();
                updateLyric();
                save();
            });
        });
        each('[data-fc="vol"]', function (s) {
            if (s.dataset.fcBound) { return; }
            s.dataset.fcBound = '1';
            s.addEventListener('input', function () { setVolume(parseFloat(s.value) / 100); });
        });
    }

    /* 把当前状态刷到界面上（初始化时 + 每次 pjax 换页后都要调一次） */
    function refreshViews() {
        cacheDom();
        bindControls();
        toggleMiniVisibility();
        renderMeta();
        updateTime();
        paintLyrics();
        updateLyric();
        setPlayingUI();
        updateVolumeUI();
    }

    /* 给 pjax.js 用：换完内容后重新挂载播放器视图（音频本身不受影响） */
    window.fcMusic = { refresh: refreshViews };

    audio.addEventListener('play', function () { setPlayingUI(); save(); });
    audio.addEventListener('pause', function () { setPlayingUI(); save(); });
    audio.addEventListener('volumechange', function () { saveVolume(); updateVolumeUI(); });

    audio.addEventListener('loadedmetadata', function () {
        if (dom.total) { dom.total.textContent = fmt(audio.duration); }
        if (pendingSeek) {
            try { audio.currentTime = pendingSeek; } catch (e) { /* 某些格式不支持精确 seek */ }
            pendingSeek = null;
        }
        updateTime();
        updateLyric();
        if (autoPlay) {
            autoPlay = false;
            var p = audio.play();
            if (p && p.catch) { p.catch(function () { setPlayingUI(); }); }
        }
    });

    audio.addEventListener('timeupdate', function () {
        updateTime();
        updateLyric();
        var now = Date.now();
        if (!audio.paused && now - lastSave > SAVE_EVERY) { lastSave = now; save(); }
    });

    audio.addEventListener('ended', function () { load(index + 1, { play: true }); });

    audio.addEventListener('error', function () {
        failed = true;
        lyrics = { lines: [], idx: -1, loading: false };
        paintLyrics();
        setPlayingUI();
    });

    // 整页跳转（没有 pjax 时）/ 切后台前再存一次，尽量少丢进度
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') { save(); }
    });

    /* ------------------------------------------------------------ 初始化 */
    var restored = readState();
    if (restored) {
        load(restored.index, { time: restored.time, play: restored.playing });
    } else {
        load(0, {});
    }
    refreshViews();
})();
