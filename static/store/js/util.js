// ---------------------------------------------------------------------------
// util.js — 数学、程序化纹理、几何体小工具
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const JP_FONT = '"Yu Gothic", "Yu Gothic UI", "Meiryo", "MS Gothic", "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 纹理
// ---------------------------------------------------------------------------
export let MAX_ANISO = 8;
export function setMaxAnisotropy(v) { MAX_ANISO = Math.max(1, v); }

export function canvasTexture(w, h, draw, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(MAX_ANISO, 8);
  if (opts.wrap) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  if (opts.repeat) { tex.repeat.set(opts.repeat[0], opts.repeat[1]); }
  if (opts.nearest) { tex.magFilter = THREE.NearestFilter; }
  tex.needsUpdate = true;
  return tex;
}

/** 用 canvas 生成一块带霓虹文字的灯箱贴图 */
export function signTexture({
  width = 1024, height = 256, bg = '#f6f2e6', color = '#1f6b4f',
  lines = [], font = JP_FONT, align = 'center', padding = 28, draw = null, border = null,
} = {}) {
  return canvasTexture(width, height, (ctx, w, h) => {
    if (bg === 'transparent') ctx.clearRect(0, 0, w, h);
    else { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    if (border) {
      ctx.strokeStyle = border; ctx.lineWidth = Math.max(2, w * 0.008);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
    }
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    const x = align === 'left' ? padding : w / 2;
    for (const line of lines) {
      if (line.rotate) { ctx.save(); ctx.translate(x, line.y * h); ctx.rotate(line.rotate); ctx.fillStyle = line.color || color; ctx.font = line.font || font; ctx.fillText(line.text, 0, 0); ctx.restore(); continue; }
      ctx.fillStyle = line.color || color;
      ctx.font = line.font || font;
      if (line.shadow) { ctx.shadowColor = line.shadow; ctx.shadowBlur = line.shadowBlur || 24; }
      ctx.fillText(line.text, x, line.y * h);
      ctx.shadowBlur = 0;
    }
    if (draw) draw(ctx, w, h);
  }, { wrap: false });
}

/** 垂直文字灯箱（日式竖排招牌） */
export function verticalSignTexture({ width = 256, height = 1024, bg = '#0f3a2c', color = '#f7f3e3', text = 'さくらマート', sub = '24H' } = {}) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    const chars = Array.from(text);
    const step = (h - 190) / chars.length;
    ctx.font = `700 ${Math.min(96, step * 0.82)}px ${JP_FONT}`;
    chars.forEach((c, i) => ctx.fillText(c, w / 2, 74 + step * (i + 0.5)));
    ctx.fillStyle = 'rgba(247,243,227,0.72)';
    ctx.font = `600 34px ${JP_FONT}`;
    ctx.fillText(sub, w / 2, h - 62);
    ctx.strokeStyle = 'rgba(247,243,227,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, w - 28, h - 28);
  });
}

// ---------------------------------------------------------------------------
// 噪声
// ---------------------------------------------------------------------------
function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm2(x, y, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq);
    norm += amp; amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// 几何体
// ---------------------------------------------------------------------------
export function roundedRectShape(w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

const roundedCache = new Map();
/** 宽 w / 高 h / 厚 d，挤出方向为 +z，原点居中 */
export function roundedBoxGeometry(w, h, d, r = 0.04, seg = 2) {
  const key = [w, h, d, r, seg].map((n) => n.toFixed(3)).join('|');
  if (roundedCache.has(key)) return roundedCache.get(key).clone();
  const rr = Math.min(r, Math.min(w, h) / 2 - 0.001, d / 2 - 0.001);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * rr, h - 2 * rr, r), {
    depth: Math.max(0.001, d - 2 * rr), bevelEnabled: true, bevelThickness: rr, bevelSize: rr,
    bevelSegments: seg, curveSegments: 4, steps: 1,
  });
  geo.center();
  geo.computeVertexNormals();
  roundedCache.set(key, geo);
  return geo.clone();
}

export function mesh(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  return m;
}

export function box(w, h, d, mat, pos = [0, 0, 0], rot) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, pos, rot);
}

export function castShadow(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; }
  });
  return obj;
}

/** 简单的地面/墙面材质工厂 */
export function stdMat(params) {
  return new THREE.MeshStandardMaterial(params);
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}
