/* R2 音乐播放 / seek / pjax 实测（不进仓库，测完删除） 用法: node r2-play-verify.js <base-url> */
const { spawn } = require('child_process');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:1314';
const ROOT = 'D:\\dsh\\个人博客\\my-blog\\.chrome-test';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9481;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=1400,900',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ROOT + '\\r2', 'about:blank'], { stdio: 'ignore' });
let ws = null, id = 0; const pend = new Map();
const net = [];
async function find() { for (let i = 0; i < 60; i++) { try { const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); const p = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) { return p.webSocketDebuggerUrl; } } catch (e) { } await sleep(250); } throw new Error('no chrome'); }
function send(m, p) { return new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); }); }
async function js(e) { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); if (r.result && r.result.exceptionDetails) { return { __error: (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || 'err' }; } const v = r.result && r.result.result ? r.result.result.value : null; return (typeof v === 'string' && (v.charAt(0) === '{' || v.charAt(0) === '[')) ? JSON.parse(v) : v; }
const ok = (b) => b ? 'OK' : '!!';
const HOOK = `
(function () {
    var OA = window.Audio;
    window.Audio = function () { var a = new OA(); window.__audio = a; window.__audioId = (window.__audioId || 0) + 1; return a; };
    window.Audio.prototype = OA.prototype;
})();
window.__st = function () {
    var a = window.__audio;
    if (!a) { return JSON.stringify({ none: true }); }
    return JSON.stringify({
        src: a.src, paused: a.paused, t: Math.round((a.currentTime || 0) * 10) / 10,
        dur: Math.round((a.duration || 0) * 10) / 10, ready: a.readyState, err: a.error ? a.error.code : null,
        audioId: window.__audioId, sameAudio: window.__audio === a,
        title: (document.getElementById('fc-title') || {}).textContent || '',
        total: (document.getElementById('fc-time-total') || document.getElementById('fc-time-total') || {}).textContent || ''
    });
};
`;
(async () => {
    try {
        ws = new WebSocket(await find());
        await new Promise((r) => ws.addEventListener('open', r));
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
            if (m.method === 'Network.responseReceived') {
                const r = m.params.response;
                if (/music\.yunblog\.com\.cn|r2\.dev/.test(r.url)) {
                    net.push({ url: r.url.split('/').pop(), status: r.status, type: r.headers['content-type'] || r.headers['Content-Type'], range: r.headers['content-range'] || r.headers['Content-Range'] || '', len: r.headers['content-length'] || r.headers['Content-Length'] });
                }
            }
        });
        await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
        await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
        await send('Page.navigate', { url: BASE + '/' });
        await sleep(3200);

        console.log('######## R2 音乐播放实测 @ ' + BASE + ' ########');
        console.log('\n[1] 音频源是否已是 R2');
        let s = await js('window.__st()');
        console.log('  src      = ' + s.src);
        console.log('  Audio 实例编号 = ' + s.audioId + '（用于判断 pjax 后有没有重新 new）');
        console.log('  指向 R2 ' + ok(String(s.src).indexOf('https://music.yunblog.com.cn/') === 0) + '   duration=' + s.dur + 's  readyState=' + s.ready);

        console.log('\n[2] 播放（点播放按钮，等 3.5 秒）');
        await js("document.querySelector('#fc-player [data-fc=\"toggle\"]').click(); 1");
        await sleep(3500);
        const p1 = await js('window.__st()');
        console.log('  paused=' + p1.paused + ' ' + ok(p1.paused === false) + '  currentTime=' + p1.t + 's  错误码=' + p1.err + ' ' + ok(p1.err === null));
        await sleep(2000);
        const p2 = await js('window.__st()');
        console.log('  2 秒后 currentTime=' + p2.t + 's（在走 ' + ok(p2.t > p1.t) + '）');

        console.log('\n[3] 拖动进度条到 50%（input=拖动中，change=松手落点，与真实拖拽一致）');
        const half = await js("(function(){var s=document.querySelector('[data-fc=\"seek\"]');s.value=500;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));var a=window.__audio;return JSON.stringify({before:a.currentTime,dur:a.duration});})()");
        console.log('  拖动前 currentTime=' + Math.round(half.before) + 's / 总长 ' + Math.round(half.dur) + 's');
        await sleep(2500);
        const s2 = await js('window.__st()');
        console.log('  拖动后 currentTime=' + s2.t + 's  期望≈' + Math.round(half.dur / 2) + 's ' + ok(Math.abs(s2.t - half.dur / 2) < half.dur * 0.15));
        await sleep(2000);
        const s3 = await js('window.__st()');
        console.log('  再等 2 秒 currentTime=' + s3.t + 's（从新位置继续播 ' + ok(s3.t > s2.t) + '，paused=' + s3.paused + '）');
        console.log('  期间对 R2 的网络请求：');
        net.forEach((r) => console.log('    ' + String(r.status) + '  ' + r.url + '  type=' + r.type + '  len=' + r.len + (r.range ? '  Content-Range=' + r.range : '')));
        const has206 = net.some((r) => r.status === 206);
        console.log('  出现过 206 Partial Content（说明 Range 生效）' + ok(has206) + ' （206 次数 ' + net.filter((r) => r.status === 206).length + '）');

        console.log('\n[4] pjax 切页：音乐不能断、不能重新 new');
        const before = await js('window.__st()');
        await js("document.querySelector('#menu a[href*=\"/posts/\"]').click(); 1");
        await sleep(2500);
        const mid = await js('window.__st()');
        await js("document.querySelector('.fc-brand').click(); 1");
        await sleep(2500);
        const after = await js('window.__st()');
        console.log('  切页前: t=' + before.t + 's audioId=' + before.audioId + ' paused=' + before.paused);
        console.log('  /posts/: t=' + mid.t + 's audioId=' + mid.audioId + ' paused=' + mid.paused);
        console.log('  回首页: t=' + after.t + 's audioId=' + after.audioId + ' paused=' + after.paused + ' src=' + after.src.split('/').pop());
        console.log('  判定: 同一个 Audio 实例（没重新 new）' + ok(after.audioId === before.audioId) +
            '   一直没暂停 ' + ok(!before.paused && !mid.paused && !after.paused) +
            '   进度持续推进 ' + ok(after.t > mid.t && mid.t >= before.t - 0.5));

        console.log('\n[5] 同源资源（封面 / 歌词）是否照旧');
        const assets = await js(`JSON.stringify(performance.getEntriesByType('resource').filter(function (e) { return /\\/music\\//.test(e.name); }).map(function (e) { return e.name.replace(/^.*\\//, '') + ':' + Math.round(e.responseEnd) + 'ms'; }))`);
        console.log('  本地 /music/ 资源请求: ' + JSON.stringify(assets));
        console.log('  封面仍是同源路径 ' + ok(String(await js("document.getElementById('fc-cover').getAttribute('src')")).indexOf('/music/covers/') === 0));
    } catch (err) { console.log('出错: ' + (err && err.message)); } finally {
        try { ws && ws.close(); } catch (e) { }
        try { chrome.kill(); } catch (e) { }
        await sleep(600);
        try { fs.rmSync(ROOT + '\\r2', { recursive: true, force: true }); } catch (e) { }
        process.exit(0);
    }
})();
