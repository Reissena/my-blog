// ---------------------------------------------------------------------------
// snowcover.js — shared snow-cover materials + accumulation control
//   * white toon snow caps for roofs / props / trees
//   * patchy ground snow with transparent gaps
//   * setSnowAmount(0..1) fades / hides the whole cover
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { canvasTexture, toon } from './toon.js';

function capTexture() {
  const rnd = mulberry32(3311);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f3f8ff';
    ctx.fillRect(0, 0, w, h);
    // soft blue shadow pools in the snow
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 20 + rnd() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(190,210,234,' + (0.10 + rnd() * 0.12) + ')');
      g.addColorStop(1, 'rgba(190,210,234,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // fine sparkle / grain
    for (let i = 0; i < 2200; i++) {
      const a = rnd() * 0.14;
      ctx.fillStyle = rnd() > 0.55
        ? 'rgba(255,255,255,' + a + ')'
        : 'rgba(176,198,224,' + a + ')';
      const s = 0.6 + rnd() * 1.8;
      ctx.fillRect(rnd() * w, rnd() * h, s, s);
    }
  }, { wrap: true, repeat: [3, 3] });
}

function patchTexture() {
  const rnd = mulberry32(8821);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // nearly continuous snow blanket
    ctx.fillStyle = 'rgba(243,249,255,0.95)';
    ctx.fillRect(0, 0, w, h);
    // soft blue drifts
    for (let i = 0; i < 34; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 24 + rnd() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(191,211,234,' + (0.08 + rnd() * 0.1) + ')');
      g.addColorStop(1, 'rgba(191,211,234,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // compaction trails / paw prints (slightly grey, still snow)
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = 'rgba(176,194,214,' + (0.08 + rnd() * 0.12) + ')';
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 7 + rnd() * 22, 3 + rnd() * 7, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // a few small, low-contrast melt holes
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.10 + rnd() * 0.12) + ')';
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 3 + rnd() * 7, 2 + rnd() * 5, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // fresh grains / sparkle
    for (let i = 0; i < 1400; i++) {
      const white = rnd() > 0.45;
      ctx.fillStyle = white
        ? 'rgba(255,255,255,' + (0.16 + rnd() * 0.4) + ')'
        : 'rgba(184,203,224,' + (0.06 + rnd() * 0.12) + ')';
      const sz = 0.6 + rnd() * 1.7;
      ctx.fillRect(rnd() * w, rnd() * h, sz, sz);
    }
  }, { wrap: true, repeat: [4, 4] });
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const snowCapMaterial = toon(0xf1f7ff, {
  map: capTexture(),
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
});
snowCapMaterial.visible = false;

export const snowGroundMaterial = toon(0xf3f9ff, {
  map: patchTexture(),
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
});
snowGroundMaterial.visible = false;

export function setSnowAmount(v) {
  const a = Math.max(0, Math.min(1, v));
  snowCapMaterial.opacity = a * 0.97;
  snowGroundMaterial.opacity = a * 0.94;
  snowCapMaterial.visible = a > 0.01;
  snowGroundMaterial.visible = a > 0.01;
}

/** Convenience: create a snow cap mesh (shared cap material). */
export function snowCap(geo, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geo, snowCapMaterial);
  m.position.set(x, y, z);
  if (opts.rotation) m.rotation.set(opts.rotation[0], opts.rotation[1], opts.rotation[2]);
  if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  m.castShadow = false;
  m.receiveShadow = false;
  m.renderOrder = 3;
  return m;
}