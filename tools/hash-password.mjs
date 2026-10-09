#!/usr/bin/env node
/**
 * ============================================================================
 * tools/hash-password.mjs —— 为「前端门禁式」登录生成 PBKDF2-SHA256 口令哈希
 * ============================================================================
 *
 * 用法（在仓库根目录、也就是有 hugo.toml 的那一层执行）：
 *
 *   node tools/hash-password.mjs                          # 交互式，输入不回显（推荐）
 *   node tools/hash-password.mjs '我的密码'                # 直接给密码（会进 shell 历史，慎用）
 *   node tools/hash-password.mjs --user member --display-name 会员读者
 *   node tools/hash-password.mjs --iterations 200000
 *   node tools/hash-password.mjs --user friend --role member --generate   # 随机生成强密码
 *   node tools/hash-password.mjs --selftest               # 校验 assets/js/auth.js 的纯 JS 实现
 *   node tools/hash-password.mjs --check member '你的口令'   # 用配置里的盐/哈希验证口令
 *
 * 输出的 TOML 片段直接追加到 hugo.toml 里（可以有任意多个账号）：
 *
 *   [[params.auth.users]]
 *     username = "member"
 *     ...
 *
 * 换了密码就把 hugo.toml 里对应账号的 salt / hash / iterations 三行替换掉，
 * 然后重新构建站点即可。旧的登录态会在有效期后自然失效（也可以让访客
 * 在浏览器里「退出登录」，或把 localStorage 里的 pmauth.session 删掉）。
 */

import { pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_JS = join(__dirname, "..", "assets", "js", "auth.js");
const HUGO_TOML = join(__dirname, "..", "hugo.toml");

const DEFAULTS = {
    iterations: 150000, // 与 assets/js/auth.js 的兜底值保持一致
    dkLen: 32,          // SHA-256 输出 32 字节
    user: "member",
    displayName: "会员读者",
    role: "member"
};

/* -------------------------------------------------------- 随机强密码生成 */

// 刻意避开容易混淆的 O/0、l/1/I，以及会跟 shell / TOML 打架的 " \ $ ` #
const PW_LOWER = "abcdefghijkmnpqrstuvwxyz";
const PW_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PW_DIGIT = "23456789";
const PW_SYMBOL = "!@*-_=+?";

function generatePassword(len = 16) {
    const all = PW_LOWER + PW_UPPER + PW_DIGIT + PW_SYMBOL;
    const pick = (set) => set[randomInt(set.length)];
    const chars = [pick(PW_LOWER), pick(PW_UPPER), pick(PW_DIGIT), pick(PW_SYMBOL)];
    while (chars.length < len) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {   // Fisher–Yates
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
}

/* ------------------------------------------------------------------ 参数 */

function parseArgs(argv) {
    const out = { positional: [], flags: {} };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--selftest") out.flags.selftest = true;
        else if (a === "--check") out.flags.check = true;
        else if (a === "--help" || a === "-h") out.flags.help = true;
        else if (a === "--user") out.flags.user = argv[++i];
        else if (a === "--role") out.flags.role = argv[++i];
        else if (a === "--generate") out.flags.generate = true;
        else if (a === "--display-name") out.flags.displayName = argv[++i];
        else if (a === "--iterations") out.flags.iterations = parseInt(argv[++i], 10);
        else if (a === "--salt") out.flags.salt = argv[++i];
        else if (a.startsWith("--")) {
            console.error(`未知参数：${a}（用 --help 看用法）`);
            process.exit(2);
        } else out.positional.push(a);
    }
    return out;
}

/* ------------------------------------------------- 浏览器端实现的等价性自测 */

/** 从 assets/js/auth.js 抠出 @pbkdf2-js 标记块，在 Node 里跑一遍 */
function loadPureJsPbkdf2() {
    const src = readFileSync(AUTH_JS, "utf8");
    const start = src.indexOf("/* @pbkdf2-js:start */");
    const end = src.indexOf("/* @pbkdf2-js:end */");
    if (start < 0 || end < 0) {
        throw new Error("在 assets/js/auth.js 里找不到 @pbkdf2-js:start/end 标记块");
    }
    const body = src.slice(start, end);
    // eslint-disable-next-line no-new-func
    const factory = new Function(
        body + "\nreturn { pbkdf2Sha256Hex: pbkdf2Sha256Hex };"
    );
    return factory().pbkdf2Sha256Hex;
}

function selftest() {
    const jsImpl = loadPureJsPbkdf2();
    const cases = [
        { pw: "selftest-vector-1", salt: "a1b2c3d4e5f60718293a4b5c6d7e8f90", iters: 1000 },
        { pw: "密码里有中文🔒", salt: "00112233445566778899aabbccddeeff", iters: 2000 },
        { pw: "", salt: "ffffffffffffffffffffffffffffffff", iters: 10 },
        { pw: "p@ss word with spaces", salt: "0123456789abcdef0123456789abcdef", iters: 5000 }
    ];
    let failed = 0;
    for (const c of cases) {
        const nodeHex = pbkdf2Sync(Buffer.from(c.pw, "utf8"), Buffer.from(c.salt, "utf8"), c.iters, 32, "sha256").toString("hex");
        const jsHex = jsImpl(c.pw, c.salt, c.iters, 32);
        const ok = nodeHex === jsHex;
        if (!ok) failed++;
        console.log(`${ok ? "✅" : "❌"} pw=${JSON.stringify(c.pw)} salt=${c.salt} iters=${c.iters}`);
        if (!ok) {
            console.log(`   node: ${nodeHex}`);
            console.log(`   js  : ${jsHex}`);
        }
    }

    // 顺带量一下纯 JS 实现在目标迭代次数下要多久（局域网 HTTP 下只能走这条路）
    const t0 = process.hrtime.bigint();
    jsImpl("benchmark-password", "0123456789abcdef0123456789abcdef", DEFAULTS.iterations, 32);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`\n纯 JS 实现 @${DEFAULTS.iterations} 次迭代耗时：${ms.toFixed(0)} ms（V8/Node 与浏览器同引擎，可作参考）`);

    console.log(failed === 0 ? "\n全部通过：浏览器端纯 JS 回退实现与 Node crypto 结果一致。" : `\n有 ${failed} 个用例不一致！`);
    process.exit(failed === 0 ? 0 : 1);
}

/* ------------------------------------------- 用 hugo.toml 里的盐/哈希验证口令 */

/** 极简 TOML 片段解析：只认 [[params.auth.users]] 里的四个字段 */
function readUsersFromToml() {
    const src = readFileSync(HUGO_TOML, "utf8");
    const blocks = src.split(/\[\[params\.auth\.users\]\]/).slice(1);
    return blocks.map((block) => {
        const body = block.split("\n[").shift(); // 到下一个表头为止
        const val = (key) => {
            const m = body.match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\n]*)"?`, "m"));
            return m ? m[1].trim() : "";
        };
        return {
            username: val("username"),
            displayName: val("displayName"),
            role: val("role") || "member",
            salt: val("salt"),
            hash: val("hash"),
            iterations: parseInt(val("iterations"), 10) || DEFAULTS.iterations
        };
    }).filter((u) => u.username);
}

function check(username, password) {
    const users = readUsersFromToml();
    const user = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
    if (!user) {
        console.error(`hugo.toml 里没有用户 "${username}"。现有账号：${users.map((u) => u.username).join(", ") || "（无）"}`);
        process.exit(1);
    }
    const hex = loadPureJsPbkdf2()(password, user.salt, user.iterations, DEFAULTS.dkLen);
    const ok = hex === user.hash.toLowerCase();
    console.log(`${ok ? "✅" : "❌"} ${user.username}（${user.displayName || "-"}，role=${user.role}）口令${ok ? "匹配" : "不匹配"}`);
    if (!ok) {
        console.log(`   期望：${user.hash}\n   实际：${hex}`);
        process.exit(1);
    }
    console.log(`   算法：PBKDF2-HMAC-SHA256 / ${user.iterations} 次迭代 / salt=${user.salt}`);
    return ok;
}

/* -------------------------------------------------------------- 交互输入 */

function askHidden(question) {
    return new Promise((resolve) => {
        const input = process.stdin;
        if (!input.isTTY) {
            // 非交互（管道）场景：直接读一行
            const rl = readline.createInterface({ input });
            rl.once("line", (line) => { rl.close(); resolve(line); });
            return;
        }
        process.stdout.write(question);
        input.setRawMode(true);
        input.resume();
        let buf = "";
        const onData = (chunk) => {
            const str = chunk.toString("utf8");
            for (const ch of str) {
                if (ch === "\r" || ch === "\n") {
                    input.setRawMode(false);
                    input.pause();
                    input.removeListener("data", onData);
                    process.stdout.write("\n");
                    resolve(buf);
                    return;
                }
                if (ch === "\u0003") { // Ctrl+C
                    process.stdout.write("\n");
                    process.exit(130);
                }
                if (ch === "\u007f" || ch === "\b") { // Backspace
                    buf = buf.slice(0, -1);
                    continue;
                }
                buf += ch;
            }
        };
        input.on("data", onData);
    });
}

/* ------------------------------------------------------------------ 主流程 */

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.flags.help) {
        console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
        return;
    }
    if (args.flags.selftest) return selftest();
    if (args.flags.check) {
        const [user, ...rest] = args.positional;
        if (!user) {
            const users = readUsersFromToml();
            console.log(`hugo.toml 里的账号：\n${users.map((u) => `  - ${u.username}（${u.displayName || "-"}，role=${u.role}）`).join("\n") || "  （无）"}`);
            console.log("\n用法：node tools/hash-password.mjs --check <用户名> <密码>");
            return;
        }
        const password = rest.length ? rest.join(" ") : await askHidden(`请输入 ${user} 的密码（不回显）：`);
        return check(user, password);
    }

    let password = args.positional.length
        ? args.positional.join(" ")
        : (args.flags.generate ? generatePassword(16) : await askHidden("请输入新密码（不回显，回车确认）："));

    if (!password) {
        console.error("密码不能为空。");
        process.exit(2);
    }

    const iterations = Number.isFinite(args.flags.iterations) && args.flags.iterations > 0
        ? args.flags.iterations
        : DEFAULTS.iterations;
    const salt = args.flags.salt || randomBytes(16).toString("hex");
    const hash = pbkdf2Sync(
        Buffer.from(password, "utf8"),
        Buffer.from(salt, "utf8"), // 注意：盐按 UTF-8 文本参与运算，与浏览器端一致
        iterations,
        DEFAULTS.dkLen,
        "sha256"
    ).toString("hex");

    const username = args.flags.user || DEFAULTS.user;
    const displayName = args.flags.displayName || DEFAULTS.displayName;
    const role = args.flags.role || DEFAULTS.role;

    // 自校验：确保刚算出来的值和浏览器里算的完全一致
    const jsHex = loadPureJsPbkdf2()(password, salt, iterations, DEFAULTS.dkLen);
    if (jsHex !== hash) {
        console.error("⚠️ 自校验失败：Node 与浏览器端实现结果不一致，请检查 assets/js/auth.js");
        console.error(`   node: ${hash}\n   js  : ${jsHex}`);
        process.exit(1);
    }

    console.log(`
============================================================
把下面这段追加到 hugo.toml（可以有任意多个账号）：

[[params.auth.users]]
  username = "${username}"
  displayName = "${displayName}"
  role = "${role}"
  salt = "${salt}"
  hash = "${hash}"
  iterations = ${iterations}
============================================================
${args.flags.generate ? `本次随机生成的口令（请立刻转告本人，脚本不再保存）：\n\n    ${password}\n` : ""}算法：PBKDF2-HMAC-SHA256 / ${iterations} 次迭代 / 16 字节随机盐 / 32 字节输出
（已验证与 assets/js/auth.js 的浏览器端实现结果一致 ✅）
口令核对命令：node tools/hash-password.mjs --check ${username} '${password}'

提醒：
  1. TOML 里放的是哈希，不是明文；但这个哈希对任何访客都是公开的，
     强度取决于密码本身 + iterations，请务必用长一点的密码。
  2. 想再换密码：重跑本脚本，替换 salt / hash / iterations 三行即可。
  3. 已在线的访客不会立刻掉线（登录态有有效期），必要时让他在页头点「退出登录」。
`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

// 仅为消除未使用告警：timingSafeEqual 供使用者自行扩展高级校验时取用
void timingSafeEqual;
