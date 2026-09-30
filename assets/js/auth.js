/* ============================================================================
 * PaperMod 前端登录模块 (auth.js)
 * ----------------------------------------------------------------------------
 * Hugo 是纯静态站点，没有服务端，所以这里实现的是「前端门禁式」登录：
 *   - 口令用 PBKDF2-SHA256 加盐哈希保存在 hugo.toml 的 [params.auth] 里；
 *   - 浏览器拿到口令后本地算出哈希再比对，绝不明文存储、也不明文传输；
 *   - 登录态放 localStorage（记住我）/ sessionStorage（仅本次会话）。
 *
 * ⚠️ 安全边界（请务必读一遍，DEPLOY.md 里也有同样的说明）：
 *   哈希和「会员内容」都在公开的静态文件里，懂技术的人可以跳过登录直接读
 *   HTML/JSON 原文，也可以用 devtools 手改 localStorage 冒充已登录。
 *   它挡的是「普通访客」，不是「攻击者」。真正的访问控制见 DEPLOY.md 的
 *   「升级到真安全方案」章节（Cloudflare Access / 后端鉴权 / Basic Auth）。
 *
 * 对外 API（浏览器控制台可用）：window.BlogAuth
 *   .isAuthed()  .user()  .login(user, pass, remember)  .logout([redirectTo])
 *   .loginURL([redirectTo])  .hashPassword(pass, salt, iterations)
 * ==========================================================================*/
(function () {
    "use strict";

    /* ---------------------------------------------------------------- 配置 */

    var DEFAULT_CFG = {
        enabled: true,
        sessionHours: 12,   // 不勾「记住我」时的有效期（小时）
        rememberDays: 30,   // 勾选「记住我」时的有效期（天）
        maxAttempts: 5,     // 连续失败多少次后开始冷却
        cooldownMs: 5000,   // 冷却时长（毫秒）
        loginPath: "login/",
        membersPath: "private/"
    };

    var SESSION_KEY = "pmauth.session";     // localStorage：记住我
    var SESSION_KEY_TMP = "pmauth.session.tmp"; // sessionStorage：仅本次会话
    var FAIL_KEY = "pmauth.failures";

    // 由 layouts/_partials/extend_head.html 注入：{ base, loginPath, ... }
    var INJECTED = window.__AUTH__ || {};

    /* 只在 /login/ 页注入的账号表（含盐与哈希）。放在 <script type="text/plain">
       里，是因为 Hugo 对普通 <script> 的插值会做 JS 上下文转义，
       把 jsonify 的结果再包一层引号（见 extend_head.html 的注释）。 */
    function readInjectedConfig() {
        if (window.__AUTH_CONFIG__) return window.__AUTH_CONFIG__;
        var el = document.getElementById("auth-config");
        if (!el) return null;
        try {
            return JSON.parse(el.textContent || el.innerText || "");
        } catch (e) {
            return null;
        }
    }
    var INJECTED_CFG = readInjectedConfig();

    /* ---------------------------------------------------------------- 工具 */

    function cfg() {
        var c = {}, k;
        for (k in DEFAULT_CFG) c[k] = DEFAULT_CFG[k];
        for (k in INJECTED) if (INJECTED[k] !== undefined && INJECTED[k] !== null) c[k] = INJECTED[k];
        return c;
    }

    // 大小写不敏感地取字段：Hugo 可能把 params 的键统一小写
    function pick(obj, key, fallback) {
        if (!obj) return fallback;
        if (obj[key] !== undefined) return obj[key];
        var lower = String(key).toLowerCase();
        for (var k in obj) {
            if (String(k).toLowerCase() === lower) return obj[k];
        }
        return fallback;
    }

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    // 定长比较，避免用 === 比较哈希时的时序差异（姿态性防护）
    function safeEqualHex(a, b) {
        a = String(a || "").toLowerCase();
        b = String(b || "").toLowerCase();
        if (a.length !== b.length || a.length === 0) return false;
        var diff = 0;
        for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return diff === 0;
    }

    /* 站点根路径：兼容 baseURL 带子路径（如 https://user.github.io/blog/）。
       刻意用 location.origin 拼装，这样本地 hugo server 换 IP/端口、线上换域名
       都不用改代码。 */
    function siteBase() {
        var b = INJECTED.base;
        if (typeof b !== "string" || b.charAt(0) !== "/") b = "/";
        if (b.charAt(b.length - 1) !== "/") b += "/";
        return b;
    }

    function siteURL(relativePath) {
        return location.origin + siteBase() + String(relativePath || "").replace(/^\/+/, "");
    }

    /* 由 Hugo 算好的「当前页 → 目标」相对地址（如 ../../login/）。
       相对地址交给浏览器解析，天然适配：本地 hugo server、线上域名、
       baseURL 带子路径、以及反向代理挂在 /blog-preview/ 这类前缀下的情况。 */
    function relURL(key, fallbackPath) {
        var rel = INJECTED[key];
        if (typeof rel !== "string" || !rel) rel = siteBase() + String(fallbackPath || "").replace(/^\/+/, "");
        try {
            return new URL(rel, location.href).href;
        } catch (e) {
            return location.origin + siteBase() + String(fallbackPath || "").replace(/^\/+/, "");
        }
    }

    function loginURL(redirectTo) {
        var url = relURL("loginRel", cfg().loginPath);
        if (redirectTo) url += "?redirect=" + encodeURIComponent(redirectTo);
        return url;
    }

    function membersURL() {
        return relURL("membersRel", cfg().membersPath);
    }

    function homeURL() {
        return relURL("homeRel", "");
    }

    // 只允许跳回本站路径，避免被 ?redirect=//evil.com 钓走
    function safeRedirect(raw) {
        if (!raw) return "";
        var path = String(raw);
        if (path.charAt(0) !== "/" || path.charAt(1) === "/") return "";
        if (path.indexOf("\\") !== -1) return "";
        return path;
    }

    /* ==================================================================
     * 纯 JS 的 SHA-256 / HMAC-SHA256 / PBKDF2 —— Web Crypto 的兜底实现
     * ------------------------------------------------------------------
     * crypto.subtle 只在「安全上下文」(https / localhost) 下存在；用
     * http://192.168.x.x:1313 这种局域网地址访问时它是 undefined，
     * 所以这里保留一份零依赖的纯 JS 实现，保证本地和线上行为一致。
     * tools/hash-password.mjs --selftest 会校验它与 Node crypto 输出一致。
     * ================================================================== */
    /* @pbkdf2-js:start */
    // 标记块内是「自包含」的：不依赖外部变量，方便 tools/hash-password.mjs
    // 用 --selftest 把这段代码抠出来在 Node 里跑，验证与 crypto.pbkdf2Sync 一致。
    function utf8(str) {
        return new TextEncoder().encode(String(str));
    }

    function toHex(bytes) {
        var s = "";
        for (var i = 0; i < bytes.length; i++) {
            s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
        }
        return s;
    }

    var SHA256_K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    function rotr(x, n) {
        return (x >>> n) | (x << (32 - n));
    }

    function sha256Bytes(bytes) {
        var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        var len = bytes.length;
        var padded = new Uint8Array((((len + 9) + 63) >> 6) << 6);
        padded.set(bytes);
        padded[len] = 0x80;
        var view = new DataView(padded.buffer);
        var bits = len * 8;
        view.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
        view.setUint32(padded.length - 4, bits >>> 0);

        var w = new Int32Array(64);
        for (var off = 0; off < padded.length; off += 64) {
            var i;
            for (i = 0; i < 16; i++) w[i] = view.getInt32(off + i * 4);
            for (i = 16; i < 64; i++) {
                var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }
            var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
            for (i = 0; i < 64; i++) {
                var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                var ch = (e & f) ^ (~e & g);
                var t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
                var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                var maj = (a & b) ^ (a & c) ^ (b & c);
                var t2 = (S0 + maj) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0;
                d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }
        var out = new Uint8Array(32);
        var outView = new DataView(out.buffer);
        for (i = 0; i < 8; i++) outView.setInt32(i * 4, H[i]);
        return out;
    }

    function concatBytes(a, b) {
        var out = new Uint8Array(a.length + b.length);
        out.set(a, 0);
        out.set(b, a.length);
        return out;
    }

    function hmacSha256(keyBytes, msgBytes) {
        var block = 64;
        var key = keyBytes.length > block ? sha256Bytes(keyBytes) : keyBytes;
        var iPad = new Uint8Array(block), oPad = new Uint8Array(block);
        for (var i = 0; i < block; i++) {
            var k = i < key.length ? key[i] : 0;
            iPad[i] = k ^ 0x36;
            oPad[i] = k ^ 0x5c;
        }
        return sha256Bytes(concatBytes(oPad, sha256Bytes(concatBytes(iPad, msgBytes))));
    }

    // PBKDF2-HMAC-SHA256。salt 按 UTF-8 文本参与运算（与 Node 版工具一致）
    function pbkdf2Sha256Hex(password, saltText, iterations, dkLen) {
        var pw = utf8(password);
        var salt = utf8(saltText);
        var blocks = Math.ceil((dkLen || 32) / 32);
        var derived = new Uint8Array(blocks * 32);
        for (var b = 1; b <= blocks; b++) {
            var idx = new Uint8Array([(b >>> 24) & 255, (b >>> 16) & 255, (b >>> 8) & 255, b & 255]);
            var u = hmacSha256(pw, concatBytes(salt, idx));
            var t = u.slice(0);
            for (var it = 1; it < iterations; it++) {
                u = hmacSha256(pw, u);
                for (var j = 0; j < 32; j++) t[j] ^= u[j];
            }
            derived.set(t, (b - 1) * 32);
        }
        return toHex(derived.slice(0, dkLen || 32));
    }
    /* @pbkdf2-js:end */

    /* 优先用 Web Crypto（快很多），不可用时退到纯 JS 实现 */
    function hashPassword(password, saltText, iterations, dkLen) {
        dkLen = dkLen || 32;
        iterations = iterations || 150000;
        var subtle = window.crypto && window.crypto.subtle;
        if (!subtle || !subtle.importKey) {
            return Promise.resolve(pbkdf2Sha256Hex(password, saltText, iterations, dkLen));
        }
        return subtle.importKey("raw", utf8(password), { name: "PBKDF2" }, false, ["deriveBits"])
            .then(function (key) {
                return subtle.deriveBits({
                    name: "PBKDF2",
                    salt: utf8(saltText),
                    iterations: iterations,
                    hash: "SHA-256"
                }, key, dkLen * 8);
            })
            .then(function (bits) {
                return toHex(new Uint8Array(bits));
            })
            .catch(function () {
                // 例如旧浏览器不支持 PBKDF2，再退一次
                return pbkdf2Sha256Hex(password, saltText, iterations, dkLen);
            });
    }

    /* ------------------------------------------------------------ 登录态 */

    function readRaw() {
        var raw = null;
        try {
            raw = sessionStorage.getItem(SESSION_KEY_TMP) || localStorage.getItem(SESSION_KEY);
        } catch (e) { /* 隐私模式可能抛异常 */ }
        if (!raw) return null;
        try {
            var s = JSON.parse(raw);
            if (!s || !s.u || !s.exp || s.exp <= Date.now()) return null;
            return s;
        } catch (e) {
            return null;
        }
    }

    function session() {
        var s = readRaw();
        if (!s) { clearSession(); return null; }
        return s;
    }

    function clearSession() {
        try {
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY_TMP);
        } catch (e) { /* ignore */ }
    }

    function writeSession(user, remember) {
        var c = cfg();
        var ms = remember
            ? c.rememberDays * 24 * 60 * 60 * 1000
            : c.sessionHours * 60 * 60 * 1000;
        var s = {
            u: pick(user, "username", ""),
            n: pick(user, "displayName", "") || pick(user, "username", ""),
            exp: Date.now() + ms,
            mem: !!remember
        };
        var raw = JSON.stringify(s);
        try {
            if (remember) {
                localStorage.setItem(SESSION_KEY, raw);
                sessionStorage.removeItem(SESSION_KEY_TMP);
            } else {
                sessionStorage.setItem(SESSION_KEY_TMP, raw);
                localStorage.removeItem(SESSION_KEY);
            }
        } catch (e) { /* ignore */ }
        return s;
    }

    function isAuthed() {
        return !!session();
    }

    function user() {
        var s = session();
        return s ? { username: s.u, displayName: s.n, expires: s.exp } : null;
    }

    /* 校验口令：返回 { ok:true, user } 或 { ok:false, reason } */
    function login(username, password, remember) {
        var c = cfg();
        var users = (INJECTED_CFG && pick(INJECTED_CFG, "users", [])) || [];
        var name = String(username || "").trim();
        var found = null;
        for (var i = 0; i < users.length; i++) {
            if (String(pick(users[i], "username", "")).toLowerCase() === name.toLowerCase()) {
                found = users[i];
                break;
            }
        }
        // 用户名不存在也照样跑一次哈希，避免用响应时间枚举用户名
        var salt = found ? String(pick(found, "salt", "")) : "00000000000000000000000000000000";
        var iterations = found ? Number(pick(found, "iterations", 150000)) : Number(c.defaultIterations || 150000);
        var expect = found ? String(pick(found, "hash", "")).toLowerCase() : "";

        return hashPassword(password, salt, iterations, 32).then(function (hex) {
            if (!found || !safeEqualHex(hex, expect)) {
                return { ok: false, reason: "用户名或密码不正确" };
            }
            return { ok: true, user: writeSession(found, remember) };
        });
    }

    /* 失败冷却：纯前端限流，只挡手速不挡脚本，聊胜于无 */
    function failures() {
        try { return parseInt(localStorage.getItem(FAIL_KEY) || "0", 10) || 0; } catch (e) { return 0; }
    }
    function bumpFailures() {
        try { localStorage.setItem(FAIL_KEY, String(failures() + 1)); } catch (e) { /* ignore */ }
    }
    function resetFailures() {
        try { localStorage.removeItem(FAIL_KEY); } catch (e) { /* ignore */ }
    }

    function logout(redirectTo) {
        clearSession();
        try { sessionStorage.removeItem(SESSION_KEY_TMP); } catch (e) { /* ignore */ }
        if (redirectTo !== false) location.href = redirectTo || homeURL();
    }

    /* ------------------------------------------------- 页头：登录 / 退出 */

    function renderNav() {
        var box = document.getElementById("auth-nav");
        if (!box) return;
        var loginLink = document.getElementById("auth-login-link");
        var userBox = document.getElementById("auth-user-box");
        var nameEl = document.getElementById("auth-user-name");
        var membersItem = document.getElementById("auth-members-item");
        var s = session();

        if (s) {
            if (loginLink) loginLink.hidden = true;
            if (userBox) userBox.hidden = false;
            if (nameEl) nameEl.textContent = s.n || s.u;
            if (membersItem) {
                membersItem.hidden = false;
                var membersLink = membersItem.querySelector("a");
                if (membersLink) membersLink.setAttribute("href", membersURL());
            }
        } else {
            if (loginLink) {
                loginLink.hidden = false;
                loginLink.setAttribute("href", loginURL(location.pathname + location.search));
            }
            if (userBox) userBox.hidden = true;
            if (membersItem) membersItem.hidden = true;
        }
    }

    function bindLogoutButtons() {
        var nodes = document.querySelectorAll("[data-auth-logout]");
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].addEventListener("click", function (ev) {
                ev.preventDefault();
                logout();
            });
        }
    }

    /* ------------------------------------------------------ /login/ 页面 */

    function initLoginPage() {
        var form = document.getElementById("auth-form");
        if (!form) return;

        var c = cfg();
        var params = new URLSearchParams(location.search);
        var redirectTo = safeRedirect(params.get("redirect"));

        var userInput = document.getElementById("auth-username");
        var passInput = document.getElementById("auth-password");
        var rememberInput = document.getElementById("auth-remember");
        var errorEl = document.getElementById("auth-error");
        var submitBtn = document.getElementById("auth-submit");
        var hintEl = document.getElementById("auth-redirect-hint");
        var doneEl = document.getElementById("auth-done");
        var doneUser = document.getElementById("auth-done-user");
        var resetBtn = document.getElementById("auth-reset");

        if (hintEl) {
            if (redirectTo) {
                hintEl.hidden = false;
                hintEl.innerHTML = '登录成功后将返回：<code></code>';
                hintEl.querySelector("code").textContent = redirectTo;
            } else {
                hintEl.hidden = true;
            }
        }

        function showError(msg) {
            if (!errorEl) return;
            if (!msg) { errorEl.hidden = true; errorEl.textContent = ""; return; }
            errorEl.hidden = false;
            errorEl.textContent = msg;
        }

        function showDone(s) {
            if (form) form.hidden = true;
            if (doneEl) doneEl.hidden = false;
            if (doneUser) doneUser.textContent = (s && (s.n || s.u)) || "";
            renderNav();
        }

        // 已经登录了：直接展示「已登录」面板（带 redirect 时自动跳回）
        var current = session();
        if (current) {
            showDone(current);
            if (redirectTo) {
                setTimeout(function () { location.replace(redirectTo); }, 1200);
            }
            return;
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                resetFailures();
                showError("");
            });
        }

        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            showError("");

            var u = userInput ? userInput.value.trim() : "";
            var p = passInput ? passInput.value : "";
            if (!u) { showError("请输入用户名"); if (userInput) userInput.focus(); return; }
            if (!p) { showError("请输入密码"); if (passInput) passInput.focus(); return; }

            var f = failures();
            if (f >= c.maxAttempts) {
                var wait = c.cooldownMs;
                if (submitBtn) submitBtn.disabled = true;
                showError("尝试次数过多，请等待 " + Math.ceil(wait / 1000) + " 秒后重试");
                setTimeout(function () {
                    if (submitBtn) submitBtn.disabled = false;
                    showError("");
                }, wait);
                return;
            }

            if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.label = submitBtn.textContent; submitBtn.textContent = "验证中…"; }

            login(u, p, !!(rememberInput && rememberInput.checked))
                .then(function (res) {
                    if (!res.ok) {
                        bumpFailures();
                        showError(res.reason + "（还可以尝试 " +
                            Math.max(0, c.maxAttempts - failures()) + " 次）");
                        if (passInput) { passInput.value = ""; passInput.focus(); }
                        return;
                    }
                    resetFailures();
                    showDone(res.user);
                    if (redirectTo) location.replace(redirectTo);
                })
                .catch(function () {
                    showError("校验失败：浏览器不支持 Web Crypto，且内置实现出错");
                })
                .then(function () {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        if (submitBtn.dataset.label) submitBtn.textContent = submitBtn.dataset.label;
                    }
                });
        });
    }

    /* --------------------------------------------------------------- 启动 */

    function init() {
        var c = cfg();
        if (c.enabled === false) return;
        renderNav();
        bindLogoutButtons();
        initLoginPage();

        // 已登录时给 <html> 打个标记，方便自定义 CSS / 埋点
        if (isAuthed()) document.documentElement.classList.add("auth-on");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.BlogAuth = {
        version: "1.0.0",
        isAuthed: isAuthed,
        user: user,
        login: login,
        logout: logout,
        session: session,
        loginURL: loginURL,
        membersURL: membersURL,
        homeURL: homeURL,
        siteURL: siteURL,
        hashPassword: hashPassword,
        pbkdf2Sha256Hex: pbkdf2Sha256Hex,
        config: cfg
    };
})();
