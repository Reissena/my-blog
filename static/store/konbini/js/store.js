// ---------------------------------------------------------------------------
// store.js — the corner konbini: glowing shell, dense warm interior,
//             procedural light-box signage, rain-streaked glass, auto doors
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { snowCapMaterial } from './snowcover.js';
import {
  toon, addBox, addCyl, addPlane, addMesh, addOutline,
  addGlow, addLightPool, canvasTexture, roundRect, drawText,
  instancedMesh, boxGeo, planeGeo, cylGeo, mulberry32, damp, JP_FONT,
} from './toon.js';

/* --------------------------------------------------------------------------
   palette
   -------------------------------------------------------------------------- */
const P = {
  cream: 0xe4d8c1,
  cream2: 0xd4c5aa,
  teal: 0x1f5f63,
  teal2: 0x2a8e88,
  coral: 0xd6604b,
  yellow: 0xf0c14e,
  navy: 0x1b2a42,
  frame: 0x262b35,
  dark: 0x1a1f28,
  stone: 0x6a7280,
  roof: 0x39404d,
  innerWall: 0xe8dcc4,
  innerFloor: 0xcdbfa8,
  wood: 0x8f5e40,
  shelf: 0xb9a581,
  metal: 0xaab3bd,
};

const rnd = mulberry32(778899);

/* --------------------------------------------------------------------------
   textures
   -------------------------------------------------------------------------- */
function signTexture() {
  return canvasTexture(2048, 144, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#fbf3e2');
    grad.addColorStop(1, '#ecdfc6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // bottom colour stripes
    ctx.fillStyle = '#f1c24f'; ctx.fillRect(0, h - 34, w, 10);
    ctx.fillStyle = '#d6604b'; ctx.fillRect(0, h - 24, w, 10);
    ctx.fillStyle = '#2a8e88'; ctx.fillRect(0, h - 14, w, 14);
    // logo
    ctx.fillStyle = '#1b2a42';
    ctx.beginPath(); ctx.arc(88, 58, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f7f0df';
    drawText(ctx, 'K', 88, 62, 50, '#f7f0df');
    ctx.fillStyle = '#1b2a42';
    drawText(ctx, 'KONBINI', 152, 52, 68, '#1b2a42', { align: 'left' });
    drawText(ctx, 'コンビニエンスストア', 156, 103, 25, '#5c6a78', { align: 'left' });
    // right block
    ctx.fillStyle = '#1b2a42';
    drawText(ctx, 'OPEN', 1530, 42, 26, '#2a8e88', { align: 'right' });
    drawText(ctx, '24 HOURS', 1980, 60, 46, '#1b2a42', { align: 'right' });
    ctx.fillStyle = 'rgba(42,142,136,0.5)';
    ctx.fillRect(1530, 84, 450, 3);
    drawText(ctx, 'あんしん あんぜん', 1980, 108, 22, '#7b858e', { align: 'right' });
  });
}

function pylonTexture() {
  return canvasTexture(320, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#f8f1e2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b2a42'; ctx.fillRect(0, 0, w, 170);
    ctx.fillStyle = '#f8f1e2';
    drawText(ctx, 'K', w / 2, 80, 92, '#f8f1e2');
    drawText(ctx, 'KONBINI', w / 2, 146, 24, '#dfe6ee', { letterSpacing: '2px' });
    const chars = ['コ', 'ン', 'ビ', 'ニ'];
    for (let i = 0; i < chars.length; i++) {
      drawText(ctx, chars[i], w / 2, 250 + i * 104, 74, '#1b2a42');
    }
    ctx.fillStyle = '#2a8e88'; ctx.fillRect(0, 702, w, 12);
    ctx.fillStyle = '#d6604b'; ctx.fillRect(0, 718, w, 12);
    ctx.fillStyle = '#f1c24f'; ctx.fillRect(0, 734, w, 12);
    drawText(ctx, '24H', w / 2, 860, 92, '#1b2a42');
    drawText(ctx, 'OPEN', w / 2, 948, 30, '#5c6a78', { letterSpacing: '4px' });
    ctx.fillStyle = '#1b2a42'; ctx.fillRect(0, h - 26, w, 26);
  });
}

function floorTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#a89a84'; ctx.fillRect(0, 0, w, h);
    const n = 4, cell = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const g = 160 + Math.floor(rnd() * 14);
        ctx.fillStyle = 'rgb(' + g + ',' + (g - 8) + ',' + (g - 22) + ')';
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, 2);
      }
    }
    ctx.strokeStyle = 'rgba(160,147,128,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(w, i * cell); ctx.stroke();
    }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(140,128,110,' + (rnd() * 0.06) + ')';
      ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    }
  }, { wrap: true, repeat: [5, 5] });
}

function magazineTexture() {
  return canvasTexture(768, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c9bda6'; ctx.fillRect(0, 0, w, h);
    const cols = ['#d8604b', '#2a8e88', '#e8b84c', '#4d6db3', '#d4cfc2', '#b95c84', '#5f8f62', '#e8ddc4'];
    const cw = w / 4, ch = h / 2;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * cw + 10, y = r * ch + 10;
        ctx.fillStyle = cols[(r * 4 + c) % cols.length];
        ctx.fillRect(x, y, cw - 20, ch - 20);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x + 12, y + 14, cw - 44, 12);
        ctx.fillRect(x + 12, y + 32, (cw - 44) * 0.7, 7);
        ctx.fillStyle = 'rgba(20,26,36,0.7)';
        ctx.fillRect(x + 14, y + ch - 70, cw - 48, 40);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(x + 20, y + ch - 58, (cw - 60) * 0.7, 6);
      }
    }
  });
}

function promoPoster(kind) {
  return canvasTexture(320, 480, (ctx, w, h) => {
    if (kind === 2) {
      ctx.fillStyle = '#1e2a45'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f1c24f';
      drawText(ctx, 'HOT', w / 2, 120, 96, '#f1c24f');
      ctx.fillStyle = '#f4e7d0';
      ctx.beginPath(); ctx.arc(w / 2, 270, 92, 0, Math.PI, false); ctx.fill();
      ctx.fillRect(w / 2 - 92, 270, 184, 16);
      ctx.strokeStyle = '#f4e7d0'; ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 - 40 + i * 40, 236);
        ctx.bezierCurveTo(w / 2 - 56 + i * 40, 200, w / 2 - 26 + i * 40, 188, w / 2 - 40 + i * 40, 158);
        ctx.stroke();
      }
      drawText(ctx, 'あつあつ', w / 2, 350, 34, '#dbe4f2');
      ctx.fillStyle = '#d6604b'; ctx.fillRect(0, h - 58, w, 58);
      drawText(ctx, '新発売', w / 2, h - 28, 32, '#fff4e6');
    } else {
      ctx.fillStyle = '#2a8e88'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f6ecd8';
      roundRect(ctx, 26, 26, w - 52, h - 52, 18); ctx.fill();
      ctx.fillStyle = '#d6604b';
      ctx.beginPath(); ctx.arc(w / 2, 128, 56, 0, Math.PI * 2); ctx.fill();
      drawText(ctx, '¥100', w / 2, 130, 32, '#fff1de');
      ctx.fillStyle = '#f0c14e';
      drawText(ctx, 'COFFEE', w / 2, 236, 50, '#1b2a42');
      drawText(ctx, 'HOT & ICE', w / 2, 286, 24, '#6a5b4a');
      ctx.fillStyle = '#1b2a42';
      ctx.fillRect(46, 330, w - 92, 4);
      drawText(ctx, 'いつでも できたて', w / 2, 380, 24, '#2a8e88');
    }
  });
}

function hangerTexture() {
  return canvasTexture(640, 240, (ctx, w, h) => {
    ctx.fillStyle = '#1f5f63'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8fd7ca'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, w - 20, h - 20);
    drawText(ctx, 'OPEN', w / 2, 92, 86, '#f4f1e4');
    drawText(ctx, '24 HOURS', w / 2, 172, 34, '#a9e0d4', { letterSpacing: '4px' });
    ctx.fillStyle = '#f0c14e'; ctx.fillRect(50, 200, w - 100, 5);
  });
}


function menuTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#132a36'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f4a4c'; ctx.fillRect(0, 0, w, 54);
    drawText(ctx, 'HOT FOOD / COFFEE', 36, 28, 30, '#e9f3ec', { align: 'left' });
    ctx.fillStyle = '#f0c14e'; ctx.fillRect(0, 54, w, 5);
    const items = [
      ['からあげ', '#d6604b', '¥220'],
      ['おでん', '#e8a33e', '¥120'],
      ['ホット', '#8f5e40', '¥150'],
      ['COFFEE', '#c9b696', '¥100'],
    ];
    for (let i = 0; i < items.length; i++) {
      const x = 34 + i * 246;
      ctx.fillStyle = items[i][1];
      roundRect(ctx, x, 82, 84, 84, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + 10, 92, 64, 8);
      drawText(ctx, items[i][0], x + 42, 194, 27, '#f0f5ee');
      drawText(ctx, items[i][2], x + 42, 226, 20, '#f0c14e');
    }
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 4; i++) ctx.fillRect(18 + i * 246, 72, 2, 168);
  });
}

function doorStickerTexture() {
  return canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(31,95,99,0.92)'; ctx.fillRect(0, 0, w, h);
    drawText(ctx, 'AUTOMATIC DOOR', w / 2, 40, 26, '#e9f4ef');
    drawText(ctx, '自動ドア', w / 2, 74, 24, '#a9e0d4');
  });
}

function floorGuideTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    function arrow(x, y, s, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - 70 * s);
      ctx.lineTo(x + 44 * s, y - 6 * s);
      ctx.lineTo(x + 16 * s, y - 6 * s);
      ctx.lineTo(x + 16 * s, y + 62 * s);
      ctx.lineTo(x - 16 * s, y + 62 * s);
      ctx.lineTo(x - 16 * s, y - 6 * s);
      ctx.lineTo(x - 44 * s, y - 6 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.92;
    arrow(150, 250, 1.15, '#2a8e88');
    arrow(340, 300, 0.9, '#e8c24c');
  });
}

function coffeePanelTexture() {
  return canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#20262e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a4450'; ctx.fillRect(18, 18, w - 36, 70);
    ctx.fillStyle = '#9fe0d4'; ctx.fillRect(30, 32, 62, 42);
    drawText(ctx, 'COFFEE', w / 2, 58, 32, '#e9f2ef');
    const cols = ['#d6604b', '#f0c14e', '#2a8e88', '#cfd8df'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.arc(46 + i * 55, 130, 17, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#11161c';
    roundRect(ctx, 36, 176, w - 72, 44, 10); ctx.fill();
    ctx.fillStyle = '#8fb7a9'; ctx.fillRect(52, 190, w - 104, 4);
    ctx.fillStyle = '#f4e9d4'; ctx.fillRect(48, 248, 60, 44);
    drawText(ctx, 'HOT', w / 2 + 40, 276, 26, '#e0e8ee');
  });
}

function registerTexture() {
  return canvasTexture(256, 192, (ctx, w, h) => {
    ctx.fillStyle = '#0f1a2a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1c3a50'; ctx.fillRect(0, 0, w, 28);
    drawText(ctx, 'POS', w / 2, 15, 15, '#9fd8e8');
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = (r + c) % 3 === 0 ? '#2a8e88' : '#233140';
        roundRect(ctx, 14 + c * 58, 44 + r * 42, 48, 32, 5); ctx.fill();
      }
    }
    ctx.fillStyle = '#f0c14e'; ctx.fillRect(14, 170, 88, 9);
  });
}

function staffTexture() {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1b2a42'; ctx.fillRect(0, 0, w, h);
    drawText(ctx, 'STAFF ONLY', w / 2, 52, 40, '#e8eee8', { letterSpacing: '3px' });
    drawText(ctx, '関係者以外 立入禁止', w / 2, 96, 24, '#9fb0bd');
  });
}

function coldStripTexture() {
  return canvasTexture(2048, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e9fbf3'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a8e88'; ctx.fillRect(0, 0, w, 12);
    ctx.fillStyle = '#1f8f9a'; ctx.fillRect(0, h - 12, w, 12);
    drawText(ctx, 'COLD  DRINKS', 60, 70, 58, '#1b3a48', { align: 'left' });
    drawText(ctx, 'つめた〜い', w - 60, 72, 30, '#3b7d78', { align: 'right' });
    ctx.fillStyle = '#f0c14e';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(760 + i * 34, 64, 8, 0, Math.PI * 2); ctx.fill(); }
  });
}

function glassStreakTexture() {
  const r2 = mulberry32(5544);
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 235; i++) {
      const x = r2() * w;
      const y = r2() * h;
      const len = 24 + r2() * 190;
      const width = 0.6 + r2() * 1.9;
      const alpha = 0.035 + r2() * 0.12;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(185,220,255,0)');
      g.addColorStop(0.3, 'rgba(198,228,255,' + alpha + ')');
      g.addColorStop(0.72, 'rgba(225,243,255,' + alpha * 0.75 + ')');
      g.addColorStop(1, 'rgba(185,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, width, len);
    }
    for (let i = 0; i < 120; i++) {
      const x = r2() * w, y = r2() * h;
      const a = 0.04 + r2() * 0.12;
      ctx.fillStyle = 'rgba(220,240,255,' + a + ')';
      ctx.beginPath(); ctx.ellipse(x, y, 1.1 + r2() * 1.6, 1.6 + r2() * 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }, { wrap: true, repeat: [3, 1] });
}

function glassSheenTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    let g = ctx.createLinearGradient(0, 0, w * 0.9, h);
    g.addColorStop(0, 'rgba(170,208,255,0.20)');
    g.addColorStop(0.28, 'rgba(170,208,255,0.02)');
    g.addColorStop(0.52, 'rgba(205,232,255,0.12)');
    g.addColorStop(0.68, 'rgba(205,232,255,0.0)');
    g.addColorStop(1, 'rgba(150,190,240,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const sheen = ctx.createLinearGradient(w * 0.15, h, w * 0.55, 0);
    sheen.addColorStop(0, 'rgba(230,245,255,0)');
    sheen.addColorStop(0.5, 'rgba(230,245,255,0.10)');
    sheen.addColorStop(1, 'rgba(230,245,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
  });
}

function awningTexture() {
  return canvasTexture(768, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efe3cc'; ctx.fillRect(0, 0, w, h);
    const stripes = ['#2a8e88', '#efe3cc', '#d6604b', '#efe3cc', '#2a8e88', '#efe3cc'];
    const sw = w / 12;
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = stripes[i % stripes.length];
      ctx.fillRect(i * sw, 0, sw, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, i * 42, w, 2);
    ctx.fillStyle = 'rgba(20,30,40,0.08)';
    ctx.fillRect(0, h - 18, w, 18);
  }, { wrap: true, repeat: [2, 1] });
}

function matTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2b3038'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#9aa7b0'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, w - 10, h - 10);
    drawText(ctx, 'KONBINI', w / 2, 60, 30, '#cfd8d8', { letterSpacing: '3px' });
    drawText(ctx, 'ようこそ', w / 2, 96, 18, '#8b979d');
  });
}

/* --------------------------------------------------------------------------
   build
   -------------------------------------------------------------------------- */
export function buildStore(scene) {
  const g = new THREE.Group();
  g.name = 'konbini';
  g.position.set(0, 0.30, 0);
  scene.add(g);

  const mat = {
    cream: toon(P.cream),
    cream2: toon(P.cream2),
    teal: toon(P.teal),
    teal2: toon(P.teal2),
    coral: toon(P.coral),
    yellow: toon(P.yellow),
    navy: toon(P.navy),
    frame: toon(P.frame),
    dark: toon(P.dark),
    roof: toon(P.roof),
    innerWall: toon(P.innerWall),
    innerFloor: toon(0xffffff, { map: floorTexture() }),
    wood: toon(P.wood),
    shelf: toon(P.shelf),
    metal: toon(P.metal),
    stone: toon(P.stone),
    glass: new THREE.MeshBasicMaterial({
      color: 0x9fd0ec, transparent: true, opacity: 0.085, depthWrite: false, side: THREE.DoubleSide,
    }),
    glassDoor: new THREE.MeshBasicMaterial({
      color: 0xd7f1ff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
    }),
    warmLight: new THREE.MeshBasicMaterial({ color: 0xfff4db }),
    coolLight: new THREE.MeshBasicMaterial({ color: 0xeafff5 }),
    broth: toon(0xd9772f, { emissive: 0xff9a3c, emissiveIntensity: 0.75 }),
  };

  const W = 10.0;             // exterior width  (x -6 .. 4)
  const D = 9.2;              // exterior depth  (z -7.2 .. 2)
  const X0 = -6, X1 = 4, Z0 = -7.2, Z1 = 2;
  const H = 4.3;              // wall top
  const GLASS_TOP = 2.86;
  const signMats = [];

  /* ---------------- plinth / floor ---------------- */
  addBox(g, W + 0.5, 0.14, D + 0.5, mat.stone, -1, -0.14, -2.6, { cast: true, receive: true, line: 0.02 });
  addBox(g, W - 0.15, 0.02, D - 0.15, mat.innerFloor, -1, 0.0, -2.6, { receive: true });

  /* ---------------- exterior walls ---------------- */
  // back wall
  addBox(g, W, H, 0.22, mat.cream, -1, 0, Z0 - 0.11, { cast: true, receive: true, line: 0.025 });
  // left wall
  addBox(g, 0.22, H, D, mat.cream, X0 - 0.11, 0, -2.6, { cast: true, receive: true, line: 0.025 });
  // wall bands above the glazing
  addBox(g, W - 0.1, 0.62, 0.1, mat.cream, -1, GLASS_TOP, Z1 - 0.05, { cast: true });
  addBox(g, 0.1, 0.62, D - 0.1, mat.cream, X1 - 0.05, GLASS_TOP, -2.6, { cast: true });
  // teal band
  addBox(g, W - 0.12, 0.13, 0.08, mat.teal, -1, 3.45, Z1 - 0.035, { cast: false });
  addBox(g, 0.08, 0.13, D - 0.12, mat.teal, X1 - 0.035, 3.45, -2.6, { cast: false });
  // corner column
  addBox(g, 0.32, 3.55, 0.32, mat.cream, 3.9, 0, 1.9, { cast: true, line: 0.025 });
  addBox(g, 0.36, 0.22, 0.36, mat.frame, 3.9, 0.0, 1.9);

  // exterior base trim (dark kick)
  addBox(g, W + 0.02, 0.22, 0.08, mat.frame, -1, 0.0, Z1 - 0.02, { cast: false });
  addBox(g, 0.08, 0.22, D, mat.frame, X1 - 0.02, 0.0, -2.6, { cast: false });

  /* ---------------- window sill / frames ---------------- */
  addBox(g, W - 0.3, 0.12, 0.26, mat.stone, -1, 0.0, Z1 + 0.06, { cast: true, receive: true });
  addBox(g, 0.26, 0.12, D - 0.2, mat.stone, X1 + 0.06, 0.0, -2.6, { cast: true, receive: true });

  const frontMullions = [-5.9, -4.4, -2.9, -2.35, 0.35, 1.85, 3.3, 3.8];
  for (const x of frontMullions) {
    addBox(g, 0.1, GLASS_TOP - 0.08, 0.18, mat.frame, x, 0.06, Z1 - 0.04, { cast: true });
  }
  const sideMullions = [-7.1, -5.5, -3.9, -2.3, -0.7, 0.9, 1.8];
  for (const z of sideMullions) {
    addBox(g, 0.18, GLASS_TOP - 0.08, 0.1, mat.frame, X1 - 0.04, 0.06, z, { cast: true });
  }
  addBox(g, W - 0.2, 0.1, 0.2, mat.frame, -1, GLASS_TOP - 0.04, Z1 - 0.04);
  addBox(g, 0.2, 0.1, D - 0.2, mat.frame, X1 - 0.04, GLASS_TOP - 0.04, -2.6);
  addBox(g, W - 0.2, 0.12, 0.2, mat.frame, -1, 0.06, Z1 - 0.04);
  addBox(g, 0.2, 0.12, D - 0.2, mat.frame, X1 - 0.04, 0.06, -2.6);

  /* ---------------- glass panes ---------------- */
  function pane(w, h, x, y, z, rotY = 0, material = mat.glass) {
    const p = addPlane(g, w, h, material, x, y, z, { rot: [0, rotY, 0], receive: false });
    p.renderOrder = 4;
    return p;
  }
  // front fixed panes (the middle is the door)
  pane(3.55, GLASS_TOP - 0.16, -4.125, 0.1 + (GLASS_TOP - 0.16) / 2, Z1 - 0.005);
  pane(3.45, GLASS_TOP - 0.16, 2.075, 0.1 + (GLASS_TOP - 0.16) / 2, Z1 - 0.005);
  // side glass
  pane(D - 0.2, GLASS_TOP - 0.16, X1 - 0.005, 0.1 + (GLASS_TOP - 0.16) / 2, -2.65, Math.PI / 2);

  /* ---------------- rain streaks on the glass ---------------- */
  const streakTex = glassStreakTexture();
  const streakMat = new THREE.MeshBasicMaterial({
    map: streakTex, transparent: true, opacity: 0.26, blending: THREE.NormalBlending,
    depthWrite: false, toneMapped: false, color: 0xcfe6ff,
  });
  const sheenMat = new THREE.MeshBasicMaterial({
    map: glassSheenTexture(), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const streakMeshes = [];
  function streak(w, h, x, y, z, rotY = 0) {
    const m = addPlane(g, w, h, streakMat, x, y, z, { rot: [0, rotY, 0], receive: false });
    m.renderOrder = 6;
    streakMeshes.push(m);
    return m;
  }
  // soft static sheen
  {
    const s1 = addPlane(g, 3.55, GLASS_TOP - 0.16, sheenMat, -4.125, 0.1 + (GLASS_TOP - 0.16) / 2, Z1 + 0.006);
    s1.renderOrder = 5;
    const s2 = addPlane(g, 3.45, GLASS_TOP - 0.16, sheenMat, 2.075, 0.1 + (GLASS_TOP - 0.16) / 2, Z1 + 0.006);
    s2.renderOrder = 5;
    const s3 = addPlane(g, D - 0.2, GLASS_TOP - 0.16, sheenMat, X1 + 0.006, 0.1 + (GLASS_TOP - 0.16) / 2, -2.65, { rot: [0, Math.PI / 2, 0] });
    s3.renderOrder = 5;
  }
  streak(3.5, GLASS_TOP - 0.18, -4.125, 0.1 + (GLASS_TOP - 0.18) / 2, Z1 + 0.012);
  streak(3.4, GLASS_TOP - 0.18, 2.075, 0.1 + (GLASS_TOP - 0.18) / 2, Z1 + 0.012);
  streak(D - 0.25, GLASS_TOP - 0.18, X1 + 0.012, 0.1 + (GLASS_TOP - 0.18) / 2, -2.65, Math.PI / 2);

  /* ---------------- storefront poster taped inside ---------------- */
  addPlane(g, 0.56, 0.82, new THREE.MeshBasicMaterial({ map: promoPoster(2), side: THREE.DoubleSide }),
    2.55, 1.95, Z1 + 0.014);

  /* ---------------- awning ---------------- */
  {
    const aw = new THREE.Group();
    g.add(aw);
    // sloped canopy
    const awningMat = toon(0xffffff, { map: awningTexture() });
    const canopy = addBox(aw, 4.9, 0.1, 1.5, awningMat, -1.0, 3.02, 2.72, { cast: true, line: 0.02 });
    canopy.rotation.x = -0.09;
    // fascia
    addBox(aw, 4.9, 0.26, 0.12, mat.cream, -1.0, 2.9, 3.42, { cast: true });
    addBox(aw, 5.0, 0.075, 0.13, mat.teal, -1.0, 2.86, 3.43, { cast: false });
    addBox(aw, 5.0, 0.035, 0.13, mat.coral, -1.0, 3.03, 3.43, { cast: false });
    // dark soffit with recessed downlights
    addBox(aw, 4.8, 0.022, 1.42, mat.teal, -1.0, 2.955, 2.72);
    for (let i = 0; i < 4; i++) {
      const lx = -2.7 + i * 1.2;
      addCyl(aw, 0.075, 0.075, 0.018, 10, mat.warmLight, lx, 2.946, 3.18);
      addGlow(aw, 0xffd6a0, 0.55, lx, 2.94, 3.2, 0.35);
    }
    // warm strip under awning
    addBox(aw, 4.4, 0.045, 0.1, mat.warmLight, -1.0, 2.9, 3.28);
    addGlow(aw, 0xffd7a0, 2.6, -1.0, 2.86, 3.28, 0.2);
    // support rods
    function rod(a, b, r, material) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const dir = vb.clone().sub(va);
      const m = new THREE.Mesh(cylGeo(r, r, dir.length(), 8), material);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      m.castShadow = true;
      aw.add(m);
    }
    rod([-3.25, 2.55, 2.02], [-3.25, 3.0, 3.34], 0.028, mat.frame);
    rod([1.25, 2.55, 2.02], [1.25, 3.0, 3.34], 0.028, mat.frame);
    addLightPool(g, 0xffb877, 5.4, 2.7, -1.0, -0.132, 3.2, 0.24);
  }

  /* ---------------- door step + mat ---------------- */
  addBox(g, 2.9, 0.14, 0.42, mat.stone, -1.0, -0.14, 2.22, { receive: true, cast: false });
  addBox(g, 2.96, 0.015, 0.05, mat.metal, -1.0, -0.005, 2.41, { cast: false });
  {
    const mt = matTexture();
    addBox(g, 2.3, 0.018, 0.96, mat.dark, -1.0, -0.14, 2.95);
    addPlane(g, 2.3, 0.96, new THREE.MeshBasicMaterial({ map: mt }), -1.0, -0.118, 2.95, { rot: [-Math.PI / 2, 0, 0] });
  }

  /* ---------------- umbrella stand ---------------- */
  {
    const ug = new THREE.Group();
    ug.position.set(-3.45, 0.16, 2.62);
    scene.add(ug);
    addBox(ug, 0.6, 0.1, 0.44, mat.metal, 0, 0, 0, { cast: true, line: 0.012 });
    for (const [x, z] of [[-0.26, -0.17], [0.26, -0.17], [-0.26, 0.17], [0.26, 0.17]]) {
      addCyl(ug, 0.018, 0.018, 0.66, 6, mat.frame, x, 0.1, z);
    }
    addBox(ug, 0.56, 0.035, 0.38, mat.frame, 0, 0.74, 0);
    const colors = [0x2a8e88, 0xd6604b, 0xf0c14e, 0xe8e2d2];
    for (let i = 0; i < 4; i++) {
      const ux = -0.18 + (i % 2) * 0.36;
      const uz = -0.11 + Math.floor(i / 2) * 0.22;
      const u = new THREE.Group();
      u.position.set(ux, 0.12, uz);
      u.rotation.z = (i - 1.5) * 0.05;
      ug.add(u);
      addCyl(u, 0.012, 0.012, 0.86, 6, mat.metal, 0, 0, 0);
      addMesh(u, new THREE.ConeGeometry(0.15, 0.34, 8, 1, true), toon(colors[i]),
        0, 0.72, 0, { cast: true, line: 0.012 });
      addMesh(u, new THREE.TorusGeometry(0.055, 0.012, 4, 8, Math.PI), toon(0x3a3f47),
        0, 0.02, 0, { rot: [0, 0, 0] });
    }
  }

  /* ---------------- interior: ceiling + floor guide ---------------- */
  addBox(g, W - 0.3, 0.08, D - 0.3, mat.innerWall, -1, 3.0, -2.6, { receive: true });
  const lightPanels = [
    [-3.4, -5.6], [-0.4, -4.2], [2.6, -5.2], [1.4, -1.4],
  ];
  for (const [x, z] of lightPanels) {
    addBox(g, 1.5, 0.035, 0.42, mat.warmLight, x, 2.955, z);
    addGlow(g, 0xffe9c4, 1.3, x, 2.9, z, 0.1);
  }
  // floor guide
  addPlane(g, 3.0, 2.0, new THREE.MeshBasicMaterial({
    map: floorGuideTexture(), transparent: true, depthWrite: false, opacity: 0.9,
  }), 0.4, 0.027, 0.9, { rot: [-Math.PI / 2, 0, 0] });

  /* ---------------- interior back wall detailing ---------------- */
  addBox(g, 0.02, 0.1, D - 0.4, mat.cream2, X0 + 0.005, 0.02, -2.6);
  addBox(g, W - 0.5, 0.9, 0.02, mat.cream2, -1, 0.02, Z0 + 0.005);
  // staff door
  addBox(g, 1.15, 2.15, 0.08, mat.teal, 0.95, 0, Z0 + 0.03, { line: 0.012 });
  addPlane(g, 0.46, 0.4, mat.glassDoor, 0.95, 1.5, Z0 + 0.075);
  addBox(g, 0.68, 0.045, 0.045, mat.metal, 0.95, 0.95, Z0 + 0.08);
  addBox(g, 1.24, 0.12, 0.12, mat.frame, 0.95, 2.15, Z0 + 0.02);
  addBox(g, 0.07, 0.07, 0.12, mat.metal, 1.42, 1.0, Z0 + 0.08);
  addBox(g, 0.34, 0.2, 0.01, mat.frame, 0.95, 2.28, Z0 + 0.06);
  addPlane(g, 0.5, 0.13, new THREE.MeshBasicMaterial({ map: staffTexture() }), 0.95, 2.38, Z0 + 0.065);
  // small wall clock
  {
    const clock = new THREE.Group();
    clock.position.set(3.0, 2.62, Z0 + 0.02);
    g.add(clock);
    addCyl(clock, 0.2, 0.2, 0.03, 18, mat.cream2, 0, 0, 0, { rot: [Math.PI / 2, 0, 0] });
    addCyl(clock, 0.17, 0.17, 0.015, 18, mat.warmLight, 0, 0, 0.02, { rot: [Math.PI / 2, 0, 0] });
    addBox(clock, 0.012, 0.13, 0.008, mat.frame, 0, 0.06, 0.04);
    addBox(clock, 0.09, 0.012, 0.008, mat.frame, 0.04, 0.0, 0.04);
  }
  // posters on the side wall and back wall
  addPlane(g, 0.55, 0.68, new THREE.MeshBasicMaterial({ map: promoPoster(1), side: THREE.DoubleSide }),
    X0 + 0.012, 2.5, -5.3, { rot: [0, Math.PI / 2, 0] });
  addPlane(g, 0.55, 0.68, new THREE.MeshBasicMaterial({ map: promoPoster(0), side: THREE.DoubleSide }),
    X0 + 0.012, 2.5, -3.8, { rot: [0, Math.PI / 2, 0] });
  addPlane(g, 0.5, 0.66, new THREE.MeshBasicMaterial({ map: promoPoster(2) }), 2.55, 1.85, Z0 + 0.012);
  // poster above the chest freezer
  addPlane(g, 0.62, 0.9, new THREE.MeshBasicMaterial({ map: promoPoster(0), side: THREE.DoubleSide }),
    X0 + 0.012, 2.25, -0.7, { rot: [0, Math.PI / 2, 0] });

  /* ---------------- drink coolers ---------------- */
  {
    const cx0 = -5.65, cx1 = -0.6, cz = -6.66;
    const cw = cx1 - cx0;
    const cg = new THREE.Group();
    g.add(cg);
    // shell
    addBox(cg, cw, 2.4, 0.08, mat.dark, (cx0 + cx1) / 2, 0.0, -7.02);
    addBox(cg, cw, 0.12, 0.66, mat.dark, (cx0 + cx1) / 2, 0.0, cz + 0.28);
    addBox(cg, cw, 0.16, 0.66, mat.dark, (cx0 + cx1) / 2, 2.24, cz + 0.28);
    addBox(cg, 0.1, 2.4, 0.66, mat.dark, cx0, 0.0, cz + 0.28);
    addBox(cg, 0.1, 2.4, 0.66, mat.dark, cx1, 0.0, cz + 0.28);
    // glowing back panel
    const backTex = canvasTexture(256, 512, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#b7e4d2');
      gr.addColorStop(0.5, '#d7f0e2');
      gr.addColorStop(1, '#a9ddca');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(0, 40, w, 4);
    });
    addPlane(cg, cw - 0.2, 2.1, new THREE.MeshBasicMaterial({ map: backTex }), (cx0 + cx1) / 2, 1.12, -6.97);
    // shelves
    for (const y of [0.45, 0.85, 1.25, 1.65]) {
      addBox(cg, cw - 0.2, 0.035, 0.5, mat.metal, (cx0 + cx1) / 2, y, cz + 0.04);
    }
    // bottles
    const bottleTransforms = [];
    const bottleColors = [];
    const palette = [0xf2e7d0, 0xd6604b, 0x3f8fc4, 0x69a86b, 0xf0c14e, 0xd9719c, 0x6e7f9c, 0xe8eef2];
    let bi = 0;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 24; i++) {
        bottleTransforms.push({ p: [cx0 + 0.2 + i * 0.2, 0.595 + row * 0.4, cz + 0.02] });
        bottleColors.push(palette[(i + row * 3) % palette.length]);
        bi++;
      }
    }
    instancedMesh(new THREE.CylinderGeometry(0.038, 0.042, 0.22, 7), toon(0xffffff), bottleTransforms, {
      parent: cg, colors: bottleColors,
    });
    // door frames
    for (let d = 0; d < 4; d++) {
      const dx = cx0 + d * (cw / 3);
      addBox(cg, 0.05, 2.06, 0.06, mat.metal, dx, 0.18, cz + 0.61);
    }
    // glass doors
    for (let d = 0; d < 3; d++) {
      const px = cx0 + (d + 0.5) * (cw / 3);
      const doorGlass = addPlane(cg, cw / 3 - 0.08, 2.02, mat.glass, px, 1.2, cz + 0.63, { receive: false });
      doorGlass.renderOrder = 4;
      addBox(cg, 0.035, 0.28, 0.05, mat.metal, px + (d % 2 ? -1 : 1) * (cw / 6 - 0.12), 1.2, cz + 0.66);
    }
    // header sign
    addPlane(cg, cw, 0.3, new THREE.MeshBasicMaterial({ map: coldStripTexture() }), (cx0 + cx1) / 2, 2.44, cz + 0.33);
    addBox(cg, cw, 0.035, 0.12, mat.frame, (cx0 + cx1) / 2, 2.27, cz + 0.68);
  }

  /* ---------------- shelf bays along the left wall ---------------- */
  {
    const bayZ = [-5.3, -3.8, -2.3];
    const palette = [0xe9e1d0, 0xd6604b, 0x3f8fc4, 0x69a86b, 0xf0c14e, 0xd9719c, 0x4f5f7a, 0xf4e9d2];
    const productTransforms = [];
    const productColors = [];
    for (const zc of bayZ) {
      const bg = new THREE.Group();
      g.add(bg);
      addBox(bg, 0.05, 1.78, 1.48, mat.wood, -5.87, 0.02, zc);
      addBox(bg, 0.55, 0.05, 1.48, mat.shelf, -5.6, 1.74, zc);
      addBox(bg, 0.05, 1.78, 0.05, mat.shelf, -5.35, 0.02, zc - 0.72);
      addBox(bg, 0.05, 1.78, 0.05, mat.shelf, -5.35, 0.02, zc + 0.72);
      for (let s = 0; s < 3; s++) {
        const y = 0.42 + s * 0.44;
        addBox(bg, 0.54, 0.035, 1.44, mat.shelf, -5.6, y, zc);
        addBox(bg, 0.02, 0.05, 1.4, mat.metal, -5.32, y + 0.01, zc);
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i < 5; i++) {
            productTransforms.push({
              p: [-5.66 + row * 0.2, y + 0.15, zc - 0.54 + i * 0.27],
              r: [0, (i % 3 - 1) * 0.1 + row * 0.06, 0],
            });
            productColors.push(palette[(i + row * 3 + s * 2 + Math.round(zc * 2)) % palette.length]);
          }
        }
      }
      // price rail glow
      addBox(bg, 0.015, 0.02, 1.38, mat.warmLight, -5.30, 0.46, zc);
    }
    instancedMesh(boxGeo(0.15, 0.22, 0.16), toon(0xffffff), productTransforms, {
      parent: g, colors: productColors,
    });
  }

  /* ---------------- central gondola ---------------- */
  {
    const gx = -2.8, gz1 = -5.2, gz2 = -2.9;
    addBox(g, 0.9, 0.1, gz2 - gz1, mat.frame, gx, 0.0, (gz1 + gz2) / 2);
    addBox(g, 0.06, 1.32, gz2 - gz1, mat.shelf, gx, 0.1, (gz1 + gz2) / 2);
    addBox(g, 0.9, 0.05, gz2 - gz1, mat.shelf, gx, 1.36, (gz1 + gz2) / 2);
    const palette = [0xe9e1d0, 0xd6604b, 0x3f8fc4, 0x69a86b, 0xf0c14e, 0xd9719c, 0xf4e9d2];
    const transforms = [];
    const colors = [];
    for (const side of [-1, 1]) {
      for (let s = 0; s < 3; s++) {
        const y = 0.36 + s * 0.34;
        addBox(g, 0.42, 0.03, gz2 - gz1 - 0.1, mat.shelf, gx + side * 0.23, y, (gz1 + gz2) / 2);
        for (let i = 0; i < 7; i++) {
          transforms.push({ p: [gx + side * 0.23, y + 0.13, gz1 + 0.12 + i * 0.3] });
          colors.push(palette[(i + s + (side > 0 ? 3 : 0)) % palette.length]);
        }
      }
    }
    addBox(g, 0.9, 0.04, 0.05, mat.shelf, gx, 1.4, gz1 + 0.03);
    instancedMesh(boxGeo(0.13, 0.2, 0.16), toon(0xffffff), transforms, {
      parent: g, colors,
    });
  }

  /* ---------------- ice-cream chest freezer ---------------- */
  {
    const fg = new THREE.Group();
    fg.position.set(-5.25, 0, -0.7);
    g.add(fg);
    addBox(fg, 1.1, 0.78, 1.2, mat.cream2, 0, 0, 0, { cast: false, line: 0.014 });
    addBox(fg, 1.02, 0.06, 1.12, mat.glassDoor, 0, 0.78, 0);
    addBox(fg, 0.95, 0.03, 1.05, new THREE.MeshBasicMaterial({ color: 0xbdf0ff }), 0, 0.72, 0);
    addBox(fg, 1.14, 0.06, 1.24, mat.metal, 0, 0.9, 0);
    // tubs inside
    const tubColors = [0xf3e6cf, 0xd9719c, 0x6fbfa8, 0xf0c14e, 0x8fb4d8];
    for (let i = 0; i < 5; i++) {
      addCyl(fg, 0.115, 0.1, 0.2, 10, toon(tubColors[i]), -0.36 + i * 0.18, 0.78, -0.28 + (i % 2) * 0.34);
    }
    addPlane(fg, 0.5, 0.22, new THREE.MeshBasicMaterial({ map: canvasTexture(256, 112, (ctx, w, h) => {
      ctx.fillStyle = '#2a8e88'; ctx.fillRect(0, 0, w, h);
      drawText(ctx, 'ICE CREAM', w / 2, 44, 30, '#eaf6f2');
      drawText(ctx, '¥160', w / 2, 80, 22, '#a9e0d4');
    }) }), 0, 0.45, 0.615);
  }

  /* ---------------- magazine rack ---------------- */
  {
    const mg = new THREE.Group();
    mg.position.set(-5.15, 0, 0.95);
    g.add(mg);
    addBox(mg, 1.3, 0.09, 0.56, mat.frame, 0, 0, 0);
    addBox(mg, 1.3, 1.4, 0.05, mat.shelf, 0, 0, -0.25);
    addBox(mg, 0.05, 1.44, 0.56, mat.shelf, -0.65, 0, 0);
    addBox(mg, 0.05, 1.44, 0.56, mat.shelf, 0.65, 0, 0);
    addBox(mg, 1.3, 0.05, 0.58, mat.shelf, 0, 1.4, 0);
    const board = addBox(mg, 1.22, 0.86, 0.04, mat.shelf, 0, 0.5, 0.08, { cast: false });
    board.rotation.x = -0.22;
    addPlane(mg, 1.14, 0.78, new THREE.MeshBasicMaterial({ map: magazineTexture() }), 0, 0.93, 0.135);
    addBox(mg, 1.3, 0.06, 0.06, mat.frame, 0, 1.44, 0.27);
    addBox(mg, 1.2, 0.06, 0.08, mat.metal, 0, 0.46, 0.27);
    addBox(mg, 1.16, 0.06, 0.02, mat.warmLight, 0, 1.36, 0.29);
  }

  /* ---------------- bento / onigiri display case ---------------- */
  {
    const bg = new THREE.Group();
    bg.position.set(1.85, 0, -0.75);
    g.add(bg);
    addBox(bg, 3.0, 0.72, 1.0, mat.cream2, 0, 0, 0, { line: 0.016 });
    addBox(bg, 3.04, 0.09, 1.04, mat.wood, 0, 0.62, 0);
    addBox(bg, 2.9, 0.02, 0.9, mat.warmLight, 0, 0.725, 0);
    // glass box
    addBox(bg, 3.0, 0.33, 0.02, mat.glassDoor, 0, 0.72, 0.5);
    addBox(bg, 0.02, 0.33, 1.0, mat.glassDoor, -1.5, 0.72, 0);
    addBox(bg, 0.02, 0.33, 1.0, mat.glassDoor, 1.5, 0.72, 0);
    addBox(bg, 3.0, 0.02, 0.02, mat.metal, 0, 1.04, 0.5);
    for (const x of [-1.5, 0, 1.5]) {
      addBox(bg, 0.04, 0.34, 0.04, mat.metal, x, 0.72, 0.5);
      addBox(bg, 0.04, 0.34, 0.04, mat.metal, x, 0.72, -0.5);
    }
    addBox(bg, 3.04, 0.035, 0.04, mat.frame, 0, 1.035, 0.5);
    addBox(bg, 3.04, 0.035, 0.04, mat.frame, 0, 1.035, -0.5);
    addBox(bg, 0.04, 0.035, 1.02, mat.frame, -1.5, 1.035, 0);
    addBox(bg, 0.04, 0.035, 1.02, mat.frame, 1.5, 1.035, 0);
    addBox(bg, 2.8, 0.035, 0.03, mat.warmLight, 0, 1.0, 0.46);
    // bento boxes
    const bentoColors = [0xd6604b, 0xe8a33e, 0x6f9f5d, 0xdfc9a5, 0xc25b6e, 0xf0d9a8];
    const bt = [], bc = [];
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 5; i++) {
        bt.push({ p: [-1.15 + i * 0.55, 0.80, -0.5 + r * 0.34] });
        bc.push(bentoColors[(i + r * 2) % bentoColors.length]);
      }
    }
    instancedMesh(boxGeo(0.32, 0.09, 0.23), toon(0xffffff), bt, { parent: bg, colors: bc });
    // onigiri triangles
    const ot = [], oc = [];
    for (let i = 0; i < 5; i++) {
      ot.push({ p: [-1.15 + i * 0.5, 0.79, -0.12], r: [Math.PI / 2, 0, 0] });
      oc.push(0xf7f2e6);
    }
    instancedMesh(new THREE.CylinderGeometry(0.105, 0.105, 0.06, 3), toon(0xffffff), ot, { parent: bg, colors: oc });
    // nori strip fronts
    const nt = [];
    for (let i = 0; i < 5; i++) nt.push({ p: [-1.15 + i * 0.5, 0.79, -0.08] });
    instancedMesh(boxGeo(0.06, 0.09, 0.012), toon(0x25312c), nt, { parent: bg });
    // price tags
    addBox(bg, 2.9, 0.035, 0.02, mat.warmLight, 0, 0.72, 0.51);
    addPlane(bg, 0.7, 0.2, new THREE.MeshBasicMaterial({ map: canvasTexture(320, 96, (ctx, w, h) => {
      ctx.fillStyle = '#f6efdf'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d6604b'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, h - 8);
      drawText(ctx, 'おにぎり ¥120', w / 2, 48, 26, '#3a3126');
    }) }), 0, 0.72, 0.512, { rot: [0, 0, 0] });
  }

  /* ---------------- service counter ---------------- */
  {
    const cg = new THREE.Group();
    g.add(cg);
    addBox(cg, 1.1, 0.94, 3.9, mat.cream2, 3.32, 0, -3.55, { line: 0.02 });
    addBox(cg, 1.16, 0.06, 3.96, mat.wood, 3.32, 0.94, -3.55);
    addBox(cg, 0.04, 0.5, 3.6, mat.teal, 2.78, 0.1, -3.55, { cast: false });
    addBox(cg, 1.06, 0.08, 3.86, mat.frame, 3.32, 0.0, -3.55);
    // register
    addBox(cg, 0.36, 0.1, 0.32, mat.frame, 3.35, 1.0, -3.15);
    addBox(cg, 0.06, 0.26, 0.06, mat.metal, 3.35, 1.1, -3.15);
    const screen = addPlane(cg, 0.4, 0.3, new THREE.MeshBasicMaterial({ map: registerTexture() }), 3.35, 1.33, -3.02, { rot: [-0.32, 0, 0] });
    addBox(cg, 0.38, 0.03, 0.03, mat.frame, 3.35, 1.16, -3.02);
    // coffee machine
    const cm = new THREE.Group();
    cm.position.set(3.35, 1.0, -4.55);
    cg.add(cm);
    addBox(cm, 0.46, 0.62, 0.42, mat.dark, 0, 0, 0, { line: 0.014 });
    addPlane(cm, 0.42, 0.5, new THREE.MeshBasicMaterial({ map: coffeePanelTexture() }), 0, 0.34, 0.215);
    addBox(cm, 0.3, 0.05, 0.26, mat.metal, 0, 0.03, 0.22);
    addCyl(cm, 0.06, 0.05, 0.1, 10, mat.cream2, 0, 0.06, 0.32);
    addGlow(cm, 0xa9e0d8, 0.8, 0, 0.35, 0.32, 0.16);
    // oden warmer
    const og = new THREE.Group();
    og.position.set(3.35, 1.0, -1.95);
    cg.add(og);
    addBox(og, 0.82, 0.1, 0.48, mat.metal, 0, 0, 0, { line: 0.01 });
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 2; k++) {
        addBox(og, 0.24, 0.07, 0.2, toon(0xeae2d2), -0.26 + i * 0.26, 0.02, -0.11 + k * 0.22);
        addBox(og, 0.21, 0.01, 0.17, mat.broth, -0.26 + i * 0.26, 0.085, -0.11 + k * 0.22);
        for (let s = 0; s < 2; s++) {
          addCyl(og, 0.008, 0.008, 0.26, 5, mat.wood, -0.32 + i * 0.26 + s * 0.09, 0.05, -0.11 + k * 0.22);
          addCyl(og, 0.028, 0.028, 0.05, 7, toon(s ? 0xf1e4c8 : 0xc9884f), -0.32 + i * 0.26 + s * 0.09, 0.1, -0.11 + k * 0.22);
        }
      }
    }
    addBox(og, 0.86, 0.02, 0.52, new THREE.MeshBasicMaterial({ color: 0xffd79a }), 0, 0.19, 0);
    addBox(og, 0.82, 0.12, 0.04, mat.cream2, 0, 0.02, 0.26);
    // cups + card reader
    addCyl(cg, 0.06, 0.05, 0.2, 8, mat.cream2, 3.4, 1.0, -2.55);
    addBox(cg, 0.15, 0.05, 0.1, mat.dark, 3.32, 1.0, -1.55);
    addGlow(cg, 0xffd9a0, 1.7, 3.3, 1.3, -3.5, 0.1);
  }


  /* ---------------- back-bar shelf behind the counter ---------------- */
  {
    const bb = new THREE.Group();
    g.add(bb);
    addBox(bb, 1.9, 1.45, 0.06, mat.cream2, 3.1, 0.9, Z0 + 0.05);
    addBox(bb, 1.9, 0.05, 0.4, mat.wood, 3.1, 1.42, Z0 + 0.23);
    addBox(bb, 1.9, 0.05, 0.4, mat.wood, 3.1, 1.92, Z0 + 0.23);
    addBox(bb, 1.9, 0.05, 0.4, mat.wood, 3.1, 0.94, Z0 + 0.23);
    const cupGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.12, 10);
    const cupT = [];
    for (let i = 0; i < 10; i++) cupT.push({ p: [2.28 + i * 0.16, 1.48, Z0 + 0.24] });
    instancedMesh(cupGeo, toon(0xf4eee2), cupT, { parent: bb });
    const bottleColors = [0xc4573f, 0xc9a45e, 0x3f6f68, 0x5e6b8c];
    for (let i = 0; i < 6; i++) {
      addCyl(bb, 0.045, 0.05, 0.2, 8, toon(bottleColors[i % 4]), 2.3 + i * 0.26, 1.97, Z0 + 0.23);
      addCyl(bb, 0.018, 0.02, 0.05, 6, mat.frame, 2.3 + i * 0.26, 2.17, Z0 + 0.23);
    }
    addPlane(bb, 0.9, 0.32, new THREE.MeshBasicMaterial({ map: canvasTexture(512, 180, (ctx, w, h) => {
      ctx.fillStyle = '#f3ead8'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2a8e88'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, w - 8, h - 8);
      drawText(ctx, 'COFFEE / SYRUP', w / 2, 60, 30, '#1b3a3c');
      drawText(ctx, 'スタッフ用', w / 2, 118, 24, '#6b7c78');
    }) }), 3.1, 2.22, Z0 + 0.06);
    addGlow(bb, 0xffe2b6, 1.4, 3.1, 1.8, Z0 + 0.4, 0.14);
  }

  /* ---------------- hanging OPEN sign ---------------- */
  let hanger = null;
  {
    hanger = new THREE.Group();
    hanger.position.set(0.9, 2.38, 0.6);
    g.add(hanger);
    addBox(hanger, 0.9, 0.34, 0.06, mat.dark, 0, 0, 0, { line: 0.012 });
    const m = new THREE.MeshBasicMaterial({ map: hangerTexture() });
    addPlane(hanger, 0.86, 0.3, m, 0, 0, 0.035);
    addPlane(hanger, 0.86, 0.3, m, 0, 0, -0.035, { rot: [0, Math.PI, 0] });
    addCyl(g, 0.008, 0.008, 0.44, 4, mat.frame, 0.58, 2.72, 0.6);
    addCyl(g, 0.008, 0.008, 0.44, 4, mat.frame, 1.22, 2.72, 0.6);
    addGlow(hanger, 0x9fe0d0, 1.6, 0, 0, 0.12, 0.16);
  }


  /* ---------------- basket stack / standee / hot-food menu ---------------- */
  {
    const bg = new THREE.Group();
    bg.position.set(0.95, 0, 1.32);
    g.add(bg);
    for (let i = 0; i < 4; i++) {
      const y = i * 0.145;
      addBox(bg, 0.56, 0.11, 0.4, toon(0xad4d3c), 0, y, 0, { line: 0.008 });
      addBox(bg, 0.48, 0.018, 0.32, toon(0x7c3528), 0, y + 0.1, 0);
      addBox(bg, 0.04, 0.1, 0.04, toon(0x7c3528), -0.26, y + 0.09, 0);
      addBox(bg, 0.04, 0.1, 0.04, toon(0x7c3528), 0.26, y + 0.09, 0);
    }
    addBox(bg, 0.36, 0.24, 0.02, mat.warmLight, 0, 0.66, 0.2);
    const basketSign = canvasTexture(256, 96, (ctx, w, h) => {
      ctx.fillStyle = '#f2e8d3'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c4573f'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
      drawText(ctx, 'BASKETS', w / 2, 50, 34, '#b04735');
    });
    addPlane(bg, 0.3, 0.11, new THREE.MeshBasicMaterial({ map: basketSign }), 0, 0.78, 0.215);

    const sg = new THREE.Group();
    sg.position.set(-2.9, 0, 1.28);
    sg.rotation.y = 0.12;
    g.add(sg);
    addBox(sg, 0.55, 0.06, 0.32, mat.frame, 0, 0, 0);
    addBox(sg, 0.05, 1.35, 0.05, mat.frame, -0.2, 0.06, 0);
    addBox(sg, 0.05, 1.35, 0.05, mat.frame, 0.2, 0.06, 0);
    const sp = addPlane(sg, 0.52, 0.88, new THREE.MeshBasicMaterial({ map: promoPoster(0), side: THREE.DoubleSide }), 0, 0.92, 0.02);
    addBox(sg, 0.58, 0.03, 0.04, mat.frame, 0, 1.36, 0.02);
    addGlow(sg, 0xffd9a2, 0.8, 0, 1.0, 0.12, 0.12);

    // menu board hung on the glass side, above the counter
    const mb = new THREE.Group();
    mb.position.set(3.88, 0, -2.7);
    g.add(mb);
    addBox(mb, 0.06, 0.64, 2.02, mat.dark, 0, 2.1, 0, { line: 0.012 });
    addPlane(mb, 1.9, 0.52, new THREE.MeshBasicMaterial({ map: menuTexture() }), 0.035, 2.42, 0, { rot: [0, Math.PI / 2, 0] });
    addCyl(mb, 0.008, 0.008, 0.28, 4, mat.frame, 0, 2.68, -0.75);
    addCyl(mb, 0.008, 0.008, 0.28, 4, mat.frame, 0, 2.68, 0.75);
    addGlow(mb, 0xffddb0, 1.5, 0.2, 2.4, 0, 0.12);
  }

  /* ---------------- alley-side wall dressing ---------------- */
  {
    // service door in the side wall
    addBox(g, 0.06, 2.0, 0.92, mat.teal, X0 - 0.235, 0, -4.6, { line: 0.012 });
    addBox(g, 0.02, 2.1, 1.02, mat.frame, X0 - 0.265, 0, -4.6);
    addBox(g, 0.08, 0.06, 0.1, mat.metal, X0 - 0.27, 1.0, -4.22);
    addBox(g, 0.08, 0.16, 0.06, mat.warmLight, X0 - 0.24, 2.3, -4.6);
    addGlow(g, 0xffcf94, 1.7, X0 - 0.36, 2.25, -4.6, 0.4);
    // posters on the blank side wall
    addPlane(g, 1.0, 1.35, new THREE.MeshBasicMaterial({ map: promoPoster(1), side: THREE.DoubleSide }),
      X0 - 0.235, 1.95, 0.55, { rot: [0, -Math.PI / 2, 0] });
    addPlane(g, 0.7, 0.92, new THREE.MeshBasicMaterial({ map: promoPoster(0), side: THREE.DoubleSide }),
      X0 - 0.235, 2.15, -1.3, { rot: [0, -Math.PI / 2, 0] });
    // wall-mounted AC outdoor unit
    const ac = new THREE.Group();
    ac.position.set(X0 - 0.28, 2.18, -2.55);
    g.add(ac);
    addBox(ac, 0.48, 0.56, 0.86, mat.metal, 0, 0, 0, { cast: true, line: 0.012 });
    addCyl(ac, 0.18, 0.18, 0.02, 16, mat.frame, -0.25, 0.28, 0, { rot: [0, 0, Math.PI / 2] });
    addCyl(ac, 0.19, 0.19, 0.012, 16, mat.metal, -0.265, 0.28, 0, { rot: [0, 0, Math.PI / 2] });
    addBox(ac, 0.36, 0.04, 0.9, mat.frame, 0.02, -0.06, 0);
    addBox(ac, 0.04, 0.26, 0.04, mat.frame, 0.2, -0.3, 0.32);
    // small front wall lamp over the posters
    addBox(g, 0.16, 0.1, 0.24, mat.frame, X0 - 0.28, 2.75, 0.55);
    addCyl(g, 0.065, 0.065, 0.04, 8, mat.warmLight, X0 - 0.37, 2.72, 0.55, { rot: [0, 0, Math.PI / 2] });
    addGlow(g, 0xffc78a, 1.5, X0 - 0.48, 2.68, 0.55, 0.38);
    // vent + downpipe
    addBox(g, 0.06, 0.26, 0.5, mat.frame, X0 - 0.235, 2.62, -6.4);
    addCyl(g, 0.045, 0.045, 4.15, 8, mat.metal, X0 - 0.23, 0.02, 1.9, { cast: true });
    addBox(g, 0.1, 0.05, 0.05, mat.metal, X0 - 0.23, 2.35, 1.9);
  }

  /* ---------------- automatic doors ---------------- */
  const doorL = new THREE.Group();
  const doorR = new THREE.Group();
  const DOOR_L_X = -1.675, DOOR_R_X = -0.325;
  const doorLeds = [];
  function buildDoor(panel, baseX) {
    panel.position.set(baseX, 0, Z1 + 0.045);
    g.add(panel);
    const w = 1.3, h = 2.62;
    addBox(panel, w, 0.06, 0.06, mat.frame, 0, 2.56, 0, { cast: true });
    addBox(panel, w, 0.1, 0.06, mat.frame, 0, 0.0, 0, { cast: false });
    addBox(panel, 0.05, h, 0.06, mat.frame, -w / 2 + 0.025, 0.05, 0);
    addBox(panel, 0.05, h, 0.06, mat.frame, w / 2 - 0.025, 0.05, 0);
    const glass = addPlane(panel, w - 0.1, h - 0.16, mat.glassDoor, 0, 0.08 + (h - 0.16) / 2, 0.005);
    glass.renderOrder = 4;
    addPlane(panel, w - 0.2, 0.12, new THREE.MeshBasicMaterial({ map: doorStickerTexture(), transparent: true }), 0, 1.28, 0.012);
    addBox(panel, 0.035, 0.5, 0.05, mat.metal, (baseX < -1 ? 1 : -1) * (w / 2 - 0.18), 1.2, 0.04);
    // rain streak on each leaf
    const sm = addPlane(panel, w - 0.12, h - 0.2, streakMat, 0, 0.08 + (h - 0.2) / 2, 0.014, { receive: false });
    sm.renderOrder = 6;
  }
  buildDoor(doorL, DOOR_L_X);
  buildDoor(doorR, DOOR_R_X);
  // door track + sensor
  addBox(g, 2.8, 0.1, 0.2, mat.frame, -1.0, 2.78, Z1 + 0.02);
  addBox(g, 0.26, 0.1, 0.18, mat.dark, -1.0, 2.9, Z1 + 0.08);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff6b5e });
  addBox(g, 0.12, 0.03, 0.03, ledMat, -1.0, 2.93, 2.16);
  addGlow(g, 0xff6b5e, 0.35, -1.0, 2.93, 2.2, 0.5);

  /* ---------------- store sign boxes ---------------- */
  const signTex = signTexture();
  {
    // front
    addBox(g, W, 0.7, 0.34, mat.cream, -1, 3.55, Z1 + 0.17, { cast: true, line: 0.02 });
    const fm = new THREE.MeshBasicMaterial({ map: signTex });
    addPlane(g, W - 0.02, 0.66, fm, -1, 3.9, Z1 + 0.342);
    signMats.push({ mat: fm, base: 1 });
    // side
    addBox(g, 0.34, 0.7, D, mat.cream, X1 + 0.17, 3.55, -2.6, { cast: true, line: 0.02 });
    const sm = new THREE.MeshBasicMaterial({ map: signTex });
    addPlane(g, D - 0.02, 0.66, sm, X1 + 0.342, 3.9, -2.6, { rot: [0, Math.PI / 2, 0] });
    signMats.push({ mat: sm, base: 1 });
    // sign trim top
    addBox(g, W + 0.04, 0.05, 0.38, mat.frame, -1, 4.25, Z1 + 0.17, { cast: false });
    addBox(g, 0.38, 0.05, D, mat.frame, X1 + 0.17, 4.25, -2.6, { cast: false });
    // fascia lighting accent
    addBox(g, W - 0.4, 0.02, 0.02, mat.warmLight, -1, 3.5, Z1 + 0.34);
  }
  // sign off-corner glow
  addGlow(g, 0xfff0c8, 5.0, 2.5, 3.9, 2.9, 0.1);
  addGlow(g, 0xfff0c8, 3.5, 4.55, 3.9, -1.0, 0.08);

  /* ---------------- pylon sign ---------------- */
  {
    const pg = new THREE.Group();
    pg.position.set(5.25, 0.16, 2.85);
    pg.rotation.y = 0.42;
    scene.add(pg);
    addBox(pg, 0.18, 1.25, 0.18, mat.frame, 0, 0, 0, { cast: true, line: 0.018 });
    addBox(pg, 0.7, 2.55, 0.26, mat.cream, 0, 1.2, 0, { cast: true, line: 0.02 });
    const pm = new THREE.MeshBasicMaterial({ map: pylonTexture() });
    addPlane(pg, 0.64, 2.45, pm, 0, 2.46, 0.135);
    addPlane(pg, 0.64, 2.45, pm, 0, 2.46, -0.135, { rot: [0, Math.PI, 0] });
    signMats.push({ mat: pm, base: 1 });
    addGlow(pg, 0xffecc4, 2.0, 0, 2.3, 0.2, 0.12);
    addLightPool(pg, 0xffd9a0, 2.6, 2.6, 0, 0.01, 0.4, 0.12);
  }

  /* ---------------- exterior wall dressing ---------------- */
  // downpipes
  addCyl(g, 0.05, 0.05, 3.55, 8, mat.metal, 3.86, 0.02, 2.12, { cast: true });
  addCyl(g, 0.05, 0.05, 4.2, 8, mat.metal, -5.86, 0.02, -7.12, { cast: true });
  addBox(g, 0.12, 0.05, 0.05, mat.metal, 3.86, 2.4, 2.06);
  // wall vent on the side band
  addBox(g, 0.06, 0.28, 0.5, mat.frame, 4.04, 3.02, -2.2);
  // back door lamp
  addCyl(g, 0.07, 0.05, 0.08, 10, mat.warmLight, 0.95, 2.6, -7.35, { rot: [Math.PI / 2, 0, 0] });
  addGlow(g, 0xffd09a, 1.3, 0.95, 2.6, -7.5, 0.4);
  // service door on the back wall
  addBox(g, 0.95, 2.0, 0.06, mat.teal, 0.95, 0.0, -7.33, { line: 0.012 });
  addBox(g, 0.06, 0.06, 0.1, mat.metal, 1.31, 1.0, -7.38);

  /* ---------------- roof ---------------- */
  {
    addBox(g, W + 0.5, 0.16, D + 0.5, mat.roof, -1, 4.3, -2.6, { cast: true, receive: true, line: 0.02 });
    // parapet
    const py = 4.46;
    addBox(g, W + 0.2, 0.26, 0.12, mat.cream2, -1, py, Z0 - 0.02, { cast: true });
    addBox(g, W + 0.2, 0.26, 0.12, mat.cream2, -1, py, Z1 + 0.04, { cast: true });
    addBox(g, 0.12, 0.26, D + 0.2, mat.cream2, X0 + 0.02, py, -2.6, { cast: true });
    addBox(g, 0.12, 0.26, D + 0.2, mat.cream2, X1 + 0.02, py, -2.6, { cast: true });
    // rooftop AC
    const ac = new THREE.Group();
    ac.position.set(0.7, 4.46, -5.1);
    g.add(ac);
    addBox(ac, 1.1, 0.62, 0.76, mat.metal, 0, 0.08, 0, { cast: true, line: 0.014 });
    addBox(ac, 1.16, 0.09, 0.82, mat.frame, 0, 0.0, 0);
    addCyl(ac, 0.24, 0.24, 0.02, 16, mat.frame, 0, 0.42, 0.39, { rot: [Math.PI / 2, 0, 0] });
    addCyl(ac, 0.25, 0.25, 0.012, 16, mat.metal, 0, 0.42, 0.405, { rot: [Math.PI / 2, 0, 0] });
    addBox(ac, 0.9, 0.04, 0.02, mat.frame, 0, 0.15, 0.39);
    // vents
    addCyl(g, 0.11, 0.13, 0.46, 10, mat.metal, -3.2, 4.46, -5.6, { cast: true });
    addCyl(g, 0.2, 0.2, 0.06, 10, mat.frame, -3.2, 4.9, -5.6);
    addCyl(g, 0.1, 0.12, 0.38, 10, mat.metal, -4.2, 4.46, -3.3, { cast: true });
    addCyl(g, 0.18, 0.18, 0.05, 10, mat.frame, -4.2, 4.82, -3.3);
    // antenna
    addCyl(g, 0.022, 0.03, 1.4, 6, mat.frame, -4.7, 4.46, -6.2, { cast: true });
    addBox(g, 0.7, 0.025, 0.025, mat.frame, -4.7, 5.5, -6.2);
    addBox(g, 0.5, 0.025, 0.025, mat.frame, -4.7, 5.9, -6.2);
    // roof hatch
    addBox(g, 0.8, 0.22, 0.7, mat.metal, 2.7, 4.46, -3.9, { cast: true, line: 0.012 });
    addBox(g, 0.86, 0.05, 0.76, mat.frame, 2.7, 4.66, -3.9);
    // a little roof drain
    addCyl(g, 0.09, 0.09, 0.04, 10, mat.frame, 3.4, 4.47, -0.4);
  }

  /* ---------------- snow cover ---------------- */
  // roof sheet inside the parapet
  addBox(g, 9.8, 0.04, 9.0, snowCapMaterial, -1, 4.468, -2.6);
  // parapet caps
  addBox(g, 10.22, 0.04, 0.14, snowCapMaterial, -1, 4.72, -7.22);
  addBox(g, 10.22, 0.04, 0.14, snowCapMaterial, -1, 4.72, 2.04);
  addBox(g, 0.14, 0.04, 9.42, snowCapMaterial, -5.98, 4.72, -2.6);
  addBox(g, 0.14, 0.04, 9.42, snowCapMaterial, 4.02, 4.72, -2.6);
  // roof plant
  addBox(g, 1.18, 0.04, 0.84, snowCapMaterial, 0.7, 5.16, -5.1);
  addCyl(g, 0.22, 0.22, 0.03, 10, snowCapMaterial, -3.2, 4.92, -5.6);
  addCyl(g, 0.2, 0.2, 0.03, 10, snowCapMaterial, -4.2, 4.84, -3.3);
  addBox(g, 0.9, 0.04, 0.8, snowCapMaterial, 2.7, 4.71, -3.9);
  // sign trims
  addBox(g, 10.04, 0.04, 0.38, snowCapMaterial, -1, 4.30, 2.17);
  addBox(g, 0.38, 0.04, 9.4, snowCapMaterial, 4.17, 4.30, -2.6);
  // awning canopy
  const snowAwning = addBox(g, 4.9, 0.04, 1.5, snowCapMaterial, -1, 3.08, 2.72);
  snowAwning.rotation.x = -0.09;
  // wall AC
  addBox(g, 0.52, 0.04, 0.9, snowCapMaterial, -6.28, 2.74, -2.55);
  // pylon top (world-space, pylon is a scene child at y=0.16)
  addBox(scene, 0.74, 0.04, 0.30, snowCapMaterial, 5.25, 3.91, 2.85, { rot: [0, 0.42, 0] });

  /* ---------------- awning drip pipe ---------------- */
  addCyl(g, 0.035, 0.035, 0.5, 6, mat.metal, 3.85, 2.0, 2.1, { rot: [Math.PI / 2, 0, 0] });

  /* ---------------- animation ---------------- */
  let doorAmount = 0;
  let doorOverride = null;
  let clock = 0;

  function setDoor(v) { doorOverride = v; }

  const streakBaseOpacity = streakMat.opacity;
  function setRainAmount(v) {
    const a = Math.max(0, Math.min(1, v));
    streakMat.opacity = streakBaseOpacity * a;
    for (const m of streakMeshes) m.visible = a > 0.01;
  }

  function update(time, dt) {
    clock += dt;
    const cycle = 26;
    const local = (time + 7) % cycle;
    const autoTarget = (local > 15.5 && local < 21.5) ? 1 : 0;
    const target = doorOverride === null ? autoTarget : doorOverride;
    doorAmount = damp(doorAmount, target, 1.35, dt);
    doorL.position.x = DOOR_L_X - doorAmount * 1.31;
    doorR.position.x = DOOR_R_X + doorAmount * 1.31;

    // rain running down the glazing
    streakTex.offset.y -= dt * 0.035;
    // gentle neon flicker (rare, shallow dips)
    const n = 0.5 + 0.5 * Math.sin(time * 17.0) * Math.sin(time * 5.3 + 1.7);
    let f = 0.93 + 0.07 * n;
    if (Math.sin(time * 0.83) > 0.996) f *= 0.78;
    for (const s of signMats) s.mat.color.setScalar(f);
    // hanging sign barely sways
    if (hanger) hanger.rotation.z = Math.sin(time * 0.7) * 0.025;
    // door led
    ledMat.color.set(doorAmount > 0.5 ? 0x6ff2c8 : 0xff6b5e);
  }

  return {
    group: g,
    update,
    setDoor,
    setRainAmount,
    signMats,
    get doorAmount() { return doorAmount; },
  };
}