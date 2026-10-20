// ---------------------------------------------------------------------------
// ramen.js — a little Japanese ramen-ya on an annex plinth across the side
// street from the konbini. Timber + plaster front, gabled tiled roof, noren,
// red lantern, warm counter interior, forecourt, bamboo fence and snow caps.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {
  toon, addBox, addCyl, addPlane, addMesh, addGlow, addLightPool,
  canvasTexture, roundRect, drawText, cylGeo, boxGeo, planeGeo, JP_FONT,
} from './toon.js';
import { snowCapMaterial, snowGroundMaterial } from './snowcover.js';

/* ==========================================================================
   procedural textures
   ========================================================================== */
function roofTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2d3844';
    ctx.fillRect(0, 0, w, h);
    const row = 46;
    for (let y = 0; y < h + row; y += row) {
      ctx.fillStyle = 'rgba(15,20,27,0.55)';
      ctx.fillRect(0, y, w, 4);
      ctx.fillStyle = 'rgba(92,110,124,0.24)';
      ctx.fillRect(0, y + 5, w, 3);
      for (let x = (y / row) % 2 === 0 ? 0 : 30; x < w; x += 60) {
        ctx.fillStyle = 'rgba(12,17,23,0.42)';
        ctx.fillRect(x, y + 4, 2, row - 4);
        ctx.fillStyle = 'rgba(110,130,144,0.16)';
        ctx.fillRect(x + 2, y + 4, 2, row - 4);
      }
    }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = 'rgba(160,180,196,' + (Math.random() * 0.07) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, { wrap: true, repeat: [3, 3] });
}

function stoneTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7c776e';
    ctx.fillRect(0, 0, w, h);
    const cw = 128, ch = 96;
    for (let y = 0; y < h + ch; y += ch) {
      for (let x = 0; x < w + cw; x += cw) {
        const ox = ((y / ch) % 2) * (cw / 2);
        const shade = 0.82 + Math.random() * 0.26;
        ctx.fillStyle = 'rgba(' + Math.floor(126 * shade) + ',' + Math.floor(120 * shade) + ',' + Math.floor(109 * shade) + ',1)';
        ctx.fillRect(x + ox + 2, y + 2, cw - 4, ch - 4);
        ctx.strokeStyle = 'rgba(60,56,50,0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + ox + 2, y + 2, cw - 4, ch - 4);
      }
    }
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(40,36,31,0.10)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
  }, { wrap: true, repeat: [3, 5] });
}

function woodTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6b4936';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 44; i++) {
      const x = Math.random() * w;
      ctx.strokeStyle = 'rgba(' + (54 + Math.random() * 30) + ',' + (32 + Math.random() * 20) + ',22,' + (0.12 + Math.random() * 0.2) + ')';
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y < h; y += 26) ctx.lineTo(x + Math.sin(y * 0.03 + i) * 5, y);
      ctx.stroke();
    }
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = 'rgba(30,18,10,' + (Math.random() * 0.12) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
  }, { wrap: true, repeat: [1, 2] });
}

function norenTexture(label) {
  return canvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#223652';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.03) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    ctx.strokeStyle = 'rgba(12,20,33,0.7)';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(w / 3, 0); ctx.lineTo(w / 3, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 2 / 3, 0); ctx.lineTo(w * 2 / 3, h); ctx.stroke();
    ctx.fillStyle = '#c8443a';
    ctx.beginPath(); ctx.arc(68, 96, 34, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, 'さ', 68, 96, 36, '#f7ead6');
    drawText(ctx, label, 292, 96, 62, '#f4efe2');
  });
}

function gableSignTexture() {
  return canvasTexture(640, 192, (ctx, w, h) => {
    ctx.fillStyle = '#f0e1c4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8f332a';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#b53b2e';
    ctx.fillRect(0, 0, w, 15);
    ctx.fillRect(0, h - 15, w, 15);
    ctx.fillStyle = '#b53b2e';
    ctx.beginPath(); ctx.arc(96, 96, 50, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, '麺', 96, 96, 52, '#f7ecd8');
    drawText(ctx, '麺屋 さくら', 358, 66, 50, '#2d231b');
    drawText(ctx, 'らーめん', 358, 118, 38, '#b53b2e');
    drawText(ctx, 'SAKURA  RAMEN', 358, 160, 19, '#6d5947', { letterSpacing: '3px' });
  });
}

function bladeSignTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f1e2c6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a63a2d';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#a63a2d';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
    drawText(ctx, '麺屋', w / 2, 58, 30, '#5a4533');
    const chars = ['ら', 'ー', 'め', 'ん'];
    for (let i = 0; i < chars.length; i++) drawText(ctx, chars[i], w / 2, 132 + i * 78, 62, '#b53b2e');
    ctx.strokeStyle = '#6a513a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w / 2, 458, 26, 0, Math.PI * 2); ctx.stroke();
    drawText(ctx, 'OPEN', w / 2, 490, 16, '#6a513a', { letterSpacing: '2px' });
  });
}

function lanternTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8f241c');
    g.addColorStop(0.18, '#d44432');
    g.addColorStop(0.55, '#e2573c');
    g.addColorStop(1, '#8f241c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a1d1a';
    ctx.fillRect(0, 0, w, 18);
    ctx.fillRect(0, h - 18, w, 18);
    for (let y = 22; y < h - 22; y += 24) {
      ctx.strokeStyle = 'rgba(70,18,12,0.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      drawText(ctx, ['ら', 'ー', 'め', 'ん'][i], w / 2 + (i % 2 === 0 ? -10 : 10), 62 + i * 42, 38, '#f6e6ca');
    }
    drawText(ctx, '麺屋 さくら', w / 2, h - 36, 18, '#f1d9b4');
  });
}

function menuTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#241f1c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7d5a3d'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12);
    drawText(ctx, 'お し な が き', w / 2, 34, 27, '#e9d4b6', { letterSpacing: '4px' });
    const rows = [['醤油らーめん', '900'], ['味玉らーめん', '1,050'], ['餃子', '500'], ['ビール', '600']];
    for (let i = 0; i < rows.length; i++) {
      drawText(ctx, rows[i][0], 56, 92 + i * 38, 27, '#eadcc7', { align: 'left' });
      drawText(ctx, '¥' + rows[i][1], w - 48, 92 + i * 38, 27, '#f0c27d', { align: 'right' });
    }
    ctx.strokeStyle = 'rgba(220,190,150,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 74); ctx.lineTo(w - 40, 74); ctx.stroke();
  });
}

function posterTexture() {
  return canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#f1e7d2';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#9f3b2e'; ctx.lineWidth = 7; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#243b57';
    ctx.beginPath(); ctx.arc(w / 2, 132, 72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c38c';
    ctx.beginPath(); ctx.arc(w / 2, 138, 43, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#c46a35';
    ctx.beginPath(); ctx.arc(w / 2, 138, 32, 0, Math.PI); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = '#f4d79c'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 28 + i * 14, 118);
      ctx.quadraticCurveTo(w / 2 - 12 + i * 14, 134, w / 2 - 30 + i * 14, 144);
      ctx.stroke();
    }
    ctx.fillStyle = '#f4ead5'; ctx.beginPath(); ctx.arc(w / 2 + 27, 121, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e5a12d'; ctx.beginPath(); ctx.arc(w / 2 + 27, 121, 6, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, 'SAKURA', w / 2, 232, 30, '#9f3b2e', { letterSpacing: '4px' });
    drawText(ctx, 'らーめん', w / 2, 280, 34, '#2d231b');
    drawText(ctx, 'The best bowl in town.', w / 2, 332, 15, '#6d5947', { font: 'Georgia, serif' });
  });
}

function ticketTexture() {
  return canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#b33a2d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9dcc4'; ctx.fillRect(16, 16, w - 32, h - 32);
    ctx.fillStyle = '#a53227'; ctx.fillRect(16, 16, w - 32, 54);
    drawText(ctx, '券 売 機', w / 2, 45, 27, '#f7ead4', { letterSpacing: '3px' });
    ctx.fillStyle = '#22303e'; ctx.fillRect(30, 88, w - 60, 94);
    ctx.fillStyle = '#8fd8c8'; ctx.fillRect(40, 98, w - 80, 30);
    drawText(ctx, '¥ 980', w / 2, 114, 20, '#15202a');
    const cols = ['#e7b24a', '#d66b4f', '#7fb5a6', '#c3cbd3'];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = cols[(r * 3 + c) % 4];
        roundRect(ctx, 32 + c * 64, 202 + r * 56, 52, 44, 6); ctx.fill();
      }
    }
    ctx.fillStyle = '#3d2c22'; ctx.fillRect(36, h - 62, w - 72, 12);
    ctx.fillStyle = '#f4e7d0'; ctx.fillRect(44, h - 46, w - 88, 20);
  });
}

function bambooTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let x = 8; x < w; x += 26) {
      const grd = ctx.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, '#8d7443');
      grd.addColorStop(0.45, '#b79c63');
      grd.addColorStop(1, '#6f5932');
      ctx.fillStyle = grd;
      ctx.fillRect(x, 0, 16, h);
      for (let y = 20; y < h; y += 64) {
        ctx.fillStyle = 'rgba(70,56,32,0.5)';
        ctx.fillRect(x, y, 16, 4);
      }
      ctx.fillStyle = 'rgba(255,240,190,0.18)';
      ctx.fillRect(x + 3, 0, 3, h);
    }
  }, { wrap: true, repeat: [5, 1] });
}

function steamTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/* ==========================================================================
   build
   ========================================================================== */
export function buildRamen(scene) {
  const g = new THREE.Group();
  g.name = 'ramen-ya';
  scene.add(g);

  const M = {
    wood: toon(0x3b2a21),
    wood2: toon(0x5a4030),
    wood3: toon(0x7b5a3d),
    plaster: toon(0xe7d9bf),
    plaster2: toon(0xd9c8aa),
    roof: toon(0xffffff, { map: roofTexture() }),
    stone: toon(0xffffff, { map: stoneTexture() }),
    stone2: toon(0x837c70),
    floor: toon(0xffffff, { map: woodTexture() }),
    counter: toon(0x8c5f3e),
    counterTop: toon(0xc08a5b),
    red: toon(0xa83228),
    red2: toon(0xc24233),
    cream: toon(0xf1e2c6),
    dark: toon(0x241d18),
    frame: toon(0x2b211a),
    metal: toon(0x737a80),
    warm: new THREE.MeshBasicMaterial({ color: 0xffe0aa, toneMapped: false }),
    warmSoft: new THREE.MeshBasicMaterial({ color: 0xffd39b, toneMapped: false }),
    interior: toon(0xf0c48f, { emissive: 0x6b3a18, emissiveIntensity: 0.35 }),
    glass: new THREE.MeshBasicMaterial({
      color: 0xffd6a2, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }),
    glassCool: new THREE.MeshBasicMaterial({
      color: 0xbad4e6, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }),
  };

  const rimMat = new THREE.MeshBasicMaterial({ color: 0x4b5b78, toneMapped: false });
  const AX0 = 12.1, AX1 = 19.6, AZ0 = 0, AZ1 = 12.8;
  const SHX0 = 13.2, SHX1 = 18.4, SHZ0 = 2.8, SHZ1 = 8.2;
  const FLOOR = 0.30;

  /* ---------------- annex plinth ---------------- */
  function atier(w, d, h, x, z, bottomY, color, cast = true) {
    return addBox(g, w, h, d, toon(color), x, bottomY, z, { cast, receive: true });
  }
  atier(AX1 - AX0, AZ1 - AZ0, 0.22, (AX0 + AX1) / 2, (AZ0 + AZ1) / 2, -0.22, 0x333b52);
  atier(7.75, 13.1, 0.32, 12.1 + 7.75 / 2, 6.4, -0.54, 0x262d43);
  atier(8.0, 13.4, 0.42, 12.1 + 4.0, 6.4, -0.96, 0x1c2234);
  atier(8.15, 13.55, 0.12, 12.1 + 8.15 / 2, 6.4, -1.08, 0x141925, false);
  const ar = (w, h, d, x, y, z) => addBox(g, w, h, d, rimMat, x, y, z);
  function annexRim(east, north, south, y) {
    ar(0.042, 0.014, north - south, east, y, (north + south) / 2);
    ar(north - south, 0.014, 0.042, 12.1 + (east - 12.1) / 2, y, north);
    ar(north - south, 0.014, 0.042, 12.1 + (east - 12.1) / 2, y, south);
    ar(0.042, 0.014, north - south, 12.18, y, (north + south) / 2);
  }
  annexRim(19.52, 12.72, 0.08, 0.002);
  annexRim(19.77, 12.87, -0.07, -0.198);
  annexRim(20.02, 13.02, -0.22, -0.518);
  annexRim(20.17, 13.1, -0.3, -0.938);

  /* ---------------- plaza / approaches ---------------- */
  addBox(g, 7.3, 0.16, 12.5, M.stone, 15.825, 0, 6.4, { receive: true, line: 0.012 });
  // low stone border on north/east
  addBox(g, 7.3, 0.10, 0.12, M.stone2, 15.825, 0.16, 12.6, { receive: true });
  addBox(g, 0.12, 0.10, 12.4, M.stone2, 19.44, 0.16, 6.4, { receive: true });
  // path from the far sidewalk to the forecourt
  addBox(g, 1.5, 0.16, 1.8, M.stone, 11.7, 0, 10.9, { receive: true });
  // path to the west side door
  addBox(g, 1.5, 0.16, 1.6, M.stone, 11.65, 0, 5.15, { receive: true });
  // door steps
  addBox(g, 1.9, 0.14, 0.5, M.stone2, 15.1, 0.16, 8.45, { receive: true });
  addBox(g, 0.65, 0.14, 1.25, M.stone2, 12.95, 0.16, 5.4, { receive: true });

  /* ---------------- shop shell ---------------- */
  addBox(g, 5.3, 0.14, 5.5, M.stone2, 15.8, 0.16, 5.5, { cast: true, receive: true });
  addBox(g, 5.0, 0.04, 5.2, M.floor, 15.8, FLOOR, 5.5, { receive: true });

  // back wall
  addBox(g, 5.2, 3.0, 0.16, M.plaster, 15.8, FLOOR, SHZ0 + 0.08, { cast: true, line: 0.018 });
  // east wall
  addBox(g, 0.16, 3.0, 5.4, M.plaster, SHX1, FLOOR, 5.5, { cast: true, line: 0.018 });
  // west wall: side entrance z 4.9..5.9
  addBox(g, 0.16, 3.0, 2.1, M.plaster, SHX0, FLOOR, 3.85, { cast: true, line: 0.018 });
  addBox(g, 0.16, 3.0, 2.25, M.plaster, SHX0, FLOOR, 7.075, { cast: true, line: 0.018 });
  addBox(g, 0.16, 1.0, 1.1, M.plaster, SHX0, 2.3, 5.4, { cast: true });
  // west side door (slightly open) + frame
  addBox(g, 0.05, 2.0, 1.02, M.wood2, SHX0 - 0.06, FLOOR, 5.4, { cast: true });
  addBox(g, 0.03, 1.55, 0.72, M.glass, SHX0 - 0.09, 0.45, 5.4);
  // front wall segments
  const front = (x0, x1, y0, y1) => addBox(g, x1 - x0, y1 - y0, 0.16, M.plaster, (x0 + x1) / 2, y0, SHZ1, { cast: true, line: 0.016 });
  front(13.2, 14.3, FLOOR, 3.3);
  front(15.9, 16.5, FLOOR, 3.3);
  front(17.9, 18.4, FLOOR, 3.3);
  front(14.3, 15.9, 2.3, 3.3);
  front(16.5, 17.9, 2.2, 3.3);
  front(16.5, 17.9, FLOOR, 0.85);
  // dark timber wainscot on the front
  addBox(g, 1.1, 0.55, 0.05, M.wood, 13.75, FLOOR, SHZ1 + 0.085);
  addBox(g, 0.6, 0.55, 0.05, M.wood, 16.2, FLOOR, SHZ1 + 0.085);
  addBox(g, 1.35, 0.55, 0.05, M.wood, 17.2, FLOOR, SHZ1 + 0.085);
  addBox(g, 0.5, 0.55, 0.05, M.wood, 18.15, FLOOR, SHZ1 + 0.085);

  // timber posts + beams
  const posts = [[13.2, 3.3], [14.3, 3.3], [15.9, 3.3], [16.5, 3.3], [17.9, 3.3], [18.4, 3.3]];
  for (const [x, top] of posts) addBox(g, 0.13, top - FLOOR, 0.13, M.wood, x, FLOOR, SHZ1 + 0.02, { cast: true, line: 0.01 });
  addBox(g, 5.3, 0.13, 0.15, M.wood, 15.8, 2.28, SHZ1 + 0.02, { cast: true });
  addBox(g, 5.3, 0.13, 0.15, M.wood, 15.8, 3.18, SHZ1 + 0.02, { cast: true });
  // east/west corner posts + wall band
  addBox(g, 0.14, 3.0, 5.4, M.wood, SHX0 - 0.01, FLOOR, 5.5);
  addBox(g, 0.14, 3.0, 5.4, M.wood, SHX1 + 0.01, FLOOR, 5.5);
  addBox(g, 0.06, 0.9, 5.4, M.wood, SHX1 + 0.08, FLOOR, 5.5);
  addBox(g, 0.06, 0.9, 5.4, M.wood, SHX0 - 0.08, FLOOR, 5.5);
  addBox(g, 5.0, 0.12, 0.08, M.wood, 15.8, 2.85, SHZ1 + 0.085);

  // door glass + frame
  addPlane(g, 1.48, 1.95, M.glass, 15.1, 1.30, SHZ1 + 0.095);
  addBox(g, 0.06, 2.0, 0.07, M.wood, 14.33, FLOOR, SHZ1 + 0.11);
  addBox(g, 0.06, 2.0, 0.07, M.wood, 15.87, FLOOR, SHZ1 + 0.11);
  addBox(g, 1.6, 0.07, 0.08, M.wood, 15.1, 2.28, SHZ1 + 0.11);
  addBox(g, 0.05, 0.55, 0.05, M.metal, 15.0, 1.05, SHZ1 + 0.14);
  addBox(g, 1.45, 0.06, 0.08, M.wood, 15.1, FLOOR, SHZ1 + 0.11);
  // window
  addPlane(g, 1.36, 1.32, M.glass, 17.2, 1.52, SHZ1 + 0.095);
  addBox(g, 0.06, 1.36, 0.07, M.wood, 16.52, 0.85, SHZ1 + 0.11);
  addBox(g, 0.06, 1.36, 0.07, M.wood, 17.88, 0.85, SHZ1 + 0.11);
  addBox(g, 1.42, 0.06, 0.08, M.wood, 17.2, 2.2, SHZ1 + 0.11);
  addBox(g, 1.42, 0.06, 0.08, M.wood, 17.2, 0.85, SHZ1 + 0.11);
  addPlane(g, 1.28, 0.34, new THREE.MeshBasicMaterial({ color: 0xffe6bd, transparent: true, opacity: 0.55 }), 17.2, 2.0, SHZ1 + 0.08);

  /* ---------------- interior ---------------- */
  addBox(g, 4.9, 0.06, 5.0, M.dark, 15.8, 2.88, 5.5, { receive: true });
  // counter
  addBox(g, 4.0, 0.78, 0.9, M.wood2, 15.6, FLOOR, 4.45, { cast: true, line: 0.014 });
  addBox(g, 4.1, 0.07, 1.0, M.counterTop, 15.6, 1.08, 4.45, { cast: true });
  // kitchen behind
  addBox(g, 4.4, 0.9, 0.55, M.wood, 15.8, 0.7, 3.15);
  addBox(g, 1.1, 0.72, 0.6, M.metal, 16.8, FLOOR, 3.35, { cast: true });
  addCyl(g, 0.3, 0.3, 0.34, 16, M.dark, 16.8, 1.02, 3.35);
  addCyl(g, 0.32, 0.32, 0.05, 16, M.metal, 16.8, 1.36, 3.35);
  addCyl(g, 0.14, 0.14, 0.05, 12, M.cream, 14.1, 1.12, 3.35);
  addCyl(g, 0.14, 0.14, 0.05, 12, M.cream, 14.5, 1.12, 3.35);
  // back shelf
  addBox(g, 2.8, 0.08, 0.26, M.wood3, 15.3, 1.9, 3.02);
  for (let i = 0; i < 7; i++) addCyl(g, 0.08, 0.1, 0.09, 10, M.cream, 14.2 + i * 0.34, 1.98, 3.02);
  // menu board
  addPlane(g, 2.15, 0.62, new THREE.MeshBasicMaterial({ map: menuTexture() }), 15.3, 2.48, 3.04, { rot: [0, 0, 0] });
  // stools
  for (let i = 0; i < 4; i++) {
    const x = 14.15 + i * 0.98;
    addCyl(g, 0.17, 0.15, 0.07, 12, M.wood3, x, 0.70, 5.5);
    addCyl(g, 0.035, 0.045, 0.62, 8, M.metal, x, FLOOR, 5.5);
    addCyl(g, 0.16, 0.16, 0.025, 12, M.metal, x, 0.44, 5.5);
  }
  // bowls on the counter
  addCyl(g, 0.1, 0.08, 0.08, 12, M.cream, 14.4, 1.11, 4.25);
  addCyl(g, 0.1, 0.08, 0.08, 12, M.cream, 16.7, 1.11, 4.25);
  // pendants
  for (const x of [14.6, 16.7]) {
    addCyl(g, 0.02, 0.02, 0.5, 6, M.dark, x, 2.9, 4.6);
    addMesh(g, new THREE.ConeGeometry(0.22, 0.18, 12, 1, true), M.warm, x, 2.55, 4.6);
    addGlow(g, 0xffcc88, 0.85, x, 2.45, 4.6, 0.28);
  }
  // interior light
  const interiorLight = new THREE.PointLight(0xffb877, 6.0, 8.0, 2);
  interiorLight.position.set(15.7, 2.45, 5.7);
  g.add(interiorLight);

  /* ---------------- roof / gable ---------------- */
  // roof panels
  const roofL = addBox(g, 3.45, 0.13, 6.0, M.roof, 14.4, 3.82, 5.5, { cast: true, line: 0.018 });
  roofL.rotation.z = 0.305;
  const roofR = addBox(g, 3.45, 0.13, 6.0, M.roof, 17.2, 3.82, 5.5, { cast: true, line: 0.018 });
  roofR.rotation.z = -0.305;
  addBox(g, 0.2, 0.14, 6.1, M.dark, 15.8, 4.33, 5.5, { cast: true });
  // front/back gable triangles
  const shape = new THREE.Shape();
  shape.moveTo(13.2, 3.3);
  shape.lineTo(18.4, 3.3);
  shape.lineTo(15.8, 4.35);
  shape.closePath();
  const gableGeo = new THREE.ShapeGeometry(shape);
  const gableFront = new THREE.Mesh(gableGeo, M.plaster);
  gableFront.position.z = SHZ1 + 0.01;
  g.add(gableFront);
  const gableBack = new THREE.Mesh(gableGeo, M.plaster);
  gableBack.position.z = SHZ0 - 0.01;
  gableBack.rotation.y = Math.PI;
  g.add(gableBack);
  // gable trim
  addBox(g, 0.12, 0.12, 0.1, M.wood, 15.8, 4.33, SHZ1 + 0.06);
  addBox(g, 5.3, 0.13, 0.15, M.wood, 15.8, 3.28, SHZ1 + 0.03, { cast: true });
  // eave board
  addBox(g, 5.6, 0.10, 0.14, M.dark, 15.8, 3.3, SHZ1 + 0.14);
  addBox(g, 5.6, 0.10, 0.14, M.dark, 15.8, 3.3, SHZ0 - 0.14);

  /* ---------------- porch ---------------- */
  addBox(g, 5.3, 0.08, 1.3, M.roof, 15.8, 2.67, 8.85, { cast: true, line: 0.014 }).rotation.x = -0.17;
  addBox(g, 5.3, 0.12, 0.1, M.dark, 15.8, 2.6, 9.45);
  for (const x of [13.38, 18.22]) {
    addBox(g, 0.12, 2.45, 0.12, M.wood, x, 0.16, 9.4, { cast: true, line: 0.01 });
    addBox(g, 0.18, 0.07, 0.18, M.dark, x, 2.58, 9.4);
  }
  addBox(g, 5.0, 0.11, 0.13, M.wood, 15.8, 2.46, 9.38);

  /* ---------------- signage ---------------- */
  // gable light box
  addBox(g, 2.95, 0.8, 0.14, M.cream, 15.8, 3.5, SHZ1 + 0.08, { cast: true, line: 0.014 });
  const gsMat = new THREE.MeshBasicMaterial({ map: gableSignTexture() });
  addPlane(g, 2.85, 0.72, gsMat, 15.8, 3.9, SHZ1 + 0.16);
  addGlow(g, 0xffdca0, 4.0, 15.8, 3.9, SHZ1 + 0.4, 0.18);
  // blade sign on the east wall
  addBox(g, 0.08, 1.25, 0.55, M.cream, 18.55, 2.55, 7.0, { cast: true, line: 0.01 });
  const bMat = new THREE.MeshBasicMaterial({ map: bladeSignTexture() });
  addPlane(g, 0.53, 1.22, bMat, 18.6, 3.17, 7.0, { rot: [0, Math.PI / 2, 0] });
  addPlane(g, 0.53, 1.22, bMat, 18.5, 3.17, 7.0, { rot: [0, -Math.PI / 2, 0] });
  addBox(g, 0.3, 0.05, 0.05, M.dark, 18.38, 3.7, 7.0);
  addGlow(g, 0xffe2b0, 1.6, 18.65, 3.15, 7.0, 0.2);

  // noren over the door
  const norenMat = toon(0xffffff, { map: norenTexture('らーめん'), side: THREE.DoubleSide });
  const norenGroup = new THREE.Group();
  norenGroup.position.set(15.1, 2.3, SHZ1 + 0.24);
  g.add(norenGroup);
  addCyl(norenGroup, 0.025, 0.025, 1.9, 8, M.wood, 0, 0.03, 0, { rot: [0, 0, Math.PI / 2] });
  addPlane(norenGroup, 1.82, 0.66, norenMat, 0, -0.33, 0);
  addPlane(norenGroup, 0.035, 0.62, new THREE.MeshBasicMaterial({ color: 0x1a2b44 }), -0.3, -0.33, 0.01);
  addPlane(norenGroup, 0.035, 0.62, new THREE.MeshBasicMaterial({ color: 0x1a2b44 }), 0.3, -0.33, 0.01);

  // side noren on the west entrance
  const sideNoren = new THREE.Group();
  sideNoren.position.set(SHX0 - 0.2, 2.25, 5.4);
  sideNoren.rotation.y = -Math.PI / 2;
  g.add(sideNoren);
  addPlane(sideNoren, 1.1, 0.55, norenMat, 0, -0.3, 0);
  addCyl(sideNoren, 0.022, 0.022, 1.2, 8, M.wood, 0, 0.03, 0, { rot: [0, 0, Math.PI / 2] });

  // red paper lantern by the door
  const lantern = new THREE.Group();
  lantern.position.set(13.82, 1.9, SHZ1 + 0.42);
  g.add(lantern);
  addCyl(lantern, 0.2, 0.22, 0.46, 16, new THREE.MeshBasicMaterial({ map: lanternTexture(), side: THREE.DoubleSide, toneMapped: false }), 0, 0, 0, { cast: true });
  addCyl(lantern, 0.13, 0.13, 0.04, 12, M.dark, 0, 0.46, 0);
  addCyl(lantern, 0.13, 0.13, 0.04, 12, M.dark, 0, -0.04, 0);
  addCyl(lantern, 0.012, 0.012, 0.3, 6, M.dark, 0, 0.46, 0);
  const lanternGlow = addGlow(lantern, 0xff8f4a, 2.4, 0, 0.05, 0.12, 0.45);
  const lanternLight = new THREE.PointLight(0xff7d38, 2.6, 4.2, 2);
  lanternLight.position.set(13.82, 1.95, SHZ1 + 0.7);
  g.add(lanternLight);

  /* ---------------- east wall dressing ---------------- */
  // warm side window (lit panel)
  addBox(g, 0.05, 1.1, 1.2, M.wood, SHX1 + 0.1, 0.95, 5.55);
  addPlane(g, 1.0, 0.9, new THREE.MeshBasicMaterial({ color: 0xffc98c, transparent: true, opacity: 0.85 }), SHX1 + 0.13, 1.5, 5.55, { rot: [0, Math.PI / 2, 0] });
  // poster
  addPlane(g, 0.78, 1.14, new THREE.MeshBasicMaterial({ map: posterTexture() }), SHX1 + 0.085, 1.85, 3.75, { rot: [0, Math.PI / 2, 0] });
  // AC outdoor unit
  addBox(g, 0.42, 0.5, 0.72, M.metal, SHX1 + 0.28, 2.3, 6.8, { cast: true, line: 0.012 });
  addCyl(g, 0.16, 0.16, 0.02, 16, M.dark, SHX1 + 0.5, 2.6, 6.8, { rot: [0, 0, Math.PI / 2] });
  // downpipe
  addCyl(g, 0.045, 0.045, 3.2, 8, M.metal, SHX1 + 0.14, 0.16, 8.05);
  addBox(g, 0.12, 0.05, 0.05, M.metal, SHX1 + 0.14, 2.6, 8.0);

  /* ---------------- forecourt ---------------- */
  // ticket machine
  addBox(g, 0.4, 0.72, 0.3, M.red, 14.05, 0.16, 9.0, { cast: true, line: 0.012 });
  addPlane(g, 0.3, 0.44, new THREE.MeshBasicMaterial({ map: ticketTexture() }), 14.05, 0.53, 9.16);
  addGlow(g, 0xffb268, 1.0, 14.05, 0.55, 9.22, 0.2);
  // A-frame menu
  const af = new THREE.Group();
  af.position.set(13.32, 0.16, 9.55);
  af.rotation.y = 0.25;
  g.add(af);
  addBox(af, 0.06, 0.9, 0.05, M.wood, -0.28, 0, 0, { rot: [0, 0, 0.16], cast: true });
  addBox(af, 0.06, 0.9, 0.05, M.wood, 0.28, 0, 0, { rot: [0, 0, -0.16], cast: true });
  const boardMat = new THREE.MeshBasicMaterial({ map: (() => {
    return canvasTexture(256, 320, (ctx, w, h) => {
      ctx.fillStyle = '#2a2621'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c7a56c'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16);
      drawText(ctx, '本日のおすすめ', w / 2, 54, 24, '#efe0c6');
      drawText(ctx, '味玉らーめん', w / 2, 132, 30, '#f0c27d');
      drawText(ctx, '¥ 1,050', w / 2, 188, 32, '#f4e6cd');
      ctx.strokeStyle = 'rgba(220,190,150,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(40, 90); ctx.lineTo(w - 40, 90); ctx.stroke();
      drawText(ctx, '営業中', w / 2, 260, 24, '#d66b4f');
    });
  })() });
  addPlane(af, 0.6, 0.8, boardMat, 0, 0.48, 0.03, { rot: [-0.14, 0, 0] });
  // bench
  const bench = new THREE.Group();
  bench.position.set(17.15, 0.16, 10.7);
  bench.rotation.y = Math.PI / 2;
  g.add(bench);
  for (const x of [-0.62, 0.62]) {
    addBox(bench, 0.08, 0.42, 0.4, M.wood, x, 0, 0);
    addBox(bench, 0.08, 0.5, 0.08, M.wood, x, 0.42, -0.18);
  }
  addBox(bench, 1.5, 0.08, 0.46, M.wood3, 0, 0.42, 0, { cast: true });
  addBox(bench, 1.5, 0.3, 0.06, M.wood3, 0, 0.58, -0.2, { rot: [-0.1, 0, 0] });
  // stone lantern
  const stoneLantern = new THREE.Group();
  stoneLantern.position.set(18.55, 0.16, 10.85);
  g.add(stoneLantern);
  addBox(stoneLantern, 0.5, 0.12, 0.5, M.stone2, 0, 0, 0, { cast: true });
  addBox(stoneLantern, 0.3, 0.55, 0.3, M.stone2, 0, 0.12, 0, { cast: true });
  addBox(stoneLantern, 0.46, 0.06, 0.46, M.stone2, 0, 0.67, 0);
  addBox(stoneLantern, 0.4, 0.3, 0.4, M.warm, 0, 0.73, 0, { line: 0.01 });
  addMesh(stoneLantern, new THREE.ConeGeometry(0.42, 0.26, 4), M.stone2, 0, 1.16, 0, { rot: [0, Math.PI / 4, 0], cast: true });
  addCyl(stoneLantern, 0.06, 0.06, 0.12, 8, M.stone2, 0, 1.28, 0);
  addGlow(stoneLantern, 0xffb45f, 1.2, 0, 0.85, 0.25, 0.3);
  // crates
  addBox(g, 0.46, 0.34, 0.36, M.red2, 18.95, 0.16, 7.55, { cast: true, line: 0.01 });
  addBox(g, 0.44, 0.32, 0.34, M.red2, 18.93, 0.5, 7.53, { cast: true, line: 0.01 });
  // shrubs
  for (const [sx, sz, ss] of [[18.98, 9.15, 0.58], [18.98, 4.5, 0.5], [12.45, 11.9, 0.55]]) {
    addBox(g, 0.5, 0.3, 0.5, M.wood2, sx, 0.16, sz, { cast: true });
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(ss, 0), toon(0x3f6a4a, { flatShading: true }));
    bush.position.set(sx, 0.55 + ss * 0.7, sz);
    bush.castShadow = true;
    g.add(bush);
    const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(ss, 0), snowCapMaterial);
    cap.position.set(sx, 0.78 + ss * 0.7, sz);
    cap.scale.set(1.0, 0.28, 1.0);
    cap.renderOrder = 3;
    g.add(cap);
  }
  // east bamboo fence
  addPlane(g, 12.3, 1.0, toon(0xffffff, { map: bambooTexture(), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide }), 19.42, 0.68, 6.4, { rot: [0, Math.PI / 2, 0] });
  for (let z = 0.6; z <= 12.2; z += 1.65) addCyl(g, 0.045, 0.05, 1.15, 8, M.wood, 19.42, 0.16, z, { cast: true });
  addCyl(g, 0.035, 0.035, 12.2, 8, M.wood, 19.42, 1.25, 6.4, { rot: [Math.PI / 2, 0, 0] });
  addCyl(g, 0.03, 0.03, 12.2, 8, M.wood, 19.42, 0.4, 6.4, { rot: [Math.PI / 2, 0, 0] });

  /* ---------------- roof vent + steam ---------------- */
  addCyl(g, 0.12, 0.14, 0.5, 10, M.metal, 17.0, 4.0, 3.8, { cast: true });
  addCyl(g, 0.2, 0.2, 0.06, 10, M.dark, 17.0, 4.5, 3.8);
  const steamTex = steamTexture();
  const steamParts = [];
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false, color: 0xf3eee6, toneMapped: false });
    const s = new THREE.Sprite(mat);
    s.position.set(17.0, 4.55, 3.8);
    s.scale.set(0.3, 0.3, 1);
    s.renderOrder = 6;
    g.add(s);
    steamParts.push({ sprite: s, t: i / 7, speed: 0.16 + (i % 3) * 0.025, drift: (i % 2 ? 1 : -1) * (0.06 + (i % 4) * 0.02) });
  }

  /* ---------------- snow cover ---------------- */
  const snowPlane = (w, d, x, y, z) => {
    const m = new THREE.Mesh(planeGeo(w, d), snowGroundMaterial);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.renderOrder = 2;
    g.add(m);
    return m;
  };
  snowPlane(7.2, 12.4, 15.825, 0.163, 6.4);
  snowPlane(1.5, 1.8, 11.7, 0.163, 10.9);
  snowPlane(1.5, 1.6, 11.65, 0.163, 5.15);
  const snowCap = (w, h, d, x, y, z, rot) => {
    const m = addBox(g, w, h, d, snowCapMaterial, x, y, z, rot ? { rot } : {});
    m.renderOrder = 3;
    return m;
  };
  // roof + porch + ridge
  snowCap(3.45, 0.06, 6.0, 14.4, 3.90, 5.5, [0, 0, 0.305]);
  snowCap(3.45, 0.06, 6.0, 17.2, 3.90, 5.5, [0, 0, -0.305]);
  snowCap(0.24, 0.05, 6.1, 15.8, 4.39, 5.5);
  snowCap(5.25, 0.05, 1.25, 15.8, 2.715, 8.85, [-0.17, 0, 0]);
  // sign tops / lantern / ticket / bench / A-frame / stone lantern / fence / crates
  snowCap(3.0, 0.045, 0.18, 15.8, 4.30, SHZ1 + 0.08);
  snowCap(0.1, 0.04, 0.58, 18.55, 3.80, 7.0);
  snowCap(0.26, 0.03, 0.26, 13.82, 2.38, SHZ1 + 0.42);
  snowCap(0.44, 0.035, 0.34, 14.05, 0.88, 9.0);
  snowCap(1.52, 0.04, 0.5, 17.15, 0.66, 10.7, [0, Math.PI / 2, 0]);
  snowCap(0.62, 0.035, 0.1, 13.32, 0.86, 9.55, [0, 0.25, 0]);
  snowCap(0.46, 0.035, 0.46, 18.55, 1.46, 10.85);
  snowCap(0.06, 0.035, 12.2, 19.42, 1.28, 6.4);
  snowCap(0.48, 0.035, 0.38, 18.94, 0.82, 7.54);
  snowCap(0.5, 0.03, 0.5, 12.45, 0.47, 11.9);
  snowCap(0.44, 0.03, 0.5, 18.7, 2.82, 6.8);
  snowCap(1.9, 0.035, 0.5, 15.1, 0.30, 8.45);
  snowCap(0.65, 0.035, 1.25, 12.95, 0.30, 5.4);
  // snow on the noren rod
  addCyl(g, 0.035, 0.035, 1.9, 8, snowCapMaterial, 15.1, 2.33, SHZ1 + 0.24, { rot: [0, 0, Math.PI / 2] });
  // snow on the ticket top / stone border
  snowCap(7.2, 0.035, 0.12, 15.825, 0.26, 12.6);
  snowCap(0.12, 0.035, 12.4, 19.44, 0.26, 6.4);

  /* ---------------- update ---------------- */
  let timeAcc = 0;
  function update(t, dt) {
    timeAcc += dt;
    // steam puffs rise from the roof vent
    for (const p of steamParts) {
      p.t += dt * p.speed;
      if (p.t > 1) p.t -= 1;
      const k = p.t;
      p.sprite.position.set(17.0 + p.drift * k * 2.2 + Math.sin(t * 1.3 + k * 6) * 0.08, 4.55 + k * 2.3, 3.8 + p.drift * k * 0.8);
      const sc = 0.22 + k * 0.75;
      p.sprite.scale.set(sc, sc, 1);
      p.sprite.material.opacity = Math.sin(k * Math.PI) * 0.16;
    }
    // lantern breath
    lanternLight.intensity = 2.55 + Math.sin(t * 3.1) * 0.18 + Math.sin(t * 7.7) * 0.06;
    lanternGlow.material.opacity = 0.42 + Math.sin(t * 3.1) * 0.04;
    // noren sway
    norenGroup.rotation.z = Math.sin(t * 1.15) * 0.022;
    norenGroup.rotation.x = Math.sin(t * 0.7 + 1.3) * 0.012;
    sideNoren.rotation.z = Math.sin(t * 1.0 + 0.8) * 0.02;
  }

  return { group: g, update };
}