/* ============================================================================
   全站音乐播放器 —— 原生 Audio + 自写 LRC 解析，零第三方库
   ----------------------------------------------------------------------------
   两个展示形态（同一份逻辑，页面上有哪个就驱动哪个）：
     · 首页：#fc-player 播放器大卡 + #fc-lyric 歌词条（_partials/music_player.html）
     · 其它页：#fc-mini 右下角迷你播放条（_partials/extend_footer.html）
   跨页面不中断（Hugo 是多页站点，跳转会重载文档）：
     · 播放状态写进 localStorage：曲目 id / currentTime / 是否正在播放
     · 新页面加载时读回来，自动 seek 到同一位置；之前在播就尝试继续播
     · 浏览器可能因「自动播放策略」拒绝续播（没有用户手势），这时会老实停在
       暂停态、位置已经就位，点一下播放按钮就从原处继续
     · 跳转前（pagehide / 切到后台）会再存一次，尽量减少进度损失
   ========================================================================== */
(function () {
    'use strict';

    var dataEl = document.getElementById('fc-music-data');
    if (!dataEl) { return; }

    var PLAYLIST;
    try { PLAYLIST = JSON.parse(dataEl.textContent || '[]'); } catch (e) { return; }
    if (!PLAYLIST || !PLAYLIST.length) { return; }

    var STORE_KEY = 'fc-music-state';
    var SAVE_EVERY = 1000; // 播放中最多每秒写一次 localStorage

    /* ---------------------------------------------------------------- DOM */
    var dom = {
        big: document.getElementById('fc-player'),
        cover: document.getElementById('fc-cover'),
        title: document.getElementById('fc-title'),
        artist: document.getElementById('fc-artist'),
        credits: document.getElementById('fc-credits'),
        seek: document.getElementById('fc-seek'),
        cur: document.getElementById('fc-time-cur'),
        total: document.getElementById('fc-time-total'),
        lyricCur: document.querySelector('#fc-lyric [data-lyric="cur"]'),
        lyricPrev: document.querySelector('#fc-lyric [data-lyric="prev"]'),
        lyricNext: document.querySelector('#fc-lyric [data-lyric="next"]'),
        mini: document.getElementById('fc-mini'),
        miniCover: document.getElementById('fc-mini-cover'),
        miniTitle: document.getElementById('fc-mini-title'),
        miniArtist: document.getElementById('fc-mini-artist')
    };

    var toggles = [].slice.call(document.querySelectorAll('[data-fc="toggle"]'));
    var nextBtns = [].slice.call(document.querySelectorAll('[data-fc="next"]'));
    var prevBtns = [].slice.call(document.querySelectorAll('[data-fc="prev"]'));

    if (dom.mini && document.body) {
        // 让主题的「回到顶部」按钮往上让一让，别和迷你播放条叠在一起
        document.body.classList.add('fc-has-mini');
    }

    /* ---------------------------------------------------------------- 音频 */
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

    function save() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify({
                id: current().id,
                time: audio.currentTime || 0,
                playing: !audio.paused,
                at: Date.now()
            }));
        } catch (e) { /* 隐私模式下 localStorage 可能不可用，忽略 */ }
    }

    function readState() {
        var s = null;
        try { s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { s = null; }
        if (!s || !s.id) { return null; }
        var i = -1;
        for (var k = 0; k < PLAYLIST.length; k++) {
            if (PLAYLIST[k].id === s.id) { i = k; break; }
        }
        if (i < 0) { return null; }
        return { index: i, time: typeof s.time === 'number' ? s.time : 0, playing: !!s.playing };
    }

    /* ------------------------------------------------------------ 渲染 */
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
    function parseLrc(text) {
        var out = [];
        var rows = String(text).split(/\r?\n/);
        for (var i = 0; i < rows.length; i++) {
            var s = rows[i].trim();
            if (!s || s.charAt(0) === '{') { continue; } // 网易云 LRC 开头的 JSON 元数据行，不是歌词
            var m = /^\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]\s*(.*)$/.exec(s);
            if (!m) { continue; }
            var sec = parseInt(m[1], 10) * 60 + parseFloat(m[2].replace(':', '.'));
            var txt = m[3].trim();
            if (!txt || txt.indexOf('纯音乐') === 0) { continue; } // 「纯音乐，请欣赏」占位行
            out.push({ t: sec, text: txt });
        }
        out.sort(function (a, b) { return a.t - b.t; });
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
            if (current().id !== t.id) { return; } // 期间已经切歌
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
        if (changed) { // 重新触发一次淡入动画
            node.classList.remove('is-swap');
            void node.offsetWidth;
            node.classList.add('is-swap');
        }
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
            setLine(dom.lyricCur, msg, true);
            setLine(dom.lyricNext, '');
            return;
        }
        var i = lyrics.idx < 0 ? 0 : lyrics.idx;
        setLine(dom.lyricPrev, i > 0 ? lyrics.lines[i - 1].text : '');
        setLine(dom.lyricCur, lyrics.lines[i].text);
        setLine(dom.lyricNext, i + 1 < lyrics.lines.length ? lyrics.lines[i + 1].text : '');
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

    /* ------------------------------------------------------------ 事件 */
    audio.addEventListener('play', function () { setPlayingUI(); save(); });
    audio.addEventListener('pause', function () { setPlayingUI(); save(); });

    audio.addEventListener('loadedmetadata', function () {
        if (dom.total) { dom.total.textContent = fmt(audio.duration); }
        if (pendingSeek) {
            try { audio.currentTime = pendingSeek; } catch (e) { /* 某些格式不支持精确 seek，忽略 */ }
            pendingSeek = null;
        }
        updateTime();
        updateLyric();
        if (autoPlay) {
            autoPlay = false;
            var p = audio.play();
            if (p && p.catch) { p.catch(function () { setPlayingUI(); }); } // 被自动播放策略拦下就停在暂停态
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

    toggles.forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); togglePlay(); });
    });
    nextBtns.forEach(function (btn) {
        btn.addEventListener('click', function () { load(index + 1, { play: true }); });
    });
    prevBtns.forEach(function (btn) {
        btn.addEventListener('click', function () { load(index - 1, { play: true }); });
    });

    if (dom.seek) {
        dom.seek.addEventListener('input', function () { dragging = true; updateTime(); });
        dom.seek.addEventListener('change', function () {
            var d = audio.duration;
            if (isFinite(d) && d > 0) {
                try { audio.currentTime = (parseFloat(dom.seek.value) / 1000) * d; } catch (e) { /* 忽略 */ }
            }
            dragging = false;
            updateTime();
            updateLyric();
            save();
        });
    }

    // 跳转 / 切后台前再存一次，尽量少丢进度
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
})();
