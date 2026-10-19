// ---------------------------------------------------------------------------
// world.js — 微缩街区底座、道路、人行道、标线、水洼、远景
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L, inBlock } from './layout.js';
import { canvasTexture, fbm2, rand, mulberry32, stdMat, clamp } from './util.js';

const HALF = L.baseHalf;

function asphaltTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#31343a'; c.fillRect(0, 0, w, h);
    const img = c.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    c.putImageData(img, 0, 0);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.16)';
      c.fillRect(Math.random() * w, Math.random() * h, rand(1, 3), rand(1, 3));
    }
    c.strokeStyle = 'rgba(10,12,15,0.35)'; c.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      let x = rand(0, w), y = rand(0, h);
      c.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += rand(-26, 26); y += rand(-26, 26); c.lineTo(x, y); }
      c.stroke();
    }
  }, { wrap: true, repeat: [9, 9] });
}

function sidewalkTexture() {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#9a9891'; c.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = Math.round(148 + Math.random() * 14);
        c.fillStyle = 'rgb(' + v + ',' + (v - 2) + ',' + (v - 8) + ')';
        c.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
        for (let i = 0; i < 26; i++) {
          c.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(60,58,52,0.06)';
          c.fillRect(x * s + Math.random() * s, y * s + Math.random() * s, rand(2, 9), rand(2, 9));
        }
      }
    }
    c.strokeStyle = 'rgba(58,56,50,0.42)'; c.lineWidth = 2.5;
    for (let i = 0; i <= n; i++) {
      c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.stroke();
      c.beginPath(); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke();
    }
  }, { wrap: true, repeat: [1, 1] });
}

function tactileTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#c9a545'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e0bd5d';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.beginPath(); c.arc(16 + x * 32, 16 + y * 32, 7, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(80,60,20,0.25)';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.beginPath(); c.arc(17.5 + x * 32, 17.5 + y * 32, 6.4, 0, Math.PI * 2); c.fill();
    }
  }, { wrap: true, repeat: [1, 1] });
}

function manholeTexture() {
  return canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#3b3a37'; c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5c5a54'; c.lineWidth = 7;
    c.beginPath(); c.arc(128, 128, 112, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#4a4842'; c.lineWidth = 3;
    for (let i = 1; i <= 5; i++) {
      c.beginPath(); c.arc(128, 128, 112 - i * 17, 0, Math.PI * 2); c.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.beginPath(); c.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30);
      c.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); c.stroke();
    }
    c.fillStyle = '#57554e'; c.beginPath(); c.arc(128, 128, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2f2e2a'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('桜', 128, 129);
  });
}

function facadeTexture(seed, base, warm) {
  const rnd = mulberry32(seed);
  return canvasTexture(256, 512, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const cols = 6, rows = 11;
    const cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = rnd() > 0.72;
        c.fillStyle = lit ? warm : 'rgba(120,145,180,0.10)';
        c.globalAlpha = lit ? 0.35 + rnd() * 0.35 : 1;
        c.fillRect(x * cw + cw * 0.24, y * ch + ch * 0.3, cw * 0.5, ch * 0.34);
        c.globalAlpha = 1;
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y <= rows; y++) c.fillRect(0, y * ch - 1, w, 2);
  });
}

function streakTexture() {
  return canvasTexture(128, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.30)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)');
    gx.addColorStop(0.5, 'rgba(0,0,0,0)');
    gx.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = gx; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 90; i++) {
      c.fillStyle = 'rgba(255,255,255,' + rand(0.05, 0.2).toFixed(2) + ')';
      c.fillRect(rand(0, w), rand(0, h * 0.8), rand(1, 3), rand(3, 12));
    }
  });
}

function plaqueTexture() {
  return canvasTexture(1024, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#174437'); g.addColorStop(0.5, '#0f332a'); g.addColorStop(1, '#0a231d');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,183,198,0.55)'; c.lineWidth = 3;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.fillStyle = '#f3ead5';
    c.font = '600 74px Georgia, "Times New Roman", serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SAKURA NIGHT', w / 2, h / 2 - 12);
    c.font = '500 30px "Yu Gothic", Meiryo, sans-serif';
    c.fillStyle = 'rgba(255,183,198,0.8)';
    c.fillText('桜通り ・ 夜の街角', w / 2, h / 2 + 62);
  });
}

export function buildWorld(ctx) {
  const group = new THREE.Group();
  group.name = 'world';
  ctx.scene.add(group);

  const asphaltMap = asphaltTexture();
  const walkMap = sidewalkTexture();
  const tactileMap = tactileTexture();
  const manholeMap = manholeTexture();
  const streakMap = streakTexture();

  // ---------------------------------------------------------------- 底座
  const baseSide = stdMat({ color: 0x14171d, roughness: 0.92, metalness: 0.08 });
  const asphalt = stdMat({ color: 0x33363c, map: asphaltMap, roughness: 0.94, metalness: 0.03 });
  ctx.wetMaterials.push({
    mat: asphalt,
    dry: { color: new THREE.Color(0x33363c), roughness: 0.94, metalness: 0.03 },
    wet: { color: new THREE.Color(0x14171c), roughness: 0.2, metalness: 0.58 },
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 1.6, HALF * 2), [baseSide, baseSide, asphalt, baseSide, baseSide, baseSide]);
  base.position.y = L.roadY - 0.8;
  base.receiveShadow = true;
  group.add(base);

  const trimMat = stdMat({ color: 0x9db6d6, roughness: 0.35, metalness: 0.7, emissive: 0x35507a, emissiveIntensity: 0.55 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.5, 0.05, HALF * 2 + 0.5), trimMat);
  trim.position.y = L.roadY - 1.55;
  group.add(trim);

  const plinthMat = stdMat({ color: 0x0b0d11, roughness: 0.8, metalness: 0.2 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.9, 0.16, HALF * 2 + 0.9), plinthMat);
  plinth.position.y = L.roadY - 1.68;
  group.add(plinth);

  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTexture(), roughness: 0.45, metalness: 0.35,
    emissive: 0xd8b578, emissiveIntensity: 0.1,
  });
  ctx.plaqueMat = plaqueMat;
  for (const item of [[0, HALF + 0.02, 0], [HALF + 0.02, 0, Math.PI / 2]]) {
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), plaqueMat);
    plaque.position.set(item[0], L.roadY - 0.85, item[1]);
    plaque.rotation.y = item[2];
    group.add(plaque);
  }

  // ---------------------------------------------------------------- 人行道
  function sidewalkSlab(x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xa5a49c, map: walkMap.clone(), roughness: 0.9, metalness: 0.02,
    });
    mat.map.needsUpdate = true;
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.repeat.set(w / 2.4, d / 2.4);
    mat.map.anisotropy = walkMap.anisotropy;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), mat);
    m.position.set((x0 + x1) / 2, L.roadY + 0.075, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
    ctx.wetMaterials.push({
      mat,
      dry: { color: new THREE.Color(0xa5a49c), roughness: 0.9, metalness: 0.02 },
      wet: { color: new THREE.Color(0x6b6c6c), roughness: 0.34, metalness: 0.3 },
    });
    return m;
  }

  sidewalkSlab(L.block.x0, L.block.x1, L.block.z0, L.block.z1);
  sidewalkSlab(L.farEast.x0, HALF, -HALF, L.southRoad.z0);
  sidewalkSlab(-HALF, HALF, L.farSouth.z0, HALF);

  const curbMat = stdMat({ color: 0xb4b2a8, roughness: 0.82, metalness: 0.04 });
  ctx.wetMaterials.push({
    mat: curbMat,
    dry: { color: new THREE.Color(0xb4b2a8), roughness: 0.82, metalness: 0.04 },
    wet: { color: new THREE.Color(0x77787a), roughness: 0.3, metalness: 0.28 },
  });
  function curb(x0, x1, z0, z1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.16, z1 - z0), curbMat);
    m.position.set((x0 + x1) / 2, L.roadY + 0.08, (z0 + z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  curb(L.block.x0, L.block.x1, L.block.z1 - 0.34, L.block.z1);
  curb(L.block.x1 - 0.34, L.block.x1, L.block.z0, L.block.z1);
  curb(L.farEast.x0, L.farEast.x0 + 0.34, -HALF, L.southRoad.z0);
  curb(-HALF, HALF, L.farSouth.z0, L.farSouth.z0 + 0.34);

  // ---------------------------------------------------------------- 标线
  const lineMat = stdMat({
    color: 0xd9d8cc, roughness: 0.62, metalness: 0.05,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  ctx.wetMaterials.push({
    mat: lineMat,
    dry: { color: new THREE.Color(0xd9d8cc), roughness: 0.62, metalness: 0.05 },
    wet: { color: new THREE.Color(0x9d9d94), roughness: 0.22, metalness: 0.3 },
  });

  const markY = L.roadY + 0.008;
  function marking(w, d, x, z, rot) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
    m.rotation.set(-Math.PI / 2, 0, rot || 0);
    m.position.set(x, markY, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  for (let x = -HALF + 1.5; x < 6.5; x += 6) marking(3.2, 0.18, x, 15);
  for (let x = 22; x < HALF - 1; x += 6) marking(3.2, 0.18, x, 15);
  for (let z = -HALF + 1.5; z < 7.5; z += 6) marking(0.18, 3.2, 14, z);
  for (let z = 22.5; z < HALF - 1; z += 6) marking(0.18, 3.2, 14, z);

  marking(15.6, 0.14, -11.2, 9.55);
  marking(5.6, 0.14, 23, 9.55);
  marking(15.6, 0.14, -11.2, 20.45);
  marking(5.6, 0.14, 23, 20.45);
  marking(0.14, 15.6, 8.55, 1.2);
  marking(0.14, 5.6, 8.55, -23);
  marking(0.14, 15.6, 19.45, -13.6);
  marking(0.14, 5.6, 19.45, 23);

  for (let i = 0; i < 4; i++) marking(0.55, 11.2, 1.55 + i * 1.05, 15.05);
  for (let i = 0; i < 4; i++) marking(11.2, 0.55, 14.05, 2.35 + i * 1.05);

  marking(0.42, 5.2, 6.1, 17.8);
  marking(5.2, 0.42, 16.9, 7.9);

  for (let i = 0; i < 4; i++) {
    const x = -17.4 + i * 3.4;
    marking(0.12, 2.1, x, 19.4);
  }
  marking(10.2, 0.12, -12.1, 20.42);

  {
    const shape = new THREE.Shape();
    shape.moveTo(-1.5, -0.19); shape.lineTo(0.45, -0.19); shape.lineTo(0.45, -0.52);
    shape.lineTo(1.5, 0); shape.lineTo(0.45, 0.52); shape.lineTo(0.45, 0.19);
    shape.lineTo(-1.5, 0.19); shape.lineTo(-1.5, -0.19);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), lineMat);
    m.rotation.set(-Math.PI / 2, 0, 0);
    m.position.set(-9.5, markY, 17.7);
    group.add(m);
  }

  {
    const stopTex = canvasTexture(256, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(230,230,220,0.9)';
      c.font = '700 150px "Yu Gothic", Meiryo, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('止', w / 2, h * 0.3);
      c.fillText('ま', w / 2, h * 0.55);
      c.fillText('れ', w / 2, h * 0.8);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.8), new THREE.MeshBasicMaterial({
      map: stopTex, transparent: true, opacity: 0.7, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }));
    m.rotation.set(-Math.PI / 2, 0, 0);
    m.position.set(2.2, markY + 0.002, 18.6);
    group.add(m);
  }

  // 盲道
  function tactile(w, d, x, z) {
    const t = tactileMap.clone(); t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, w / 0.6), Math.max(1, d / 0.6));
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9a545, map: t, roughness: 0.8, metalness: 0.03 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat);
    m.position.set(x, 0.012, z);
    m.receiveShadow = true;
    group.add(m);
  }
  tactile(8.4, 0.4, 1.4, 8.55);
  tactile(1.5, 0.5, 2.5, 8.2);
  tactile(0.4, 4.6, 8.45, 4.2);
  tactile(0.5, 1.6, 8.15, 4.2);

  // ---------------------------------------------------------------- 井盖 / 排水口
  const manholeMat = stdMat({ color: 0x8d8a80, map: manholeMap, roughness: 0.7, metalness: 0.5 });
  const manholeGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.03, 24);
  for (const item of [[-3.2, 12.4, 1], [13.6, 3.8, 0.9], [10.4, 16.6, 1.05], [-13.4, 18.2, 0.85]]) {
    const m = new THREE.Mesh(manholeGeo, manholeMat);
    m.position.set(item[0], L.roadY + 0.006, item[1]);
    m.scale.setScalar(item[2]);
    m.receiveShadow = true;
    group.add(m);
  }

  const grateTex = canvasTexture(128, 64, (c, w, h) => {
    c.fillStyle = '#2b2c2e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0e0f11';
    for (let i = 0; i < 10; i++) c.fillRect(6 + i * 12, 8, 6, h - 16);
  });
  const grateMat = stdMat({ color: 0x8a8a86, map: grateTex, roughness: 0.6, metalness: 0.55 });
  for (const item of [[-12, 9.2, 0], [-4.6, 9.2, 0], [2.4, 9.2, 0], [8.2, -2, Math.PI / 2], [8.2, 4.4, Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 0.36), grateMat);
    m.position.set(item[0], L.roadY + 0.012, item[1]);
    m.rotation.y = item[2];
    group.add(m);
  }

  // ---------------------------------------------------------------- 水洼
  const puddleMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a1018, roughness: 0.1, metalness: 0.62, transparent: true, opacity: 0,
    envMapIntensity: 0.9, depthWrite: false, side: THREE.DoubleSide,
  });
  ctx.waterMaterials.push({
    mat: puddleMat,
    target: (env) => clamp(env.wetness * (1 - env.snow * 0.95) * 0.6, 0, 0.6),
  });

  const puddleGeoBase = new THREE.CircleGeometry(1, 26);
  {
    const p = puddleGeoBase.attributes.position;
    for (let i = 1; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const a = Math.atan2(y, x);
      const k = 1 + 0.24 * Math.sin(a * 3 + 1.7) + 0.14 * Math.sin(a * 7 + 0.4);
      p.setXY(i, x * k, y * k);
    }
    puddleGeoBase.computeVertexNormals();
  }
  const puddles = [
    [-1.2, 11.2, 2.6, 1.5, 0.2], [3.6, 13.8, 1.9, 1.1, -0.3], [11.2, 12.8, 2.2, 1.3, 0.5],
    [16.4, 3.1, 1.6, 1.0, 0.1], [12.2, -4.2, 2.4, 1.2, -0.4], [-8.4, 19.2, 2.0, 1.1, 0.6],
    [5.9, 7.3, 1.05, 0.62, 0.3], [-3.6, 7.6, 0.9, 0.55, -0.2], [9.4, 18.4, 1.7, 1.0, 0.9],
  ];
  for (const item of puddles) {
    const m = new THREE.Mesh(puddleGeoBase, puddleMat);
    m.rotation.set(-Math.PI / 2, 0, item[4]);
    m.scale.set(item[2], item[3], 1);
    const onWalk = inBlock(item[0], item[1]);
    m.position.set(item[0], (onWalk ? 0 : L.roadY) + 0.011, item[1]);
    m.renderOrder = 2;
    group.add(m);
  }

  // ---------------------------------------------------------------- 湿地面光带
  const streakMatBase = new THREE.MeshBasicMaterial({
    map: streakMap, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xffc98a, side: THREE.DoubleSide, fog: true,
  });

  function lightStreak(x, z, w, l, color, rotY, onWalk, gain) {
    const mat = streakMatBase.clone();
    mat.color = new THREE.Color(color);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
    m.rotation.set(-Math.PI / 2, 0, rotY || 0);
    m.position.set(x, (onWalk ? 0 : L.roadY) + 0.014, z);
    m.renderOrder = 3;
    group.add(m);
    ctx.waterMaterials.push({
      mat,
      target: (env) => clamp(env.wetness * (0.22 + env.nightFactor * 0.95), 0, 1) * (gain === undefined ? 1 : gain),
    });
    return m;
  }

  lightStreak(-6.2, 12.6, 2.2, 8.4, 0x9fc4ff, 0, false, 0.85);
  lightStreak(13.2, -6.5, 7.2, 2.0, 0x9fc4ff, Math.PI / 2, false, 0.7);
  lightStreak(12.8, 6.8, 7.0, 2.0, 0x9fc4ff, Math.PI / 2, false, 0.7);
  lightStreak(12.6, 6.2, 0.9, 4.6, 0xff5a6e, 0, false, 0.5);
  lightStreak(6.4, 12.8, 4.4, 0.9, 0x7dffc4, Math.PI / 2, false, 0.35);

  // ---------------------------------------------------------------- 护栏
  const railMat = stdMat({ color: 0x9ea2a6, roughness: 0.42, metalness: 0.75 });
  const railPostGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8);
  function guardrail(x0, x1, z) {
    const g = new THREE.Group();
    const n = Math.max(2, Math.floor((x1 - x0) / 1.6));
    for (let i = 0; i <= n; i++) {
      const post = new THREE.Mesh(railPostGeo, railMat);
      post.position.set(x0 + (x1 - x0) * (i / n), 0.45, z);
      post.castShadow = true;
      g.add(post);
    }
    for (const y of [0.82, 0.55]) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, x1 - x0, 8), railMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set((x0 + x1) / 2, y, z);
      beam.castShadow = true;
      g.add(beam);
    }
    group.add(g);
    ctx.snowSurfaces.push({ x: (x0 + x1) / 2, y: 0.86, z, w: x1 - x0, d: 0.1, h: 0.05 });
    return g;
  }
  guardrail(-18.6, -12.6, 21.4);
  guardrail(-18.8, -14.8, -16.8);
  guardrail(-9.0, -2.2, 8.55);

  const ventMat = stdMat({ color: 0x5b5f63, roughness: 0.55, metalness: 0.6 });
  for (const item of [[-10.2, 8.2], [7.4, -8.4]]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.5), ventMat);
    v.position.set(item[0], 0.012, item[1]);
    group.add(v);
  }

  return group;
}
