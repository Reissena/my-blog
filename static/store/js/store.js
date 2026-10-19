// ---------------------------------------------------------------------------
// store.js — 日式便利店：玻璃立面、室内货架、招牌、屋顶设备
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L } from './layout.js';
import {
  canvasTexture, verticalSignTexture, JP_FONT, rand, randInt, mulberry32,
  stdMat, clamp,
} from './util.js';

const S = L.store;
const W = S.x1 - S.x0;
const D = S.z1 - S.z0;
const CX = (S.x0 + S.x1) / 2;
const CZ = (S.z0 + S.z1) / 2;
const WALL_TOP = S.wallH;          // 3.55
const GLASS_BOTTOM = 0.18;
const GLASS_TOP = 2.92;

// --------------------------------------------------------------- textures
function mainSignTexture() {
  return canvasTexture(2048, 224, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fffdf6');
    g.addColorStop(1, '#f3ead7');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // 绿色装饰线
    c.fillStyle = '#2a6a51';
    c.fillRect(0, h - 18, w, 18);
    c.fillStyle = '#7fae95';
    c.fillRect(0, h - 24, w, 6);

    // 樱花图标
    c.save();
    c.translate(168, h / 2 - 8);
    for (let i = 0; i < 5; i++) {
      c.save();
      c.rotate((i / 5) * Math.PI * 2);
      c.fillStyle = i % 2 ? '#f7a8bc' : '#ffc3d2';
      c.beginPath();
      c.ellipse(0, -46, 26, 44, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.fillStyle = '#ffdca3';
    c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill();
    c.restore();

    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#1f5c46';
    c.font = '700 116px ' + JP_FONT;
    c.fillText('さくらマート', 246, h / 2 - 12);

    c.fillStyle = '#2a6a51';
    c.font = '600 42px "Inter", "Segoe UI", sans-serif';
    c.fillText('SAKURA  MART', 250, h / 2 + 68);

    c.textAlign = 'right';
    c.fillStyle = '#4a7a66';
    c.font = '600 40px "Inter", "Segoe UI", sans-serif';
    c.fillText('OPEN 24 HOURS', w - 62, h / 2 - 20);
    c.fillStyle = '#a05a68';
    c.font = '500 38px "Yu Gothic", Meiryo, sans-serif';
    c.fillText('桜通り店', w - 62, h / 2 + 48);
    c.fillStyle = '#c9bda4';
    c.font = '400 24px "Inter", sans-serif';
    c.fillText('SINCE 1998', w - 62, h / 2 + 92);
  });
}

function smallSignTexture(text, sub, bg, fg, accent) {
  return canvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = accent; c.lineWidth = 10;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = fg;
    c.font = '700 108px ' + JP_FONT;
    c.fillText(text, w / 2, h / 2 - 8);
    c.font = '500 34px "Inter", sans-serif';
    c.fillStyle = accent;
    c.fillText(sub, w / 2, h - 46);
  });
}

function posterTexture(title, sub, bg1, bg2, accent) {
  return canvasTexture(320, 448, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, bg1); g.addColorStop(1, bg2);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.18;
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(20, 90), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = accent;
    c.fillRect(28, 34, 52, 8);
    c.fillStyle = '#fffdf6';
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.font = '700 58px ' + JP_FONT;
    const lines = Array.from(title);
    lines.forEach((ch, i) => c.fillText(ch, 30, 70 + i * 62));
    c.font = '500 24px "Inter", sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.82)';
    c.fillText(sub, 30, h - 62);
  });
}

function floorTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#d9d2c2'; c.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 210 + Math.random() * 12;
      c.fillStyle = 'rgb(' + Math.round(v) + ',' + Math.round(v - 6) + ',' + Math.round(v - 18) + ')';
      c.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      c.fillStyle = 'rgba(120,105,80,0.06)';
      for (let i = 0; i < 10; i++) c.fillRect(x * s + rand(4, s - 8), y * s + rand(4, s - 8), rand(2, 20), rand(1, 2));
    }
    c.strokeStyle = 'rgba(120,110,92,0.28)'; c.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.stroke();
      c.beginPath(); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke();
    }
  }, { wrap: true, repeat: [3, 3] });
}

function grilleTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#3a3d41'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#4c5055'; c.lineWidth = 4;
    for (let i = 1; i < 6; i++) {
      c.beginPath(); c.arc(64, 64, i * 10, 0, Math.PI * 2); c.stroke();
    }
    c.fillStyle = '#22252a';
    for (let i = 0; i < 8; i++) {
      c.save(); c.translate(64, 64); c.rotate((i / 8) * Math.PI * 2);
      c.fillRect(-2.5, 8, 5, 50); c.restore();
    }
  });
}

// --------------------------------------------------------------- main build
export function buildStore(ctx) {
  const group = new THREE.Group();
  group.name = 'store';
  ctx.scene.add(group);

  const rnd = mulberry32(1987);
  const mats = {
    wall: new THREE.MeshStandardMaterial({ color: 0xe9e3d5, roughness: 0.87, metalness: 0.02, side: THREE.DoubleSide }),
    wallInner: new THREE.MeshStandardMaterial({ color: 0xf2ebdd, roughness: 0.92, metalness: 0.0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2c3137, roughness: 0.42, metalness: 0.62 }),
    trimSoft: new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.55, metalness: 0.4 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x7f8488, roughness: 0.85, metalness: 0.18 }),
    roofDark: new THREE.MeshStandardMaterial({ color: 0x4d5258, roughness: 0.68, metalness: 0.4 }),
    green: new THREE.MeshStandardMaterial({ color: 0x1f5a45, roughness: 0.75, metalness: 0.08, side: THREE.DoubleSide }),
    greenDark: new THREE.MeshStandardMaterial({ color: 0x154234, roughness: 0.7, metalness: 0.12 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.45, metalness: 0.7 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 0.95, metalness: 0.02 }),
    kick: new THREE.MeshStandardMaterial({ color: 0x1e4a3c, roughness: 0.62, metalness: 0.18 }),
  };

  const bx = (w, h, d, mat, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // ---------------------------------------------------------------- 外壳
  // 南立面（+Z，临街）
  bx(W, WALL_TOP - GLASS_TOP, 0.26, mats.wall, CX, (WALL_TOP + GLASS_TOP) / 2, S.z1 - 0.13);
  bx(0.66, GLASS_TOP, 0.26, mats.wall, S.x0 + 0.33, GLASS_TOP / 2, S.z1 - 0.13);
  bx(0.66, GLASS_TOP, 0.26, mats.wall, S.x1 - 0.33, GLASS_TOP / 2, S.z1 - 0.13);
  bx(W - 1.32, GLASS_BOTTOM, 0.3, mats.kick, CX, GLASS_BOTTOM / 2, S.z1 - 0.14);

  // 东立面（+X，临街）
  bx(0.26, WALL_TOP - GLASS_TOP, D, mats.wall, S.x1 - 0.13, (WALL_TOP + GLASS_TOP) / 2, CZ);
  bx(0.26, GLASS_TOP, 0.66, mats.wall, S.x1 - 0.13, GLASS_TOP / 2, S.z0 + 0.33);
  bx(0.26, GLASS_TOP, 0.66, mats.wall, S.x1 - 0.13, GLASS_TOP / 2, S.z1 - 0.33);
  bx(0.3, GLASS_BOTTOM, D - 1.32, mats.kick, S.x1 - 0.14, GLASS_BOTTOM / 2, CZ);

  // 北 / 西实墙
  bx(W, WALL_TOP, 0.26, mats.wall, CX, WALL_TOP / 2, S.z0 + 0.13);
  bx(0.26, WALL_TOP, D, mats.wall, S.x0 + 0.13, WALL_TOP / 2, CZ);

  // 玻璃
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8c8d4, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.07,
    envMapIntensity: 1.15, depthWrite: false, side: THREE.DoubleSide,
    clearcoat: 1, clearcoatRoughness: 0.06,
  });
  ctx.glassMats.push(glassMat);

  const glassS = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.32, GLASS_TOP - GLASS_BOTTOM), glassMat);
  glassS.position.set(CX, (GLASS_TOP + GLASS_BOTTOM) / 2, S.z1 - 0.1);
  glassS.renderOrder = 4;
  group.add(glassS);

  const glassE = new THREE.Mesh(new THREE.PlaneGeometry(D - 1.32, GLASS_TOP - GLASS_BOTTOM), glassMat);
  glassE.position.set(S.x1 - 0.1, (GLASS_TOP + GLASS_BOTTOM) / 2, CZ);
  glassE.rotation.y = Math.PI / 2;
  glassE.renderOrder = 4;
  group.add(glassE);

  // 窗框 / 竖梃
  const southMul = [-7.35, -5.55, -3.75, -1.95, -0.15, 1.55];
  for (const x of southMul) bx(0.075, GLASS_TOP - GLASS_BOTTOM, 0.12, mats.trim, x, (GLASS_TOP + GLASS_BOTTOM) / 2, S.z1 - 0.06);
  const eastMulZ = [-5.35, -3.55, -1.75, 0.05, 1.85];
  for (const z of eastMulZ) {
    const m = bx(0.12, GLASS_TOP - GLASS_BOTTOM, 0.075, mats.trim, S.x1 - 0.06, (GLASS_TOP + GLASS_BOTTOM) / 2, z);
  }
  bx(W - 1.2, 0.09, 0.14, mats.trim, CX, GLASS_TOP + 0.02, S.z1 - 0.06);
  bx(W - 1.2, 0.07, 0.14, mats.trim, CX, GLASS_BOTTOM + 0.02, S.z1 - 0.06);
  bx(0.14, 0.09, D - 1.2, mats.trim, S.x1 - 0.06, GLASS_TOP + 0.02, CZ);
  bx(0.14, 0.07, D - 1.2, mats.trim, S.x1 - 0.06, GLASS_BOTTOM + 0.02, CZ);

  // 自动门（南侧东端）
  const doorX = 2.45;
  bx(0.1, 2.9, 0.16, mats.darkMetal, doorX - 0.95, 1.45, S.z1 - 0.04);
  bx(0.1, 2.9, 0.16, mats.darkMetal, doorX + 0.95, 1.45, S.z1 - 0.04);
  bx(1.98, 0.12, 0.16, mats.darkMetal, doorX, 2.86, S.z1 - 0.04);
  // 门把手
  for (const dx of [-0.18, 0.18]) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.92, 8), mats.metal);
    handle.position.set(doorX + dx, 1.15, S.z1 + 0.02);
    handle.castShadow = true;
    group.add(handle);
  }
  // 自动门贴纸
  const doorSticker = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#1f5a45'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fffdf2';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 54px ' + JP_FONT;
    c.fillText('自動ドア', w / 2, h / 2 - 6);
    c.font = '500 20px "Inter", sans-serif';
    c.fillText('AUTOMATIC DOOR', w / 2, h - 26);
  });
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: doorSticker, transparent: true }));
  sticker.position.set(doorX - 0.5, 1.55, S.z1 + 0.001);
  group.add(sticker);

  // 门口地垫 / 台阶
  const matPad = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x36393d, roughness: 0.95 }));
  matPad.rotation.x = -Math.PI / 2;
  matPad.position.set(doorX, 0.023, S.z1 + 0.72);
  matPad.receiveShadow = true;
  group.add(matPad);
  bx(2.5, 0.09, 1.4, mats.concrete, doorX, 0.045, S.z1 + 0.5);
  const step = group.children[group.children.length - 1];
  step.position.y = 0.045;

  // ---------------------------------------------------------------- 室内
  const interior = new THREE.Group();
  group.add(interior);

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.6, metalness: 0.03, color: 0xfff6e6 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.08, D - 0.5), floorMat);
  floor.position.set(CX, 0.06, CZ);
  floor.receiveShadow = true;
  interior.add(floor);

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.12, D - 0.5), new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 }));
  ceil.position.set(CX, 3.08, CZ);
  interior.add(ceil);

  // 天花灯槽
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff4dc, emissive: 0xffd9a0, emissiveIntensity: 1.15, roughness: 0.4,
  });
  ctx.interiorLightMats.push(lampMat);
  for (const x of [-6.0, -3.2, -0.4, 2.4]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 8.6), lampMat);
    panel.position.set(x, 3.0, CZ);
    interior.add(panel);
  }
  // 回风口
  for (const z of [-4.2, 1.6, 3.6]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.34), mats.darkMetal);
    vent.position.set(-7.2, 3.0, z);
    interior.add(vent);
  }

  // 室内灯（暖色）
  const warmLights = [];
  for (const p of [[-4.6, 2.8, 1.4], [-1.2, 2.8, 2.2], [-4.0, 2.8, -3.2]]) {
    const l = new THREE.PointLight(0xffd2a0, 46, 14, 1.85);
    l.position.set(p[0], p[1], p[2]);
    l.castShadow = false;
    interior.add(l);
    warmLights.push(l);
  }
  const coolLight = new THREE.PointLight(0xbfe6ff, 17, 9, 2.0);
  coolLight.position.set(-3.4, 1.9, -4.6);
  interior.add(coolLight);
  warmLights.push(coolLight);

  // --- 冷柜（北墙，带内发光与玻璃门）
  const coolerW = 7.0, coolerH = 2.35, coolerD = 0.72;
  const coolerX = -3.3, coolerZ = S.z0 + 0.55;
  const coolerBaseY = 0.16;
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6, metalness: 0.05 });
  const coolerGroup = new THREE.Group();
  interior.add(coolerGroup);

  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(coolerW, coolerH, 0.1), shellMat);
  backPanel.position.set(coolerX, coolerBaseY + coolerH / 2, coolerZ - coolerD / 2 + 0.05);
  coolerGroup.add(backPanel);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, coolerH, coolerD), shellMat);
    side.position.set(coolerX + sx * (coolerW / 2 - 0.05), coolerBaseY + coolerH / 2, coolerZ);
    coolerGroup.add(side);
  }
  const coolerTop = new THREE.Mesh(new THREE.BoxGeometry(coolerW, 0.1, coolerD), shellMat);
  coolerTop.position.set(coolerX, coolerBaseY + coolerH, coolerZ);
  coolerGroup.add(coolerTop);
  const coolerBottom = new THREE.Mesh(new THREE.BoxGeometry(coolerW, 0.1, coolerD), shellMat);
  coolerBottom.position.set(coolerX, coolerBaseY, coolerZ);
  coolerGroup.add(coolerBottom);

  // 内发光背板
  const coolerBack = new THREE.Mesh(
    new THREE.PlaneGeometry(coolerW - 0.26, coolerH - 0.18),
    new THREE.MeshStandardMaterial({ color: 0xeaf7ff, emissive: 0xcfe9ff, emissiveIntensity: 0.8, roughness: 0.7 })
  );
  coolerBack.position.set(coolerX, coolerBaseY + coolerH / 2, coolerZ - coolerD / 2 + 0.12);
  coolerGroup.add(coolerBack);
  ctx.interiorLightMats.push(coolerBack.material);

  // 层板
  const shelfYs = [0.6, 0.98, 1.36, 1.74, 2.1];
  const coolerShelfMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.6 });
  for (const sy of shelfYs) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(coolerW - 0.24, 0.03, 0.5), coolerShelfMat);
    sh.position.set(coolerX, sy, coolerZ + 0.03);
    coolerGroup.add(sh);
  }

  // 饮料瓶
  const bottleGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.23, 8);
  const bottleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.05 });
  const bottleColors = [0x7fc8ff, 0xffc46b, 0x9fe0a0, 0xff8f8f, 0xfff0c0, 0xd0a8ff, 0xf7f8ff, 0x7ce0d0];
  const perRow = 24;
  const bottles = new THREE.InstancedMesh(bottleGeo, bottleMat, shelfYs.length * perRow);
  const mtx = new THREE.Matrix4();
  let bi = 0;
  shelfYs.forEach((sy) => {
    for (let i = 0; i < perRow; i++) {
      const px = coolerX - coolerW / 2 + 0.3 + (i / (perRow - 1)) * (coolerW - 0.6);
      mtx.makeTranslation(px, sy + 0.14, coolerZ + 0.03);
      bottles.setMatrixAt(bi, mtx);
      bottles.setColorAt(bi, new THREE.Color(bottleColors[Math.floor(rnd() * bottleColors.length)]));
      bi++;
    }
  });
  bottles.instanceMatrix.needsUpdate = true;
  bottles.instanceColor.needsUpdate = true;
  coolerGroup.add(bottles);

  // 玻璃门
  const coolerGlass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe8f0, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.1,
    envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide,
  });
  const cg = new THREE.Mesh(new THREE.PlaneGeometry(coolerW - 0.2, coolerH - 0.16), coolerGlass);
  cg.position.set(coolerX, coolerBaseY + coolerH / 2, coolerZ + coolerD / 2 + 0.01);
  cg.renderOrder = 3;
  coolerGroup.add(cg);
  for (const dx of [-coolerW / 2 + 0.04, -coolerW / 6, coolerW / 6, coolerW / 2 - 0.04]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, coolerH - 0.1, 0.06), mats.darkMetal);
    frame.position.set(coolerX + dx, coolerBaseY + coolerH / 2, coolerZ + coolerD / 2 + 0.02);
    coolerGroup.add(frame);
  }

  // --- 货架
  const productGeo = new THREE.BoxGeometry(1, 1, 1);
  const productMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.04 });
  const placements = [];
  const palette = [0xe45b4a, 0xf2a03c, 0xf5d34c, 0x74b64a, 0x3f8fd2, 0x5a4fb0, 0xe86aa0, 0xf0efe6, 0x8b5a3c, 0x2f7a5c];
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xdad5c8, roughness: 0.7, metalness: 0.12 });
  const shelfTrim = new THREE.MeshStandardMaterial({ color: 0x7d8a90, roughness: 0.5, metalness: 0.5 });

  function gondola(x0, x1, zc, depth, height, levels) {
    const w = x1 - x0;
    bx(w, 0.12, depth, shelfMat, (x0 + x1) / 2, 0.1, zc);
    bx(w, 0.1, 0.06, shelfTrim, (x0 + x1) / 2, 0.19, zc + depth / 2);
    bx(0.06, height, depth, shelfMat, x0, height / 2 + 0.1, zc);
    bx(0.06, height, depth, shelfMat, x1, height / 2 + 0.1, zc);
    for (let l = 0; l < levels; l++) {
      const y = 0.34 + l * ((height - 0.4) / levels);
      bx(w, 0.035, depth - 0.04, shelfMat, (x0 + x1) / 2, y, zc);
      bx(w, 0.055, 0.03, shelfTrim, (x0 + x1) / 2, y + 0.045, zc + depth / 2 - 0.02);
      // 商品：前后两排
      for (const zoff of [-0.22, 0.14]) {
        let px = x0 + 0.16;
        while (px < x1 - 0.14) {
          const bw = 0.09 + rnd() * 0.09;
          const bh = 0.12 + rnd() * 0.12;
          const bd = 0.08 + rnd() * 0.07;
          placements.push({
            x: px + bw / 2, y: y + 0.02 + bh / 2, z: zc + zoff,
            w: bw, h: bh, d: bd,
            color: palette[Math.floor(rnd() * palette.length)],
          });
          px += bw + 0.012;
        }
      }
    }
  }
  gondola(-6.6, 0.6, -2.55, 0.92, 1.5, 4);
  gondola(-6.6, 0.9, 0.05, 0.92, 1.5, 4);
  gondola(1.6, 3.3, -2.55, 0.92, 1.35, 3);

  // 商品实例化
  {
    const inst = new THREE.InstancedMesh(productGeo, productMat, placements.length);
    const matrix = new THREE.Matrix4();
    placements.forEach((p, i) => {
      matrix.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(p.w, p.h, p.d),
      );
      inst.setMatrixAt(i, matrix);
      inst.setColorAt(i, new THREE.Color(p.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    interior.add(inst);
  }

  // --- 收银台
  const counterX = -5.9, counterZ = 4.1;
  bx(3.0, 1.02, 0.78, new THREE.MeshStandardMaterial({ color: 0xdcd6c8, roughness: 0.55, metalness: 0.05 }), counterX, 0.55, counterZ);
  bx(3.08, 0.06, 0.86, new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.35, metalness: 0.1 }), counterX, 1.08, counterZ);
  bx(3.0, 0.1, 0.78, new THREE.MeshStandardMaterial({ color: 0x2a5c46, roughness: 0.7 }), counterX, 0.06, counterZ);
  // 收银机
  bx(0.42, 0.16, 0.34, mats.darkMetal, counterX + 0.7, 1.19, counterZ);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0e2a33, emissive: 0x59d8ff, emissiveIntensity: 1.3, roughness: 0.3 });
  ctx.interiorLightMats.push(screenMat);
  bx(0.4, 0.24, 0.03, screenMat, counterX + 0.7, 1.36, counterZ - 0.05);
  // 热食柜（暖光）
  const hotMat = new THREE.MeshStandardMaterial({ color: 0xffb35c, emissive: 0xff9a3c, emissiveIntensity: 0.9, roughness: 0.5 });
  ctx.interiorLightMats.push(hotMat);
  bx(0.9, 0.5, 0.5, hotMat, counterX - 0.95, 1.36, counterZ);
  bx(0.94, 0.05, 0.54, mats.darkMetal, counterX - 0.95, 1.63, counterZ);
  // 收银台后的烟架
  bx(0.34, 1.5, 3.1, new THREE.MeshStandardMaterial({ color: 0xcfc9bc, roughness: 0.7 }), S.x0 + 0.55, 0.85, counterZ);
  const cigMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0.18, roughness: 0.7 });
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 7; j++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.1), cigMat);
      c.position.set(S.x0 + 0.74, 0.35 + i * 0.24, counterZ - 1.3 + j * 0.16);
      interior.add(c);
    }
  }

  // --- 杂志架 / 店头小物
  bx(2.8, 1.0, 0.5, new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.8 }), -1.4, 0.5, 5.1);
  for (let i = 0; i < 14; i++) {
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.34, 0.02),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[i % palette.length]).multiplyScalar(1.05), roughness: 0.6 })
    );
    cover.position.set(-2.6 + (i % 7) * 0.38, 0.72 + Math.floor(i / 7) * 0.38, 5.34);
    cover.rotation.x = -0.28;
    interior.add(cover);
  }

  // 店内海报
  const posters = [
    posterTexture('新発売', 'SAKURA LATTE', '#ff9db4', '#ffd7c2', '#ffffff'),
    posterTexture('おにぎり', '100円セール', '#2f6f57', '#8fc9a8', '#ffe9a8'),
  ];
  posters.forEach((tex, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.26), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }));
    p.position.set(S.x0 + 0.28, 1.85, 1.0 + i * 1.5);
    p.rotation.y = Math.PI / 2;
    interior.add(p);
  });

  // 入口地垫（内）
  const inMat = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.9), new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: 0.95 }));
  inMat.rotation.x = -Math.PI / 2;
  inMat.position.set(doorX, 0.105, 4.9);
  interior.add(inMat);

  // ---------------------------------------------------------------- 屋顶
  bx(W + 0.34, 0.26, D + 0.34, mats.roof, CX, WALL_TOP + 0.13, CZ);
  const parapetY = WALL_TOP + 0.26 + 0.16;
  bx(W + 0.34, 0.32, 0.18, mats.roofDark, CX, parapetY, S.z1 + 0.08);
  bx(W + 0.34, 0.32, 0.18, mats.roofDark, CX, parapetY, S.z0 - 0.08);
  bx(0.18, 0.32, D + 0.34, mats.roofDark, S.x1 + 0.08, parapetY, CZ);
  bx(0.18, 0.32, D + 0.34, mats.roofDark, S.x0 - 0.08, parapetY, CZ);

  const roofY = WALL_TOP + 0.26 + 0.02;

  function acUnit(x, z, w, h, d, fanSide) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xb7b9b4, roughness: 0.7, metalness: 0.3 }));
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const grille = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.62, d * 0.62),
      new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.6, metalness: 0.4 })
    );
    grille.rotation.x = -Math.PI / 2;
    grille.position.y = h + 0.002;
    g.add(grille);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(w * 0.3, 0.03, 6, 20), mats.metal);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = h + 0.01;
    g.add(rim);
    for (const sx of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, d * 0.8), mats.darkMetal);
      foot.position.set(sx * w * 0.35, -0.07, 0);
      g.add(foot);
    }
    g.position.set(x, roofY + 0.14, z);
    group.add(g);
    ctx.snowSurfaces.push({ x, y: roofY + 0.14 + h, z, w: w * 0.96, d: d * 0.96, h: 0.12 });
    return g;
  }
  acUnit(-5.3, 2.1, 1.55, 0.88, 0.95);
  acUnit(0.7, -3.3, 1.25, 0.78, 0.86);
  acUnit(-2.0, 4.5, 0.9, 0.62, 0.72);

  // 管道 / 通风口
  const pipeMat = mats.metal;
  for (const p of [[-6.9, 1.2, 4.2], [-6.9, 1.2, -1.2]]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 10), pipeMat);
    pipe.position.set(p[0], roofY + 0.55, p[1]);
    pipe.castShadow = true;
    group.add(pipe);
    const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 8, 12, Math.PI / 2), pipeMat);
    elbow.position.set(p[0] + 0.2, roofY + 1.1, p[1]);
    elbow.rotation.z = Math.PI / 2;
    group.add(elbow);
  }
  // 排气罩
  bx(0.7, 0.55, 0.7, mats.roofDark, 2.9, roofY + 0.28, -5.0);
  const ventTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12), pipeMat);
  ventTop.position.set(2.9, roofY + 0.62, -5.0);
  group.add(ventTop);

  // 水箱
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 16), new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.4, metalness: 0.4 }));
  tank.position.set(-6.6, roofY + 0.45, -4.2);
  tank.castShadow = true;
  group.add(tank);
  ctx.snowSurfaces.push({ x: -6.6, y: roofY + 0.9, z: -4.2, w: 1.0, d: 1.0, h: 0.1 });

  // 天线
  {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), pipeMat);
    mast.position.set(2.6, roofY + 1.2, 3.6);
    group.add(mast);
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8 - i * 0.14, 5), pipeMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(2.6, roofY + 1.5 + i * 0.28, 3.6);
      group.add(bar);
    }
  }

  // 屋顶检修口
  bx(0.9, 0.12, 0.9, mats.roofDark, 3.3, roofY + 0.06, 1.0);

  // ---------------------------------------------------------------- 招牌
  const signTex = mainSignTexture();
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.5,
    roughness: 0.35, metalness: 0.15,
  });
  ctx.signMats.push({ mat: signMat, base: 0.85, kind: 'sign' });

  const signSide = new THREE.MeshStandardMaterial({ color: 0x2c6a52, roughness: 0.5, metalness: 0.3 });
  // 南面灯箱
  {
    const boxGeo = new THREE.BoxGeometry(11.4, 0.62, 0.16);
    const sign = new THREE.Mesh(boxGeo, [signSide, signSide, signSide, signSide, signMat, signSide]);
    sign.position.set(CX, 3.24, S.z1 + 0.01);
    sign.castShadow = true;
    group.add(sign);
    const border = new THREE.Mesh(new THREE.BoxGeometry(11.52, 0.7, 0.1), mats.trim);
    border.position.set(CX, 3.24, S.z1 - 0.02);
    group.add(border);
  }
  // 东面灯箱
  {
    const boxGeo = new THREE.BoxGeometry(0.16, 0.62, 11.4);
    const sign = new THREE.Mesh(boxGeo, [signMat, signSide, signSide, signSide, signSide, signSide]);
    sign.position.set(S.x1 + 0.01, 3.24, CZ);
    sign.castShadow = true;
    group.add(sign);
    const border = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 11.52), mats.trim);
    border.position.set(S.x1 - 0.02, 3.24, CZ);
    group.add(border);
  }

  // 竖招牌（街角）
  const vTex = verticalSignTexture({ text: 'さくらマート', sub: '24H' });
  const vMat = new THREE.MeshStandardMaterial({
    map: vTex, emissiveMap: vTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.38, metalness: 0.2,
  });
  ctx.signMats.push({ mat: vMat, base: 0.4, kind: 'sign' });
  {
    const geo = new THREE.BoxGeometry(0.54, 1.78, 0.13);
    const sign = new THREE.Mesh(geo, [vMat, signSide, signSide, signSide, vMat, signSide]);
    sign.position.set(S.x1 + 0.2, 3.1, S.z1 + 0.22);
    sign.castShadow = true;
    group.add(sign);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), mats.darkMetal);
    bracket.position.set(S.x1 + 0.2, 2.85, S.z1 + 0.18);
    group.add(bracket);
  }

  // ---------------------------------------------------------------- 雨棚
  // 南侧
  {
    const g = new THREE.Group();
    g.position.set(CX, 2.98, S.z1);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(11.7, 0.07, 1.3), mats.green);
    canopy.position.set(0, 0, 0.64);
    canopy.rotation.x = 0.13;
    canopy.castShadow = true; canopy.receiveShadow = true;
    g.add(canopy);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(11.72, 0.24, 0.06), mats.greenDark);
    fascia.position.set(0, -0.155, 1.27);
    fascia.castShadow = true;
    g.add(fascia);
    // 白色细边
    const edge = new THREE.Mesh(new THREE.BoxGeometry(11.72, 0.03, 0.07), new THREE.MeshStandardMaterial({ color: 0xe8e3d2, roughness: 0.6 }));
    edge.position.set(0, -0.03, 1.28);
    g.add(edge);
    // 雨棚下的暖光
    const stripMat = new THREE.MeshStandardMaterial({ color: 0xffd9a3, emissive: 0xffc17a, emissiveIntensity: 0.55, roughness: 0.5 });
    ctx.interiorLightMats.push(stripMat);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(10.9, 0.02, 1.02), stripMat);
    strip.position.set(0, -0.06, 0.6);
    strip.rotation.x = 0.13;
    g.add(strip);
    group.add(g);
    ctx.snowSurfaces.push({ x: CX, y: 3.05, z: S.z1 + 0.62, w: 11.6, d: 1.18, h: 0.1 });
  }
  // 东侧
  {
    const g = new THREE.Group();
    g.position.set(S.x1, 2.98, CZ);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 11.7), mats.green);
    canopy.position.set(0.64, 0, 0);
    canopy.rotation.z = -0.13;
    canopy.castShadow = true; canopy.receiveShadow = true;
    g.add(canopy);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 11.72), mats.greenDark);
    fascia.position.set(1.27, -0.155, 0);
    fascia.castShadow = true;
    g.add(fascia);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 11.72), new THREE.MeshStandardMaterial({ color: 0xe8e3d2, roughness: 0.6 }));
    edge.position.set(1.28, -0.03, 0);
    g.add(edge);
    const stripMat = new THREE.MeshStandardMaterial({ color: 0xffd9a3, emissive: 0xffc17a, emissiveIntensity: 0.55, roughness: 0.5 });
    ctx.interiorLightMats.push(stripMat);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.02, 10.9), stripMat);
    strip.position.set(0.6, -0.06, 0);
    strip.rotation.z = -0.13;
    g.add(strip);
    group.add(g);
    ctx.snowSurfaces.push({ x: S.x1 + 0.62, y: 3.05, z: CZ, w: 1.18, d: 11.6, h: 0.1 });
  }

  // ---------------------------------------------------------------- 小雨篷下的小灯箱
  const smallSigns = [
    ['ATM', 'CASH CORNER', '#f7f3e6', '#1f5a45', '#c9a545'],
    ['おにぎり', 'ONIGIRI', '#fff6e8', '#b04a3a', '#e0a94a'],
    ['コーヒー', 'COFFEE 100', '#f3ead9', '#5b3b25', '#a8763e'],
  ];
  smallSigns.forEach((def, i) => {
    const tex = smallSignTexture(def[0], def[1], def[2], def[3], def[4]);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.4,
    });
    ctx.signMats.push({ mat, base: 0.42, kind: 'sign' });
    const side = new THREE.MeshStandardMaterial({ color: 0xd9d2bf, roughness: 0.6 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.31, 0.1), [side, side, side, side, mat, side]);
    m.position.set(CX - 4.4 + i * 4.1, 2.62, S.z1 + 0.62);
    group.add(m);
    const wire = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.012), mats.darkMetal);
    wire.position.set(m.position.x - 0.2, 2.8, S.z1 + 0.62);
    group.add(wire);
  });

  // 东立面小灯箱
  {
    const tex = smallSignTexture('24時間', 'OPEN', '#f4efe2', '#1f5a45', '#c9a545');
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.42 });
    ctx.signMats.push({ mat, base: 0.45, kind: 'sign' });
    const side = new THREE.MeshStandardMaterial({ color: 0xcfc9b9, roughness: 0.6 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.7), [side, side, side, side, side, side]);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.32), mat);
    face.position.x = 0.055;
    face.rotation.y = Math.PI / 2;
    m.add(face);
    m.position.set(S.x1 + 0.04, 2.55, -2.9);
    group.add(m);
  }

  // ---------------------------------------------------------------- 外墙细节
  // 落水管
  for (const p of [[S.x1 - 0.18, S.z1 - 0.18], [S.x0 + 0.18, S.z0 + 0.18], [S.x1 - 0.18, S.z0 + 0.18]]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, WALL_TOP, 8), mats.trimSoft);
    pipe.position.set(p[0], WALL_TOP / 2, p[1]);
    pipe.castShadow = true;
    group.add(pipe);
  }
  // 监控摄像头
  {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.42), mats.darkMetal);
    arm.position.set(S.x1 - 0.3, 2.78, S.z1 + 0.2);
    group.add(arm);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.24), new THREE.MeshStandardMaterial({ color: 0xdadfe3, roughness: 0.4, metalness: 0.3 }));
    cam.position.set(S.x1 - 0.3, 2.72, S.z1 + 0.42);
    cam.rotation.x = 0.35;
    group.add(cam);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0x0b1014, roughness: 0.2, metalness: 0.8 }));
    lens.rotation.x = Math.PI / 2 + 0.35;
    lens.position.set(S.x1 - 0.3, 2.68, S.z1 + 0.54);
    group.add(lens);
  }
  // 室外机
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.42), new THREE.MeshStandardMaterial({ color: 0xc3c5bf, roughness: 0.7, metalness: 0.3 }));
    body.position.y = 0.42;
    body.castShadow = true;
    g.add(body);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.6, metalness: 0.4 }));
    fan.position.set(-0.24, 0.42, 0.215);
    g.add(fan);
    g.position.set(S.x0 - 0.45, 0, -1.2);
    g.rotation.y = Math.PI / 2;
    group.add(g);
    ctx.snowSurfaces.push({ x: S.x0 - 0.45, y: 0.73, z: -1.2, w: 0.44, d: 0.9, h: 0.1 });
  }
  // 墙上配电箱
  bx(0.5, 0.68, 0.16, new THREE.MeshStandardMaterial({ color: 0x8d9194, roughness: 0.6, metalness: 0.4 }), S.x0 - 0.02, 1.7, -3.6, Math.PI / 2);

  // ---------------------------------------------------------------- 室外灯光
  const awningLightS = new THREE.PointLight(0xffc98a, 23, 11, 1.95);
  awningLightS.position.set(0.0, 2.7, S.z1 + 0.85);
  awningLightS.castShadow = false;
  ctx.scene.add(awningLightS);
  ctx.storeLights.push(awningLightS);

  const awningLightE = new THREE.PointLight(0xffc98a, 19, 9, 1.95);
  awningLightE.position.set(S.x1 + 0.85, 2.7, 1.0);
  ctx.scene.add(awningLightE);
  ctx.storeLights.push(awningLightE);

  // 店内灯光引用
  ctx.interiorPointLights.push(...warmLights);

  // ---------------------------------------------------------------- 湿地反光（店面暖光）
  const streakTex = canvasTexture(128, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,214,150,0.95)');
    g.addColorStop(0.4, 'rgba(255,190,120,0.35)');
    g.addColorStop(1, 'rgba(255,170,100,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)');
    gx.addColorStop(0.5, 'rgba(0,0,0,0)');
    gx.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = gx; c.fillRect(0, 0, w, h);
  });
  const spillMat = new THREE.MeshBasicMaterial({
    map: streakTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xffc07a, side: THREE.DoubleSide,
  });
  ctx.waterMaterials.push({
    mat: spillMat,
    target: (env) => clamp(env.wetness * (0.18 + env.nightFactor * 0.72), 0, 1) * 0.85,
  });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 9.5), spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(CX, 0.028, S.z1 + 2.2);
  spill.renderOrder = 3;
  ctx.scene.add(spill);

  const spillE = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 12.5), spillMat);
  spillE.rotation.x = -Math.PI / 2;
  spillE.rotation.z = Math.PI / 2;
  spillE.position.set(S.x1 + 2.0, 0.028, 0.5);
  spillE.renderOrder = 3;
  ctx.scene.add(spillE);

  // 门口灯柱
  const doorwayLamp = new THREE.PointLight(0xffd9ad, 8, 6, 2.0);
  doorwayLamp.position.set(doorX, 2.4, S.z1 + 0.4);
  ctx.scene.add(doorwayLamp);
  ctx.storeLights.push(doorwayLamp);

  return group;
}
