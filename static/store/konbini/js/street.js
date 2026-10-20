// ---------------------------------------------------------------------------
// street.js — the miniature street corner around the konbini
//   ground / curbs / crosswalk / gutters / parking bay / puddles
//   street lamp, utility poles + wires, guard rail, signs, traffic light
//   vending machine, bins, bicycle, alley, back lot, rooftop-free props
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {
  toon, addBox, addCyl, addPlane, addMesh, addOutline,
  addGlow, addLightPool, canvasTexture, roundRect, drawText,
  instancedMesh, boxGeo, planeGeo, cylGeo, mulberry32, JP_FONT,
} from './toon.js';
import { snowCapMaterial, snowGroundMaterial } from './snowcover.js';

/* --------------------------------------------------------------------------
   shared surface heights (also used by main.js / rain.js)
   -------------------------------------------------------------------------- */
export const SIDEWALK_Y = 0.16;
export const ROAD_Y = 0.04;

export function groundHeightAt(x, z) {
  // near-front sidewalk
  if (z >= 2.0 && z <= 4.6 && x >= -11.8 && x <= 6.6) return SIDEWALK_Y;
  // near-side sidewalk (beside the shop)
  if (x >= 4.0 && x <= 6.6 && z >= -11.8 && z < 2.0) return SIDEWALK_Y;
  // far-side sidewalk
  if (x >= 10.8 && x <= 11.8 && (z <= 4.6 || z >= 10.0)) return SIDEWALK_Y;
  // far-front sidewalk
  if (z >= 10.0 && z <= 11.8 && x >= -11.8 && x <= 6.6) return SIDEWALK_Y;
  if (z >= 10.0 && z <= 11.8 && x >= 10.8 && x <= 11.8) return SIDEWALK_Y;
  return ROAD_Y;
}

/* --------------------------------------------------------------------------
   material + texture helpers
   -------------------------------------------------------------------------- */
const _mats = new Map();
function plain(color, opts = {}) {
  const key = color + '|' + (opts.emissive ?? '') + '|' + (opts.emissiveIntensity ?? '') + '|' + (opts.line ?? '');
  let m = _mats.get(key);
  if (!m) {
    m = toon(color, opts.emissive ? { emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity ?? 1 } : {});
    _mats.set(key, m);
  }
  return m;
}

const C = {
  concrete: 0x6b7180,
  concreteTop: 0x8a91a0,
  curb: 0x727988,
  white: 0xe9eef7,
  darkMetal: 0x252a34,
  pole: 0x4b4a4e,
  wood: 0x5d4034,
  rail: 0xc9ded2,
  leaf: 0x22423b,
  leaf2: 0x2b5047,
  bark: 0x463832,
  red: 0xd6534a,
  teal: 0x2e8f86,
  cream: 0xf1e6cf,
};

function asphaltTexture() {
  const rnd = mulberry32(9911);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#343a46';
    ctx.fillRect(0, 0, w, h);
    // broad tonal patches
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(' + (40 + rnd() * 24) + ',' + (44 + rnd() * 24) + ',' + (56 + rnd() * 26) + ',0.22)';
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 30 + rnd() * 90, 20 + rnd() * 60, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // aggregate
    for (let i = 0; i < 5200; i++) {
      const g = 52 + Math.floor(rnd() * 52);
      ctx.fillStyle = 'rgba(' + g + ',' + (g + 4) + ',' + (g + 12) + ',' + (0.08 + rnd() * 0.22) + ')';
      const s = rnd() * 2.4 + 0.3;
      ctx.fillRect(rnd() * w, rnd() * h, s, s);
    }
    // hairline cracks
    ctx.strokeStyle = 'rgba(22,25,33,0.5)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let x = rnd() * w, y = rnd() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 46; y += rnd() * 30; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, { wrap: true, repeat: [14, 14] });
}

function pavingTexture() {
  const rnd = mulberry32(4242);
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8e939f';
    ctx.fillRect(0, 0, w, h);
    const cell = 128;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const g = 148 + Math.floor(rnd() * 16);
        ctx.fillStyle = 'rgb(' + g + ',' + (g + 3) + ',' + (g + 7) + ')';
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, 3);
      }
    }
    // seams
    ctx.strokeStyle = 'rgba(70,76,90,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(128, 0); ctx.lineTo(128, h);
    ctx.moveTo(0, 128); ctx.lineTo(w, 128);
    ctx.stroke();
    // speckles + damp stains
    for (let i = 0; i < 700; i++) {
      const g = 100 + Math.floor(rnd() * 90);
      ctx.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 6) + ',' + (rnd() * 0.16) + ')';
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(60,66,80,0.06)';
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 50, 12 + rnd() * 34, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { wrap: true });
  t.repeat.set(1, 1);
  return t;
}
const PAVING = pavingTexture();
const ASPHALT = asphaltTexture();
const pavingMats = [];

function pavingMat(w, d) {
  const t = PAVING.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, w / 1.5), Math.max(1, d / 1.5));
  const m = toon(0x7e8a9e, { map: t });
  m.userData.nightColor = new THREE.Color(0x7e8a9e);
  m.userData.dayColor = new THREE.Color(0xc8d3e1);
  pavingMats.push(m);
  return m;
}

function reflectionTexture(palette, seed, edgeFade = 0.72) {
  const rnd = mulberry32(seed);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const x = rnd() * w;
      const bw = 5 + rnd() * 30;
      const top = rnd() * h * 0.65;
      const len = 70 + rnd() * 280;
      const col = palette[Math.floor(rnd() * palette.length)];
      const grad = ctx.createLinearGradient(0, top, 0, top + len);
      grad.addColorStop(0, 'rgba(' + col + ',0)');
      grad.addColorStop(0.22, 'rgba(' + col + ',' + (0.14 + rnd() * 0.2) + ')');
      grad.addColorStop(0.58, 'rgba(' + col + ',' + (0.28 + rnd() * 0.24) + ')');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - bw / 2, top, bw, len);
      // a few broken horizontal glints
      if (rnd() > 0.55) {
        ctx.fillStyle = 'rgba(' + col + ',' + (0.16 + rnd() * 0.2) + ')';
        ctx.fillRect(x - bw * 1.7, top + len * (0.3 + rnd() * 0.4), bw * 3.4, 2 + rnd() * 3);
      }
    }
    // soft edges
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.12, w / 2, h / 2, h * edgeFade);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.92)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function grateTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#171b24';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#555d6d';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(8, 9 + i * 20, w - 16, 7);
    }
    ctx.strokeStyle = '#6b7484';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });
}

function brickTexture() {
  const rnd = mulberry32(771);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b252c';
    ctx.fillRect(0, 0, w, h);
    const bh = 42, bw = 84;
    for (let row = 0; row < 6; row++) {
      const off = row % 2 ? -bw / 2 : 0;
      for (let col = -1; col < 4; col++) {
        const v = 52 + Math.floor(rnd() * 18);
        ctx.fillStyle = 'rgb(' + (v + 10) + ',' + (v - 6) + ',' + (v + 2) + ')';
        ctx.fillRect(col * bw + off + 3, row * bh + 3, bw - 5, bh - 5);
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(col * bw + off + 3, row * bh + 3, bw - 5, 2);
      }
    }
  }, { wrap: true, repeat: [5, 3] });
}

function manholeTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#2c313c';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555d6b';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#434a57';
    ctx.lineWidth = 4;
    for (let r = 34; r < 118; r += 22) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke(); }
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(ang) * 24, h / 2 + Math.sin(ang) * 24);
      ctx.lineTo(w / 2 + Math.cos(ang) * 116, h / 2 + Math.sin(ang) * 116);
      ctx.stroke();
    }
  });
}

/* poster ---------------------------------------------------------------- */
function posterTexture(kind) {
  return canvasTexture(320, 460, (ctx, w, h) => {
    if (kind === 0) {
      ctx.fillStyle = '#e2684c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f7e8cb';
      roundRect(ctx, 22, 22, w - 44, h - 44, 16); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(w / 2, 80); ctx.lineTo(w / 2 + 78, 232); ctx.lineTo(w / 2 - 78, 232); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#25332f';
      ctx.fillRect(w / 2 - 34, 178, 68, 54);
      drawText(ctx, 'おにぎり', w / 2, 300, 44, '#3c2a22');
      drawText(ctx, '新米 100%', w / 2, 340, 20, '#8a6a52');
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.arc(w - 76, 105, 38, 0, Math.PI * 2); ctx.fill();
      drawText(ctx, '120', w - 76, 106, 30, '#3b2415');
    } else if (kind === 1) {
      ctx.fillStyle = '#1e6467'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#dff0e8';
      ctx.beginPath(); ctx.arc(w / 2, 175, 72, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a3b3a';
      ctx.fillRect(w / 2 - 52, 148, 104, 74);
      ctx.strokeStyle = '#dff0e8'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(w / 2 + 58, 168, 30, -1.1, 1.4); ctx.stroke();
      ctx.fillStyle = 'rgba(223,240,232,0.75)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 - 34 + i * 34, 124);
        ctx.bezierCurveTo(w / 2 - 52 + i * 34, 104, w / 2 - 20 + i * 34, 96, w / 2 - 34 + i * 34, 74);
        ctx.lineWidth = 4; ctx.stroke();
      }
      drawText(ctx, 'COFFEE', w / 2, 300, 48, '#f3f7ef');
      drawText(ctx, 'HOT / ICE', w / 2, 344, 22, '#b6ddd0');
      ctx.fillStyle = '#e2684c'; ctx.fillRect(42, 376, w - 84, 36);
      drawText(ctx, '100 yen', w / 2, 395, 22, '#fff3e2');
    } else {
      ctx.fillStyle = '#1d2944'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e2684c';
      ctx.beginPath(); ctx.arc(70, 90, 54, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.arc(252, 120, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5ecd8';
      ctx.beginPath(); ctx.arc(w / 2, 220, 90, 0, Math.PI, false); ctx.fill();
      ctx.fillRect(w / 2 - 90, 220, 180, 18);
      ctx.strokeStyle = '#f5ecd8'; ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 - 48 + i * 48, 196);
        ctx.bezierCurveTo(w / 2 - 66 + i * 48, 160, w / 2 - 28 + i * 48, 150, w / 2 - 44 + i * 48, 120);
        ctx.stroke();
      }
      drawText(ctx, '新発売', w / 2, 340, 54, '#f2c14e');
      drawText(ctx, 'あつあつ ラーメン', w / 2, 392, 24, '#cdd6e8');
      ctx.fillStyle = '#e2684c'; ctx.fillRect(0, h - 26, w, 26);
    }
  });
}

function bulletinTexture() {
  const rnd = mulberry32(1357);
  return canvasTexture(640, 420, (ctx, w, h) => {
    ctx.fillStyle = '#3b3334';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 60; i++) ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    const papers = [
      { x: 40, y: 42, w: 168, h: 220, c: '#f2e9d6', head: '#d6534a' },
      { x: 240, y: 60, w: 150, h: 190, c: '#f7f0db', head: '#2e8f86' },
      { x: 424, y: 36, w: 174, h: 240, c: '#efe6db', head: '#e0a83e' },
      { x: 86, y: 272, w: 160, h: 122, c: '#f5ead8', head: '#5a6cb5' },
      { x: 316, y: 276, w: 214, h: 112, c: '#f3e8d2', head: '#b8577b' },
    ];
    for (const p of papers) {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate((rnd() - 0.5) * 0.06);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.fillStyle = p.head;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, 20);
      ctx.fillStyle = 'rgba(60,50,44,0.55)';
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(-p.w / 2 + 14, -p.h / 2 + 44 + i * 16, (p.w - 28) * (0.4 + rnd() * 0.55), 4);
      }
      ctx.fillStyle = 'rgba(236,220,160,0.85)';
      ctx.fillRect(-p.w / 2 + 12, -p.h / 2 - 6, 34, 12);
      ctx.restore();
    }
  });
}

/* --------------------------------------------------------------------------
   main builder
   -------------------------------------------------------------------------- */
export function buildStreet(scene) {
  const g = new THREE.Group();
  g.name = 'street';
  scene.add(g);

  const rnd = mulberry32(20261103);
  const wetRefs = [];
  const puddleMeshes = [];
  const sakuraSpots = [];

  /* ---------------- asphalt ground ---------------- */
  const asphaltMat = toon(0x8f99a9, { map: ASPHALT });
  const asphaltNightColor = new THREE.Color(0x8f99a9);
  const asphaltDayColor = new THREE.Color(0xffffff);
  const ground = addPlane(g, 23.6, 23.6, asphaltMat, 0, ROAD_Y, 0, { rot: [-Math.PI / 2, 0, 0], receive: true });
  ground.name = 'asphalt';
  ground.renderOrder = 0;

  /* ---------------- sidewalk slabs ---------------- */
  function sidewalk(x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0;
    const mesh = addBox(g, w, 0.12, d, pavingMat(w, d), (x0 + x1) / 2, ROAD_Y, (z0 + z1) / 2, { receive: true });
    mesh.name = 'sidewalk';
    return mesh;
  }
  sidewalk(-11.8, 6.6, 2.0, 4.6);          // in front of the shop
  sidewalk(4.0, 6.6, -11.8, 2.0);          // down the side street
  sidewalk(10.8, 11.8, -11.8, 4.6);        // far side of the side road
  sidewalk(10.8, 11.8, 10.0, 11.8);        // far corner
  sidewalk(-11.8, 6.6, 10.0, 11.8);        // far side of the main road

  /* ---------------- curbs ---------------- */
  function curb(x, z, w, d) {
    addBox(g, w, 0.16, d, plain(C.curb), x, ROAD_Y, z, { receive: true });
    addBox(g, w + 0.015, 0.03, d + 0.015, plain(C.concreteTop), x, 0.195, z, { receive: true });
  }
  // near front curb, broken at the side road
  curb(-2.6, 4.6, 18.4, 0.16);
  // near side curb
  curb(6.6, -3.6, 0.16, 16.4);
  // far front curb (west of side road)
  curb(-2.6, 10.0, 18.4, 0.16);
  // far side curb
  curb(10.8, -3.6, 0.16, 16.4);
  curb(10.8, 10.9, 0.16, 1.8);

  /* ---------------- gutters + drains ---------------- */
  const grateMat = toon(0xffffff, { map: grateTexture() });
  const gutterMat = toon(0x1b1f29);
  function gutter(x, z, w, d) {
    addPlane(g, w, d, gutterMat, x, 0.045, z, { rot: [-Math.PI / 2, 0, 0], receive: false });
    const alongX = w > d;
    const step = 1.7;
    const count = Math.floor((alongX ? w : d) / step);
    for (let i = 0; i < count; i++) {
      const px = alongX ? x - w / 2 + (i + 0.5) * (w / count) : x;
      const pz = alongX ? z : z - d / 2 + (i + 0.5) * (d / count);
      addPlane(g, alongX ? 0.3 : 0.34, alongX ? 0.34 : 0.3, grateMat, px, 0.049, pz, { rot: [-Math.PI / 2, 0, 0] });
    }
  }
  gutter(-2.6, 4.78, 18.4, 0.42);
  gutter(6.78, -3.6, 0.42, 16.4);
  gutter(-2.6, 9.82, 18.4, 0.42);

  /* ---------------- crosswalk ---------------- */
  {
    const stripeGeo = boxGeo(0.46, 0.012, 1.9);
    const stripeMat = toon(0xaebccd, { emissive: 0x141b28, emissiveIntensity: 0.22 });
    const transforms = [];
    for (let i = 0; i < 6; i++) transforms.push({ p: [6.95 + i * 0.74, 0.046, 3.43] });
    instancedMesh(stripeGeo, stripeMat, transforms, { parent: g, receive: false });
    // wet sheen on the zebra
    const sheen = new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 256, (ctx, w, h) => {
        const gr = ctx.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, 'rgba(190,220,255,0)');
        gr.addColorStop(0.45, 'rgba(190,220,255,0.16)');
        gr.addColorStop(0.65, 'rgba(255,225,170,0.10)');
        gr.addColorStop(1, 'rgba(255,225,170,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      }),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    wetRefs.push({ mat: sheen, base: 1 });
    addPlane(g, 4.8, 2.4, sheen, 8.9, 0.058, 3.43, { rot: [-Math.PI / 2, 0, 0] });
  }

  /* ---------------- road markings ---------------- */
  const paintMat = toon(0xb2bdce, { emissive: 0x18202f, emissiveIntensity: 0.25 });
  {
    const front = [];
    for (let x = -10.6; x < 5.6; x += 2.3) front.push({ p: [x, 0.046, 7.3] });
    instancedMesh(boxGeo(1.1, 0.012, 0.12), paintMat, front, { parent: g });
    const side = [];
    for (let z = -10.8; z < 2.0; z += 2.3) side.push({ p: [8.7, 0.046, z] });
    instancedMesh(boxGeo(0.12, 0.012, 1.1), paintMat, side, { parent: g });
    // stop line before the junction
    addBox(g, 0.34, 0.012, 5.0, paintMat, 6.15, 0.04, 7.3, { receive: false });
    // stop line on the side road
    addBox(g, 4.0, 0.012, 0.34, paintMat, 8.7, 0.04, 2.24, { receive: false });
  }

  /* ---------------- parking bay ---------------- */
  {
    const bay = toon(0xbfc9d8, { emissive: 0x1b2433, emissiveIntensity: 0.25 });
    addBox(g, 0.1, 0.012, 2.5, bay, -10.6, 0.04, 6.02);
    addBox(g, 0.1, 0.012, 2.5, bay, -8.2, 0.04, 6.02);
    addBox(g, 2.4, 0.012, 0.1, bay, -9.4, 0.04, 7.27);
    addBox(g, 2.4, 0.012, 0.1, bay, -9.4, 0.04, 4.78);
    const pTex = canvasTexture(256, 384, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(224,232,244,0.82)';
      ctx.font = 'bold 320px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', w / 2, h / 2 + 8);
    });
    addPlane(g, 1.1, 1.7, new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false }),
      -9.4, 0.056, 6.0, { rot: [-Math.PI / 2, 0, 0] });
  }

  /* ---------------- manholes ---------------- */
  {
    const tex = manholeTexture();
    const m = toon(0xffffff, { map: tex });
    for (const [x, z] of [[3.1, 6.9], [-4.6, 9.0], [8.5, -6.2]]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.014, 24), m);
      disc.position.set(x, 0.048, z);
      disc.receiveShadow = true;
      g.add(disc);
    }
  }

  /* ---------------- puddles ---------------- */
  const puddleMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c4157, roughness: 0.035, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.03,
    transparent: true, opacity: 0.55, envMapIntensity: 1.0, side: THREE.DoubleSide,
  });
  const puddleGeoCache = [];
  function makePuddleGeo(seed) {
    const r = mulberry32(seed);
    const n = 15;
    const shape = new THREE.Shape();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = 0.66 + r() * 0.34;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape, 3);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }
  const puddles = [
    [-2.3, 3.35, 1.15, 0.5], [2.7, 3.95, 0.75, 0.42], [5.2, 0.6, 0.7, 0.38],
    [-7.4, 3.5, 0.95, 0.42], [8.6, 7.5, 1.7, 0.75], [-4.2, 8.3, 1.1, 0.5],
    [11.1, -1.4, 0.45, 0.8], [-8.4, -1.9, 0.55, 1.0], [1.4, 8.9, 0.8, 0.45],
  ];
  for (let i = 0; i < puddles.length; i++) {
    const [x, z, sx, sz] = puddles[i];
    const y = groundHeightAt(x, z) + 0.006;
    const p = new THREE.Mesh(makePuddleGeo(900 + i * 37), puddleMat);
    p.scale.set(sx, 1, sz);
    p.position.set(x, y, z);
    p.receiveShadow = false;
    p.renderOrder = 1;
    g.add(p);
    puddleMeshes.push(p);
  }

  /* ---------------- wet reflection decals ---------------- */
  const warmRefl = reflectionTexture(['255,198,122', '255,171,92', '238,124,78', '255,232,190'], 311, 0.78);
  const coolRefl = reflectionTexture(['126,214,255', '104,170,255', '255,196,130', '180,240,220'], 517, 0.8);
  function reflection(tex, w, d, x, z, opacity, y) {
    const m = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide,
    });
    const mesh = addPlane(g, w, d, m, x, y, z, { rot: [-Math.PI / 2, 0, 0] });
    mesh.renderOrder = 2;
    wetRefs.push({ mat: m, base: opacity });
    return mesh;
  }
  reflection(warmRefl, 12.6, 2.3, -1.1, 3.36, 0.3, SIDEWALK_Y + 0.007);
  reflection(warmRefl, 22, 8.5, -1.0, 7.2, 0.28, ROAD_Y + 0.007);
  reflection(coolRefl, 5.2, 13.0, 8.7, -1.2, 0.3, ROAD_Y + 0.008);
  reflection(coolRefl, 9, 5, 8.7, 7.8, 0.16, ROAD_Y + 0.009);
  reflection(warmRefl, 6, 4.5, -7.6, 3.3, 0.22, SIDEWALK_Y + 0.008);

  /* ---------------- street lamp ---------------- */
  const lampGroup = new THREE.Group();
  lampGroup.position.set(6.0, SIDEWALK_Y, 3.95);
  g.add(lampGroup);
  addCyl(lampGroup, 0.09, 0.12, 0.36, 10, plain(0x555b68), 0, 0, 0, { cast: true, line: 0.012 });
  addCyl(lampGroup, 0.055, 0.07, 4.75, 10, plain(0x3b404b), 0, 0.34, 0, { cast: true, line: 0.012 });
  // straight arm toward the road
  addMesh(lampGroup, cylGeo(0.042, 0.05, 1.05, 8), plain(0x3b404b),
    0, 4.99, 0.46, { rot: [Math.PI / 2, 0, 0], cast: true });
  addCyl(lampGroup, 0.06, 0.06, 0.14, 8, plain(0x3b404b), 0, 4.86, 0.9);
  const lampHead = addMesh(lampGroup, new THREE.ConeGeometry(0.3, 0.2, 12, 1, true), plain(0x3b404b),
    0, 5.05, 0.95, { cast: true });
  const lampDiscMat = toon(0xfff2cf, { emissive: 0xffd9a0, emissiveIntensity: 2.0 });
  addCyl(lampGroup, 0.16, 0.24, 0.05, 12, lampDiscMat, 0, 4.92, 0.95);
  const lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false })
  );
  lampBulb.position.set(0, 4.84, 0.95);
  lampGroup.add(lampBulb);
  const lampGlow = addGlow(lampGroup, 0xffcf9c, 2.4, 0, 4.86, 0.95, 0.7);
  const lampLight = new THREE.PointLight(0xffc98b, 18, 18, 2);
  lampLight.position.set(0, 4.75, 0.95);
  lampGroup.add(lampLight);
  const lampPool = addLightPool(g, 0xffc27a, 9.5, 9.5, 6.0, 0.055, 4.9, 0.5);

  const coneTex = canvasTexture(128, 256, (ctx, w, h) => {
    const gg = ctx.createLinearGradient(0, 0, 0, h);
    gg.addColorStop(0, 'rgba(255,226,180,0.55)');
    gg.addColorStop(0.35, 'rgba(255,214,160,0.18)');
    gg.addColorStop(1, 'rgba(255,205,150,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, w, h);
  });
  const lampCone = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 4.4, 22, 1, true),
    new THREE.MeshBasicMaterial({
      map: coneTex, color: 0xffc98a, transparent: true, opacity: 0.24,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: false, fog: false,
    })
  );
  lampCone.position.set(0, 2.55, 0.95);
  lampCone.renderOrder = 1;
  lampGroup.add(lampCone);

  const lampBase = { light: 18, glow: 0.7, cone: 0.24, pool: 0.5, disc: 2.0 };
  let lampOn = true;
  let lampMood = 1;
  function applyLamp() {
    const on = lampOn;
    lampLight.visible = on;
    lampLight.intensity = on ? lampBase.light * lampMood : 0;
    lampGlow.visible = on;
    lampGlow.material.opacity = on ? lampBase.glow * lampMood : 0;
    lampPool.visible = on;
    lampPool.material.opacity = on ? lampBase.pool * lampMood : 0;
    lampCone.visible = on;
    lampCone.material.opacity = on ? lampBase.cone * lampMood : 0;
    lampDiscMat.emissiveIntensity = on ? lampBase.disc * lampMood : 0;
    lampDiscMat.emissive.setHex(on ? 0xffd9a0 : 0x000000);
    lampDiscMat.color.setHex(on ? 0xfff2cf : 0x3e434d);
    lampBulb.visible = on;
    lampBulb.material.color.setHex(on ? 0xfff0c8 : 0x2a2a2a);
  }
  function setLamp(on) {
    lampOn = !!on;
    applyLamp();
  }
  function setLampMood(v) {
    lampMood = Math.max(0, Math.min(1.2, v));
    applyLamp();
  }
  setLamp(true);

  /* ---------------- street name sign ---------------- */
  {
    const sg = new THREE.Group();
    sg.position.set(5.1, SIDEWALK_Y, 4.03);
    sg.rotation.y = 0.34;
    g.add(sg);
    addCyl(sg, 0.045, 0.055, 2.85, 8, plain(0x6c7a72), 0, 0, 0, { cast: true });
    const plate1 = canvasTexture(512, 96, (ctx, w, h) => {
      ctx.fillStyle = '#1f5fa8'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e8eef7'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, w - 12, h - 12);
      drawText(ctx, '桜通り', 118, 44, 40, '#f4f7fb');
      drawText(ctx, 'SAKURA-DORI', 350, 38, 22, '#cfe0f5');
      drawText(ctx, '→', 420, 68, 24, '#cfe0f5');
    });
    addPlane(sg, 1.35, 0.25, new THREE.MeshBasicMaterial({ map: plate1, side: THREE.DoubleSide }), 0, 2.45, 0.02);
    const plate2 = canvasTexture(512, 96, (ctx, w, h) => {
      ctx.fillStyle = '#eef1f5'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2c3340'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, w - 12, h - 12);
      drawText(ctx, '中央通り', 118, 44, 40, '#252c38');
      drawText(ctx, 'CHUO-DORI', 350, 42, 20, '#4b5668');
    });
    addPlane(sg, 1.2, 0.23, new THREE.MeshBasicMaterial({ map: plate2, side: THREE.DoubleSide }), 0, 2.12, 0.02);
    addGlow(sg, 0x93b8ff, 0.7, 0, 2.3, 0.1, 0.12);
  }

  /* ---------------- parking sign ---------------- */
  {
    const pg = new THREE.Group();
    pg.position.set(-7.95, SIDEWALK_Y, 4.05);
    pg.rotation.y = 0.2;
    g.add(pg);
    addCyl(pg, 0.04, 0.05, 2.2, 8, plain(0x6c7a72), 0, 0, 0, { cast: true });
    const tex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1f5fa8'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20);
      drawText(ctx, 'P', w / 2, 116, 138, '#ffffff');
      drawText(ctx, '駐車場', w / 2, 212, 30, '#dbe8fa');
    });
    addPlane(pg, 0.55, 0.55, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), 0, 1.95, 0.03);
  }

  /* ---------------- guard rail at the corner ---------------- */
  {
    const railMat = plain(C.rail);
    const postGeo = cylGeo(0.045, 0.05, 0.9, 8);
    const posts = [
      [4.55, 4.44], [5.5, 4.44], [6.42, 4.44],
      [6.42, 2.15], [6.42, 0.35], [6.42, -1.45],
    ];
    for (const [x, z] of posts) {
      const p = new THREE.Mesh(postGeo, railMat);
      p.position.set(x, SIDEWALK_Y + 0.45, z);
      p.castShadow = true;
      g.add(p);
      addCyl(g, 0.06, 0.06, 0.05, 8, plain(0xdfeee6), x, SIDEWALK_Y + 0.88, z);
    }
    function railBeam(x1, z1, x2, z2, y) {
      const a = new THREE.Vector3(x1, y, z1);
      const b = new THREE.Vector3(x2, y, z2);
      const dir = b.clone().sub(a);
      const m = new THREE.Mesh(cylGeo(0.032, 0.032, dir.length(), 8), railMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      m.castShadow = true;
      g.add(m);
    }
    railBeam(4.55, 4.44, 6.42, 4.44, SIDEWALK_Y + 0.78);
    railBeam(4.55, 4.44, 6.42, 4.44, SIDEWALK_Y + 0.48);
    railBeam(6.42, 2.15, 6.42, -1.45, SIDEWALK_Y + 0.78);
    railBeam(6.42, 2.15, 6.42, -1.45, SIDEWALK_Y + 0.48);
  }

  /* ---------------- utility poles + wires ---------------- */
  const poleMat = plain(0x4d4a4b);
  const wireMat = plain(0x1a1b22);
  function utilityPole(x, z, height, armAxis) {
    const pg = new THREE.Group();
    pg.position.set(x, SIDEWALK_Y, z);
    g.add(pg);
    addCyl(pg, 0.11, 0.17, height, 10, poleMat, 0, 0, 0, { cast: true });
    addCyl(pg, 0.24, 0.28, 0.18, 10, plain(0x74797e), 0, 0, 0, { cast: true });
    // cross arm
    const isX = armAxis === 'x';
    addBox(pg, isX ? 1.9 : 0.12, 0.1, isX ? 0.12 : 1.9, plain(0x3b3a3d), 0, height - 0.9, 0, { cast: true });
    for (let i = -1; i <= 1; i++) {
      addCyl(pg, 0.06, 0.075, 0.16, 8, plain(0xbcc4c8), isX ? i * 0.72 : 0, height - 0.8, isX ? 0 : i * 0.72);
    }
    addCyl(pg, 0.2, 0.2, 0.55, 10, plain(0x555b60), 0.3, height - 2.2, 0, { cast: true });
    addBox(pg, 0.34, 0.5, 0.3, plain(0x3f444b), -0.26, height - 2.35, 0.05, { cast: true });
    return pg;
  }
  const p1 = utilityPole(6.32, -6.9, 7.2, 'x');
  const p2 = utilityPole(-10.95, -10.8, 6.8, 'x');

  function wire(a, b, sag, radius = 0.016) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    const geo = new THREE.TubeGeometry(curve, 26, radius, 3, false);
    const mesh = new THREE.Mesh(geo, wireMat);
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    g.add(mesh);
  }
  // three lines across the junction
  for (let i = 0; i < 3; i++) {
    wire(
      new THREE.Vector3(6.32 + (i - 1) * 0.62, 0.16 + 7.2 - 0.82, -6.9),
      new THREE.Vector3(-10.95 + (i - 1) * 0.62, 0.16 + 6.8 - 0.82, -10.8),
      1.15 + i * 0.05, 0.013
    );
  }
  // service drop to the konbini roof
  wire(new THREE.Vector3(6.32, 0.16 + 5.9, -6.9), new THREE.Vector3(4.25, 0.16 + 4.55, -6.4), 0.22, 0.012);
  wire(new THREE.Vector3(6.32, 0.16 + 5.7, -6.9), new THREE.Vector3(4.25, 0.16 + 4.35, -5.9), 0.26, 0.012);

  // poster on the pole
  addPlane(g, 0.44, 0.62, new THREE.MeshBasicMaterial({ map: posterTexture(2), side: THREE.DoubleSide }),
    6.12, SIDEWALK_Y + 1.95, -6.62, { rot: [0, 0.62, 0] });

  /* ---------------- traffic signal (far, slowly cycling) ---------------- */
  const signal = new THREE.Group();
  signal.position.set(11.15, SIDEWALK_Y, -3.0);
  g.add(signal);
  addCyl(signal, 0.1, 0.13, 4.6, 10, plain(0x3f444d), 0, 0, 0, { cast: true });
  addMesh(signal, cylGeo(0.055, 0.055, 2.3, 8), plain(0x3f444d), -1.0, 4.45, 0, { rot: [0, 0, Math.PI / 2], cast: true });
  addBox(signal, 1.8, 0.5, 0.32, plain(0x23282f), -2.15, 4.14, 0, { line: 0.02 });
  const signalLamps = [];
  const lensGeo = new THREE.CircleGeometry(0.155, 18);
  const lampDefs = [
    { x: -2.68, color: 0xff4f4f, glow: 0xff6a5e },
    { x: -2.15, color: 0xffc14f, glow: 0xffcf7a },
    { x: -1.62, color: 0x4fe0b0, glow: 0x6ff2c8 },
  ];
  for (const d of lampDefs) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x14171d });
    const lens = new THREE.Mesh(lensGeo, mat);
    lens.position.set(d.x, 4.39, 0.165);
    signal.add(lens);
    const sprite = addGlow(signal, d.glow, 1.15, d.x, 4.39, 0.26, 0);
    signalLamps.push({ mat, sprite, base: new THREE.Color(d.color), glow: d.glow });
  }
  let signalPhase = 'green', signalClock = 0;

  /* ---------------- vending machine ---------------- */
  {
    const vg = new THREE.Group();
    vg.position.set(-10.9, SIDEWALK_Y, 2.92);
    g.add(vg);
    const bodyMat = toon(0xe8eef4);
    addBox(vg, 1.05, 1.88, 0.82, bodyMat, 0, 0, 0, { cast: true, line: 0.022 });
    addBox(vg, 1.09, 0.16, 0.86, plain(0xd6534a), 0, 1.5, 0, { cast: true });
    addBox(vg, 0.98, 0.12, 0.76, plain(0x3a3f4b), 0, 0.03, 0.02);
    const front = canvasTexture(384, 640, (ctx, w, h) => {
      ctx.fillStyle = '#0e1a2c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#132a44'; ctx.fillRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = '#d6534a'; ctx.fillRect(12, 12, w - 24, 54);
      drawText(ctx, 'COLD  DRINKS', w / 2, 40, 27, '#fff4e6');
      const cols = ['#f2c14e', '#e2684c', '#3ec6c0', '#f0f3f5', '#6a8ce0', '#d95f9a'];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const x = 28 + c * 84, y = 92 + r * 120;
          ctx.fillStyle = '#20374f'; roundRect(ctx, x - 6, y - 6, 72, 108, 8); ctx.fill();
          ctx.fillStyle = cols[(r * 4 + c) % cols.length];
          roundRect(ctx, x + 12, y + 6, 36, 68, 8); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x + 12, y + 6, 8, 68);
          ctx.fillStyle = '#ffd86a'; ctx.fillRect(x + 2, y + 82, 56, 10);
          drawText(ctx, (r === 1 ? 150 : 130) + c * 10 + '', x + 30, y + 102, 15, '#cfe3f5');
        }
      }
      ctx.fillStyle = '#0b1524'; ctx.fillRect(20, h - 92, w - 40, 52);
      ctx.fillStyle = '#7fe3d2'; ctx.fillRect(34, h - 80, 18, 24);
      ctx.fillStyle = '#ffb36b'; ctx.fillRect(64, h - 80, 18, 24);
      drawText(ctx, '¥120', w - 96, h - 72, 26, '#f4e7cd');
    });
    addPlane(vg, 0.92, 1.48, new THREE.MeshBasicMaterial({ map: front }), 0, 0.98, 0.412);
    addPlane(vg, 0.3, 0.16, new THREE.MeshBasicMaterial({ color: 0x9fe7ff }), 0.18, 0.2, 0.414);
    addGlow(vg, 0x9fd8ff, 2.3, 0, 1.15, 0.55, 0.22);
    addLightPool(g, 0x9fd8ff, 2.3, 2.3, -10.75, 0.056, 3.7, 0.18);
    const vlight = new THREE.PointLight(0xbfe4ff, 4.5, 4.5, 2);
    vlight.position.set(-10.9, 1.35, 3.7);
    g.add(vlight);
  }

  /* ---------------- recycle bins beside the vending machine ---------------- */
  {
    const binColors = [0x3f8f88, 0xd6534a];
    for (let i = 0; i < 2; i++) {
      const bg = new THREE.Group();
      bg.position.set(-9.95 + i * 0.5, SIDEWALK_Y, 3.72);
      g.add(bg);
      addCyl(bg, 0.2, 0.18, 0.62, 14, plain(binColors[i]), 0, 0, 0, { cast: true, line: 0.012 });
      addCyl(bg, 0.22, 0.22, 0.06, 14, plain(0x2b303a), 0, 0.62, 0);
      addBox(bg, 0.2, 0.14, 0.02, plain(0xf1e7d2), 0, 0.28, 0.185);
      addBox(bg, 0.12, 0.03, 0.005, plain(0x3a3f49), 0.02, 0.36, 0.196);
      addBox(bg, 0.08, 0.03, 0.005, plain(0x3a3f49), 0.0, 0.30, 0.196);
    }
  }

  /* ---------------- bicycle ---------------- */
  {
    const bike = new THREE.Group();
    bike.position.set(5.46, SIDEWALK_Y, -1.95);
    bike.rotation.y = Math.PI / 2 - 0.08;
    bike.rotation.z = 0.045;
    g.add(bike);
    const tireMat = plain(0x1d2027);
    const rimMat = plain(0xb9c2cc);
    const frameMat = plain(0xc9604f);
    const seatMat = plain(0x2b2b31);
    const wheelGeo = new THREE.TorusGeometry(0.33, 0.032, 6, 22);
    for (const wx of [-0.56, 0.56]) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, 0.33, 0);
      wheel.castShadow = true;
      bike.add(wheel);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.008, 4, 22), rimMat);
      rim.position.copy(wheel.position);
      bike.add(rim);
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(boxGeo(0.006, 0.55, 0.006), rimMat);
        spoke.position.copy(wheel.position);
        spoke.rotation.z = s * Math.PI / 4;
        bike.add(spoke);
      }
    }
    function tube(a, b, r, mat) {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const dir = vb.clone().sub(va);
      const mesh = new THREE.Mesh(cylGeo(r, r, dir.length(), 8), mat);
      mesh.position.copy(va).add(vb).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      mesh.castShadow = true;
      bike.add(mesh);
      return mesh;
    }
    tube([-0.56, 0.33, 0], [-0.02, 0.33, 0], 0.022, frameMat);
    tube([-0.02, 0.33, 0], [-0.12, 0.86, 0], 0.026, frameMat);
    tube([-0.12, 0.86, 0], [0.42, 0.78, 0], 0.024, frameMat);
    tube([0.42, 0.78, 0], [0.56, 0.33, 0], 0.022, frameMat);
    tube([-0.02, 0.33, 0], [0.42, 0.78, 0], 0.022, frameMat);
    tube([0.42, 0.78, 0], [0.44, 1.02, 0], 0.02, frameMat);
    // handlebar
    addMesh(bike, cylGeo(0.018, 0.018, 0.42, 6), plain(0x8c949e), 0.44, 1.04, 0, { rot: [Math.PI / 2, 0, 0] });
    // saddle
    addBox(bike, 0.26, 0.06, 0.13, seatMat, -0.16, 0.9, 0);
    // basket
    const basket = new THREE.Group();
    basket.position.set(0.6, 1.0, 0);
    bike.add(basket);
    const wireMatB = plain(0xb9c2cc);
    addBox(basket, 0.36, 0.3, 0.4, wireMatB, 0, 0, 0);
    addBox(basket, 0.3, 0.24, 0.34, plain(0x33363d), 0, 0.045, 0);
    // front lamp
    addCyl(bike, 0.05, 0.05, 0.06, 10, toon(0xfff3cd, { emissive: 0xffe1a0, emissiveIntensity: 1.2 }), 0.64, 1.16, 0, { rot: [Math.PI / 2, 0, 0] });
    addGlow(bike, 0xffd48f, 0.5, 0.66, 1.16, 0.02, 0.25);
    // kickstand
    tube([-0.02, 0.33, 0], [-0.2, 0.02, 0.12], 0.012, plain(0x3d4048));
  }

  /* ---------------- alley ---------------- */
  {
    const ag = new THREE.Group();
    g.add(ag);
    const brick = new THREE.MeshToonMaterial({ map: brickTexture(), color: 0xd0c4c6 });
    // left wall
    addBox(ag, 0.3, 2.9, 8.5, plain(0x40353c), -9.35, ROAD_Y, -2.2, { cast: true, line: 0.025 });
    addPlane(ag, 8.3, 2.64, brick, -9.19, ROAD_Y + 1.36, -2.2, { rot: [0, Math.PI / 2, 0] });
    addBox(ag, 0.46, 0.12, 8.7, plain(0x2c252c), -9.35, ROAD_Y + 2.9, -2.2);
    // entrance gate post
    addCyl(ag, 0.08, 0.09, 3.3, 8, plain(0x2e2a2f), -9.2, ROAD_Y, 1.8, { cast: true });
    // wall lamp + poster on the alley wall
    addBox(ag, 0.18, 0.12, 0.26, plain(0x2e2a2f), -9.12, ROAD_Y + 2.2, -3.4);
    addCyl(ag, 0.07, 0.07, 0.05, 8, toon(0xffe0b0, { emissive: 0xffbe7a, emissiveIntensity: 1.2 }), -9.02, ROAD_Y + 2.2, -3.4, { rot: [0, 0, Math.PI / 2] });
    addGlow(ag, 0xffc47e, 1.5, -8.85, ROAD_Y + 2.2, -3.4, 0.3);
    addPlane(ag, 0.62, 0.84, new THREE.MeshBasicMaterial({ map: posterTexture(1), side: THREE.DoubleSide }),
      -9.18, ROAD_Y + 1.45, -2.7, { rot: [0, Math.PI / 2, 0] });
    // dead-end wall + door
    addBox(ag, 3.2, 3.5, 0.3, plain(0x3a3036), -7.7, ROAD_Y, -6.45, { cast: true, line: 0.02 });
    // entrance header
    addBox(ag, 3.2, 0.26, 0.34, plain(0x3a3036), -7.7, ROAD_Y + 3.34, 1.8, { cast: true });
    const alleySign = canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#241d24'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e5c48a'; ctx.lineWidth = 5; ctx.strokeRect(9, 9, w - 18, h - 18);
      drawText(ctx, '路地', w / 2, 96, 76, '#f0d6a2');
      drawText(ctx, 'ALLEY', w / 2, 172, 26, '#b99f78');
      drawText(ctx, '→', w - 70, 210, 34, '#f0d6a2');
    });
    addPlane(ag, 0.95, 0.4, new THREE.MeshBasicMaterial({ map: alleySign, side: THREE.DoubleSide }), -8.2, ROAD_Y + 3.0, 1.98);
    addCyl(ag, 0.008, 0.008, 0.3, 4, plain(0x2e2a2f), -8.45, ROAD_Y + 3.24, 1.98);
    addCyl(ag, 0.008, 0.008, 0.3, 4, plain(0x2e2a2f), -7.95, ROAD_Y + 3.24, 1.98);
    // paper lantern hanging under the header
    addCyl(ag, 0.16, 0.16, 0.34, 12, toon(0xf3d3a2, { emissive: 0xffb366, emissiveIntensity: 1.1 }), -7.0, ROAD_Y + 2.62, 1.95);
    addGlow(ag, 0xffbb70, 2.1, -7.0, ROAD_Y + 2.75, 2.15, 0.4);
    // hanging lamp deeper in
    addCyl(ag, 0.16, 0.22, 0.16, 10, plain(0x2e2a2f), -8.55, ROAD_Y + 2.92, -2.4);
    addCyl(ag, 0.04, 0.04, 0.3, 6, plain(0x2e2a2f), -8.55, ROAD_Y + 3.1, -2.4);
    addCyl(ag, 0.09, 0.09, 0.14, 8, toon(0xfff0c9, { emissive: 0xffd193, emissiveIntensity: 1.3 }), -8.55, ROAD_Y + 2.84, -2.4);
    addGlow(ag, 0xffcf8f, 1.5, -8.55, ROAD_Y + 2.82, -2.4, 0.32);
    addLightPool(ag, 0xffb878, 3.6, 4.4, -8.1, ROAD_Y + 0.007, -1.4, 0.2);
    // pipes
    addCyl(ag, 0.055, 0.055, 3.3, 8, plain(0x3d4148), -9.12, ROAD_Y, -4.5, { cast: true });
    addCyl(ag, 0.045, 0.045, 3.1, 8, plain(0x4a4e55), -9.12, ROAD_Y, 0.6, { cast: true });
    addMesh(ag, cylGeo(0.045, 0.045, 2.2, 8), plain(0x3d4148), -8.1, ROAD_Y + 1.4, -6.3, { rot: [0, 0, Math.PI / 2] });
    // back door
    addBox(ag, 1.1, 2.1, 0.08, plain(0x3d5f57), -8.5, ROAD_Y, -6.26, { cast: true });
    addBox(ag, 0.06, 0.06, 0.12, plain(0xb9c2cc), -8.05, ROAD_Y + 1.0, -6.25);
    addCyl(ag, 0.07, 0.07, 0.12, 8, toon(0xffe0b0, { emissive: 0xffc47e, emissiveIntensity: 1.1 }), -8.5, ROAD_Y + 2.35, -6.27);
    addGlow(ag, 0xffc47e, 1.0, -8.5, ROAD_Y + 2.35, -6.1, 0.3);
    // crates
    for (let i = 0; i < 3; i++) {
      addBox(ag, 0.44, 0.3, 0.36, plain(i === 2 ? 0x3f6f68 : 0x9c5b45), -8.85, ROAD_Y + (i % 2) * 0.3, -4.9 + Math.floor(i / 2) * 0.4, { cast: true, line: 0.01 });
    }
    // bulletin board on the wall
    const board = new THREE.Group();
    board.position.set(-9.16, ROAD_Y, 0.15);
    board.rotation.y = Math.PI / 2;
    ag.add(board);
    addBox(board, 1.36, 1.06, 0.06, plain(0x2f292b), 0, 1.0, 0, { cast: true, line: 0.012 });
    addPlane(board, 1.22, 0.92, new THREE.MeshBasicMaterial({ map: bulletinTexture() }), 0, 1.53, 0.037);
    addBox(board, 1.42, 0.08, 0.2, plain(0x37302f), 0, 2.06, 0.05, { cast: true });
    addGlow(board, 0xffd9a0, 1.0, 0, 1.75, 0.2, 0.12);
    // AC unit on the alley wall
    const ac = new THREE.Group();
    ac.position.set(-9.0, ROAD_Y + 2.1, -4.9);
    ac.rotation.y = Math.PI / 2;
    ag.add(ac);
    addBox(ac, 0.84, 0.55, 0.32, plain(0xbfc5cb), 0, 0, 0, { cast: true, line: 0.012 });
    addCyl(ac, 0.18, 0.18, 0.03, 16, plain(0x2c3038), 0, 0.3, 0.17, { rot: [Math.PI / 2, 0, 0] });
    addCyl(ac, 0.19, 0.19, 0.012, 16, plain(0x8d949c), 0, 0.3, 0.19, { rot: [Math.PI / 2, 0, 0] });
    addBox(ac, 0.05, 0.3, 0.05, plain(0x2c3038), -0.38, 0.42, 0.16);
    addLightPool(ag, 0xffc888, 2.2, 2.8, -8.7, ROAD_Y + 0.006, -4.9, 0.12);
    // puddle and reflected light
    reflection(warmRefl, 3.6, 5.6, -7.9, -1.4, 0.16, ROAD_Y + 0.006);
  }

  /* ---------------- sakura trees + back lot props ---------------- */
  {
    for (const [x, z] of [[-5.1, -8.3], [-3.75, -8.3]]) {
      const ac = new THREE.Group();
      ac.position.set(x, ROAD_Y, z);
      g.add(ac);
      addBox(ac, 0.86, 0.58, 0.34, plain(0xc2c8ce), 0, 0.12, 0, { cast: true, line: 0.014 });
      addBox(ac, 0.3, 0.1, 0.34, plain(0x8a929a), 0, 0.0, 0);
      addCyl(ac, 0.2, 0.2, 0.02, 16, plain(0x2c3038), 0, 0.41, 0.18, { rot: [Math.PI / 2, 0, 0] });
      addCyl(ac, 0.21, 0.21, 0.012, 16, plain(0x8d949c), 0, 0.41, 0.196, { rot: [Math.PI / 2, 0, 0] });
      addCyl(ac, 0.025, 0.025, 0.7, 6, plain(0x5b616a), 0.32, -0.02, 0.1);
    }
    // stacked crates behind the shop
    addBox(g, 0.6, 0.4, 0.42, plain(0x3f6f68), 2.9, ROAD_Y + 0.02, -8.4, { cast: true, line: 0.012 });
    addBox(g, 0.58, 0.36, 0.4, plain(0x9c5b45), 2.88, ROAD_Y + 0.42, -8.4, { cast: true, line: 0.012 });
    // low fence at the rear edge
    const fenceMat = plain(0x2b2d34);
    for (let x = -11.5; x <= 4.0; x += 2.6) {
      addCyl(g, 0.035, 0.045, 1.25, 6, fenceMat, x, ROAD_Y, -11.55, { cast: true });
    }
    function rearRail(x1, x2, y) {
      const len = Math.abs(x2 - x1);
      const m = new THREE.Mesh(cylGeo(0.025, 0.025, len, 6), fenceMat);
      m.position.set((x1 + x2) / 2, y, -11.55);
      m.rotation.z = Math.PI / 2;
      g.add(m);
    }
    rearRail(-11.5, 4.0, ROAD_Y + 1.1);
    rearRail(-11.5, 4.0, ROAD_Y + 0.62);

    // sakura trees
    const pinks = [0xf3b5c9, 0xf9cfdb, 0xf0a3bb, 0xffdbe5, 0xf6c2d2];
    const barkMat = plain(C.bark);
    function sakuraTree(x, z, s, planter = false) {
      const tg = new THREE.Group();
      tg.position.set(x, groundHeightAt(x, z), z);
      g.add(tg);
      sakuraSpots.push([x, z]);
      addCyl(tg, 0.09 * s, 0.14 * s, 2.4 * s, 7, barkMat, 0, 0, 0, { cast: true });
      const branches = [
        [[0, 2.1 * s, 0], [-0.7 * s, 3.1 * s, 0.25 * s], 0.045],
        [[0, 2.2 * s, 0], [0.75 * s, 3.2 * s, -0.2 * s], 0.045],
        [[0, 2.3 * s, 0], [0.1 * s, 3.7 * s, 0.3 * s], 0.04],
        [[0, 1.9 * s, 0], [-0.4 * s, 2.7 * s, -0.45 * s], 0.035],
      ];
      for (const [a, b, r] of branches) {
        const va = new THREE.Vector3(a[0], a[1], a[2]);
        const vb = new THREE.Vector3(b[0], b[1], b[2]);
        const dir = vb.clone().sub(va);
        const m = new THREE.Mesh(cylGeo(r, r * 1.25, dir.length(), 6), barkMat);
        m.position.copy(va).add(vb).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        m.castShadow = true;
        tg.add(m);
      }
      const blobs = [
        [0, 2.85 * s, 0, 1.15],
        [-0.72 * s, 3.25 * s, 0.24 * s, 0.95],
        [0.76 * s, 3.2 * s, -0.2 * s, 0.9],
        [0.05 * s, 3.9 * s, 0.12 * s, 0.8],
        [-0.42 * s, 2.8 * s, -0.5 * s, 0.65],
        [0.5 * s, 2.75 * s, 0.5 * s, 0.6],
      ];
      for (let i = 0; i < blobs.length; i++) {
        const [bx, by, bz, br] = blobs[i];
        const geo = new THREE.IcosahedronGeometry(br * s, 0);
        const mat = toon(pinks[i % pinks.length], {
          flatShading: true,
          emissive: 0x8a354b,
          emissiveIntensity: 0.12,
        });
        const blob = new THREE.Mesh(geo, mat);
        blob.position.set(bx, by, bz);
        blob.rotation.set(i * 0.7, i * 1.3, i * 0.4);
        blob.castShadow = true;
        blob.receiveShadow = false;
        tg.add(blob);
        addOutline(blob, 0.022 * s, 0x3a2030);
      }
      const smallBlooms = [
        [-1.02 * s, 3.55 * s, 0.28 * s, 0.27],
        [1.04 * s, 3.48 * s, -0.34 * s, 0.25],
        [0.16 * s, 4.38 * s, -0.12 * s, 0.23],
        [-0.56 * s, 3.84 * s, 0.68 * s, 0.22],
        [0.62 * s, 3.72 * s, 0.62 * s, 0.21],
        [-0.82 * s, 3.02 * s, -0.18 * s, 0.22],
        [0.02 * s, 3.22 * s, 0.85 * s, 0.2],
      ];
      for (let i = 0; i < smallBlooms.length; i++) {
        const [bx, by, bz, br] = smallBlooms[i];
        const b = new THREE.Mesh(
          new THREE.IcosahedronGeometry(br * s, 0),
          toon(i % 2 ? 0xffe0ea : 0xf6c4d4, { flatShading: true, emissive: 0x8a354b, emissiveIntensity: 0.09 })
        );
        b.position.set(bx, by, bz);
        b.rotation.set(i * 0.9, i * 1.7, i * 0.5);
        b.castShadow = true;
        tg.add(b);
      }
      // snow resting on the blossom canopy
      const snowCaps = [
        [0, 4.52 * s, 0, 1.02, 0.26, 0.96],
        [-0.62 * s, 4.2 * s, 0.22 * s, 0.64, 0.2, 0.58],
        [0.66 * s, 4.14 * s, -0.18 * s, 0.6, 0.19, 0.54],
        [-0.12 * s, 4.32 * s, -0.52 * s, 0.5, 0.17, 0.46],
        [0.5 * s, 4.04 * s, 0.5 * s, 0.44, 0.15, 0.4],
      ];
      for (const [cx, cy, cz, rx, ry, rz] of snowCaps) {
        const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), snowCapMaterial);
        cap.position.set(cx, cy, cz);
        cap.scale.set(rx, ry, rz);
        cap.renderOrder = 3;
        tg.add(cap);
      }
      addLightPool(tg, 0xffc4d6, 2.8 * s, 2.8 * s, 0, 0.009, 0, 0.16);
      if (planter) {
        addBox(tg, 0.92, 0.14, 0.92, plain(0x3b3a3c), 0, -0.02, 0, { cast: true });
        addBox(tg, 0.78, 0.05, 0.78, plain(0x4b3a32), 0, 0.1, 0);
      }
      return tg;
    }
    sakuraTree(-10.7, -9.2, 1.0);
    sakuraTree(11.28, -7.4, 0.95, true);
    sakuraTree(-10.85, 0.55, 0.8, true);
  }

  /* ---------------- signal animation ---------------- */
  const signalSeq = [
    { name: 'green', t: 8.0 },
    { name: 'yellow', t: 2.4 },
    { name: 'red', t: 9.6 },
  ];
  function applySignal(phase, instant = false) {
    signalPhase = phase;
    for (const lamp of signalLamps) {
      const on = (phase === 'red' && lamp.glow === 0xff6a5e) ||
                 (phase === 'yellow' && lamp.glow === 0xffcf7a) ||
                 (phase === 'green' && lamp.glow === 0x6ff2c8);
      lamp.mat.color.copy(on ? lamp.base : new THREE.Color(0x161a20));
      lamp.sprite.material.opacity = on ? 0.55 : 0;
      lamp.sprite.visible = on;
    }
  }
  applySignal('green', true);

  function update(time, dt) {
    signalClock += dt;
    const total = signalSeq.reduce((a, b) => a + b.t, 0);
    let t = signalClock % total;
    let phase = 'green';
    for (const s of signalSeq) {
      if (t < s.t) { phase = s.name; break; }
      t -= s.t;
    }
    if (phase !== signalPhase) applySignal(phase);
  }

  /* ---------------- snow cover (accumulation layer) ---------------- */
  const snowG = new THREE.Group();
  snowG.name = 'snow-cover';
  g.add(snowG);
  function snowPlane(w, d, x, y, z) {
    const m = new THREE.Mesh(planeGeo(w, d), snowGroundMaterial);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.renderOrder = 2;
    snowG.add(m);
    return m;
  }
  // roads / back lot (under sidewalks and markings)
  snowPlane(23.6, 23.6, 0, ROAD_Y + 0.008, 0);
  // exposed plinth cap ring
  snowPlane(24.0, 24.0, 0, 0.012, 0);
  // sidewalk slabs
  snowPlane(18.4, 2.6, -2.6, SIDEWALK_Y + 0.010, 3.3);
  snowPlane(2.6, 13.8, 5.3, SIDEWALK_Y + 0.010, -4.9);
  snowPlane(1.0, 16.4, 11.3, SIDEWALK_Y + 0.010, -3.6);
  snowPlane(1.0, 1.8, 11.3, SIDEWALK_Y + 0.010, 10.9);
  snowPlane(18.4, 1.8, -2.6, SIDEWALK_Y + 0.010, 10.9);

  function snowBox(w, h, d, x, y, z, rot) {
    const m = addBox(snowG, w, h, d, snowCapMaterial, x, y, z, rot ? { rot } : {});
    m.renderOrder = 3;
    return m;
  }
  function snowDisc(r, h, x, y, z) {
    const m = addCyl(snowG, r, r, h, 12, snowCapMaterial, x, y, z);
    m.renderOrder = 3;
    return m;
  }
  // vending machine
  snowBox(1.07, 0.045, 0.84, -10.9, 2.04, 2.92);
  // bins
  snowDisc(0.21, 0.035, -9.95, 0.84, 3.72);
  snowDisc(0.21, 0.035, -9.45, 0.84, 3.72);
  // guard rail
  snowBox(1.9, 0.03, 0.075, 5.485, 0.972, 4.44);
  snowBox(0.075, 0.03, 3.65, 6.42, 0.972, -0.35);
  // street signal head
  snowBox(1.82, 0.03, 0.34, 9.0, 4.80, -3.0);
  // back-lot AC units
  snowBox(0.9, 0.035, 0.38, -5.1, 0.7575, -8.3);
  snowBox(0.9, 0.035, 0.38, -3.75, 0.7575, -8.3);
  // alley-wall AC
  snowBox(0.88, 0.035, 0.36, -9.0, 2.415, -4.9, [0, Math.PI / 2, 0]);
  // beer crates behind the shop
  snowBox(0.6, 0.03, 0.42, 2.88, 0.82, -8.4);

  function setDaylight(v) {
    const f = Math.max(0, Math.min(1, v));
    asphaltMat.color.copy(asphaltNightColor).lerp(asphaltDayColor, f);
    for (const m of pavingMats) m.color.copy(m.userData.nightColor).lerp(m.userData.dayColor, f);
  }
  setDaylight(0);

  let wetness = 1;
  function setWetness(v) {
    wetness = Math.max(0, Math.min(1, v));
    puddleMat.opacity = 0.55 * wetness;
    for (const p of puddleMeshes) p.visible = wetness > 0.02;
    for (const ref of wetRefs) ref.mat.opacity = ref.base * wetness;
  }
  setWetness(1);

  return {
    group: g, update, signal,
    phase: () => signalPhase,
    setWetness,
    setDaylight,
    setLamp,
    setLampMood,
    lampOn: () => lampOn,
    sakuraSpots,
  };
}