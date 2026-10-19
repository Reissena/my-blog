// ---------------------------------------------------------------------------
// sakura.js — 程序化樱花树：弯曲枝干 + 花朵贴片 + 花簇卡片 + 落花
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L } from './layout.js';
import { mulberry32, canvasTexture, rand } from './util.js';

const TINTS = [0xffffff, 0xfff4f8, 0xffe6ee, 0xffd6e2, 0xffc4d5, 0xffb2c8, 0xf79fb8];

function blossomTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    for (let i = 0; i < 5; i++) {
      c.save();
      c.rotate((i / 5) * Math.PI * 2);
      const g = c.createLinearGradient(0, -52, 0, 8);
      g.addColorStop(0, 'rgba(255,255,255,0.98)');
      g.addColorStop(0.55, 'rgba(255,206,222,0.98)');
      g.addColorStop(1, 'rgba(243,155,182,0.95)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, -27, 17, 26, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    c.fillStyle = 'rgba(255,236,170,0.95)';
    c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.arc(-2, -2, 3, 0, Math.PI * 2); c.fill();
  });
}

function clusterTexture() {
  return canvasTexture(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const rnd = mulberry32(77);
    for (let i = 0; i < 26; i++) {
      const x = 34 + rnd() * (w - 68);
      const y = 34 + rnd() * (h - 68);
      const r = 12 + rnd() * 22;
      c.save();
      c.translate(x, y);
      c.rotate(rnd() * Math.PI * 2);
      c.globalAlpha = 0.65 + rnd() * 0.35;
      for (let p = 0; p < 5; p++) {
        c.save();
        c.rotate((p / 5) * Math.PI * 2);
        const g = c.createLinearGradient(0, -r, 0, 2);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.6, 'rgba(255,205,222,0.92)');
        g.addColorStop(1, 'rgba(246,160,186,0.9)');
        c.fillStyle = g;
        c.beginPath(); c.ellipse(0, -r * 0.6, r * 0.42, r * 0.62, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      c.restore();
    }
    c.globalAlpha = 1;
  });
}

function barkTexture() {
  return canvasTexture(128, 256, (c, w, h) => {
    c.fillStyle = '#4a3a32'; c.fillRect(0, 0, w, h);
    const rnd = mulberry32(19);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w;
      c.strokeStyle = rnd() > 0.5 ? 'rgba(28,20,16,0.5)' : 'rgba(120,98,84,0.35)';
      c.lineWidth = 1 + rnd() * 2.4;
      c.beginPath();
      let y = rnd() * h;
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) { y += 8 + rnd() * 22; c.lineTo(x + (rnd() - 0.5) * 6, y); }
      c.stroke();
    }
  }, { wrap: true, repeat: [3, 1] });
}

function crossGeometry() {
  const a = new THREE.PlaneGeometry(1, 1);
  const b = new THREE.PlaneGeometry(1, 1);
  b.rotateY(Math.PI / 2);
  const pos = [], uv = [], nor = [], idx = [];
  let off = 0;
  for (const g of [a, b]) {
    pos.push(...g.attributes.position.array);
    uv.push(...g.attributes.uv.array);
    nor.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(i + off);
    off += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

export function buildSakura(ctx) {
  const group = new THREE.Group();
  group.name = 'sakura';
  ctx.scene.add(group);

  const barkMap = barkTexture();
  const petalMap = blossomTexture();
  const clusterMap = clusterTexture();
  const petalGeo = new THREE.PlaneGeometry(1, 1);
  const clusterGeo = crossGeometry();
  const branchGeo = new THREE.CylinderGeometry(0.62, 1, 1, 7, 1, true);

  const barkMat = new THREE.MeshStandardMaterial({ map: barkMap, color: 0x9c8574, roughness: 0.95, metalness: 0.0 });
  const petalMat = new THREE.MeshStandardMaterial({
    map: petalMap, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.82, metalness: 0.0,
    emissive: 0xff9fbe, emissiveIntensity: 0.06,
  });
  const clusterMat = new THREE.MeshStandardMaterial({
    map: clusterMap, alphaTest: 0.28, side: THREE.DoubleSide, roughness: 0.88, metalness: 0.0,
    emissive: 0xff9fbe, emissiveIntensity: 0.05,
  });
  ctx.blossomMats.push(petalMat, clusterMat);

  const treeData = [];
  const snowPoints = [];
  const groundPetals = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tmpQ = new THREE.Quaternion();

  function growTree(conf) {
    const rnd = mulberry32(conf.seed);
    const scale = conf.scale;
    const branches = [];
    const petals = [];
    const clusters = [];

    function addPetals(center, spread, count, sizeK) {
      for (let i = 0; i < count; i++) {
        const off = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize()
          .multiplyScalar(spread * (0.35 + rnd() * 0.9));
        petals.push({
          p: center.clone().add(off),
          size: (0.1 + rnd() * 0.12) * scale * sizeK,
          rot: new THREE.Euler(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI),
          tint: TINTS[Math.floor(rnd() * TINTS.length)],
        });
      }
    }

    function addCluster(center, radius) {
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const off = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(radius * 1.4);
        clusters.push({
          p: center.clone().add(off),
          size: radius * (1.0 + rnd() * 0.8),
          rot: new THREE.Euler(rnd() * 0.6 - 0.3, rnd() * Math.PI, rnd() * 0.6 - 0.3),
          tint: TINTS[Math.floor(rnd() * 4)],
        });
      }
      addPetals(center, radius * 1.35, 11, 1.0);
    }

    function grow(start, dir, len, radius, depth) {
      const segs = depth >= 4 ? 4 : 3;
      let pos = start.clone();
      let d = dir.clone();
      for (let s = 0; s < segs; s++) {
        const segLen = len / segs;
        d.add(new THREE.Vector3((rnd() - 0.5) * 0.24, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.24));
        d.y += 0.05;
        d.normalize();
        const end = pos.clone().addScaledVector(d, segLen);
        const r0 = Math.max(0.012, radius * (1 - (s / segs) * 0.34));
        const r1 = Math.max(0.01, radius * (1 - ((s + 1) / segs) * 0.34));
        branches.push({ a: pos.clone(), b: end.clone(), r0, r1 });
        if (depth <= 2) addPetals(pos.clone().add(end).multiplyScalar(0.5), 0.38 * scale, 3 + Math.floor(rnd() * 3), 1.05);
        if (depth <= 1 && s === segs - 1) addCluster(end, 0.22 * scale);
        pos = end;
      }
      if (depth === 0) { addCluster(pos, 0.42 * scale); return; }
      const children = depth >= 4 ? 3 : (rnd() > 0.4 ? 2 : 3);
      for (let i = 0; i < children; i++) {
        const axis = new THREE.Vector3(rnd() - 0.5, rnd() * 0.25, rnd() - 0.5).normalize();
        const ang = (depth >= 4 ? 0.52 : 0.72) + rnd() * 0.36;
        const nd = d.clone().applyAxisAngle(axis, ang);
        nd.y += 0.17;
        nd.normalize();
        grow(pos, nd, len * (0.62 + rnd() * 0.15), radius * (0.55 + rnd() * 0.1), depth - 1);
      }
    }

    grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(conf.lean * 1.6, 1, conf.lean * 0.9).normalize(), 2.45 * scale, 0.21 * scale, 5);
    return { branches, petals, clusters };
  }

  for (const conf of L.trees) {
    const tree = new THREE.Group();
    tree.position.set(conf.x, 0, conf.z);
    tree.rotation.y = (conf.seed % 9) * 0.7;
    group.add(tree);

    const grown = growTree(conf);
    const matrices = [];
    for (const b of grown.branches) {
      const dir = new THREE.Vector3().subVectors(b.b, b.a);
      const len = dir.length();
      if (len < 0.001) continue;
      dir.normalize();
      tmpQ.setFromUnitVectors(up, dir);
      const mid = new THREE.Vector3().addVectors(b.a, b.b).multiplyScalar(0.5);
      const r = (b.r0 + b.r1) * 0.5;
      matrices.push(new THREE.Matrix4().compose(mid, tmpQ.clone(), new THREE.Vector3(r, len, r)));
    }
    const branchMesh = new THREE.InstancedMesh(branchGeo, barkMat, matrices.length);
    matrices.forEach((m, i) => branchMesh.setMatrixAt(i, m));
    branchMesh.instanceMatrix.needsUpdate = true;
    branchMesh.castShadow = true;
    branchMesh.receiveShadow = true;
    tree.add(branchMesh);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62 * conf.scale, 0.72 * conf.scale, 0.07, 14),
      new THREE.MeshStandardMaterial({ color: 0x3b3129, roughness: 1 })
    );
    soil.position.y = 0.02;
    soil.receiveShadow = true;
    tree.add(soil);

    const canopy = new THREE.Group();
    canopy.position.y = 2.1;
    tree.add(canopy);

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, grown.petals.length);
    grown.petals.forEach((p, i) => {
      dummy.position.set(p.p.x, p.p.y - 2.1, p.p.z);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      petalMesh.setMatrixAt(i, dummy.matrix);
      petalMesh.setColorAt(i, col.setHex(p.tint));
    });
    petalMesh.instanceMatrix.needsUpdate = true;
    if (petalMesh.instanceColor) petalMesh.instanceColor.needsUpdate = true;
    canopy.add(petalMesh);

    const clusterMesh = new THREE.InstancedMesh(clusterGeo, clusterMat, grown.clusters.length);
    grown.clusters.forEach((p, i) => {
      dummy.position.set(p.p.x, p.p.y - 2.1, p.p.z);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      clusterMesh.setMatrixAt(i, dummy.matrix);
      clusterMesh.setColorAt(i, col.setHex(p.tint));
    });
    clusterMesh.instanceMatrix.needsUpdate = true;
    if (clusterMesh.instanceColor) clusterMesh.instanceColor.needsUpdate = true;
    canopy.add(clusterMesh);

    const rnd = mulberry32(conf.seed * 5 + 1);
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 3.2 * conf.scale;
      groundPetals.push({
        x: conf.x + Math.cos(a) * r, y: 0.013, z: conf.z + Math.sin(a) * r,
        rot: rnd() * Math.PI * 2, s: 0.055 + rnd() * 0.04,
      });
    }

    const rot = tree.rotation.y;
    for (let i = 0; i < grown.branches.length; i += 3) {
      const seg = grown.branches[i];
      const mid = new THREE.Vector3().addVectors(seg.a, seg.b).multiplyScalar(0.5);
      if (mid.y < 2.6) continue;
      snowPoints.push({
        x: conf.x + mid.x * Math.cos(rot) + mid.z * Math.sin(rot),
        y: mid.y,
        z: conf.z - mid.x * Math.sin(rot) + mid.z * Math.cos(rot),
        r: Math.max(0.03, (seg.r0 + seg.r1) * 0.9),
      });
    }

    treeData.push({ tree, canopy, phase: rnd() * Math.PI * 2, conf });
  }

  const petalTex = canvasTexture(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    const g = c.createLinearGradient(0, -24, 0, 24);
    g.addColorStop(0, '#fff4f8'); g.addColorStop(0.55, '#ffc9da'); g.addColorStop(1, '#ff9fbd');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 26);
    c.bezierCurveTo(-24, 12, -22, -16, -6, -23);
    c.bezierCurveTo(-2, -24, 0, -17, 0, -13);
    c.bezierCurveTo(0, -17, 2, -24, 6, -23);
    c.bezierCurveTo(22, -16, 24, 12, 0, 26);
    c.fill();
  });
  const groundMat = new THREE.MeshStandardMaterial({
    map: petalTex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false,
  });
  const gPetal = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), groundMat, groundPetals.length);
  {
    const d = new THREE.Object3D();
    groundPetals.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(-Math.PI / 2, 0, p.rot);
      d.scale.set(p.s * 1.5, p.s * 1.9, 1);
      d.updateMatrix();
      gPetal.setMatrixAt(i, d.matrix);
    });
    gPetal.instanceMatrix.needsUpdate = true;
    group.add(gPetal);
  }

  const FALL = 170;
  const fallMat = groundMat.clone();
  fallMat.depthWrite = true;
  const fallMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), fallMat, FALL);
  fallMesh.frustumCulled = false;
  fallMesh.renderOrder = 6;
  group.add(fallMesh);
  const petals = [];
  for (let i = 0; i < FALL; i++) {
    petals.push({
      x: rand(-20, 10), y: rand(0.4, 9), z: rand(-16, 10),
      vy: rand(0.3, 0.62), sway: rand(0.4, 1.1), phase: rand(0, Math.PI * 2),
      spin: rand(-1.2, 1.2), size: rand(0.06, 0.11),
      rx: rand(0, Math.PI * 2), ry: rand(0, Math.PI * 2), rz: rand(0, Math.PI * 2),
    });
  }
  const fd = new THREE.Object3D();

  const api = {
    update(dt, t, env) {
      const wind = env.wind !== undefined ? env.wind : 0.4;
      const gust = 0.55 + wind * 1.4;
      for (const td of treeData) {
        td.canopy.rotation.z = Math.sin(t * 0.6 + td.phase) * 0.012 * gust + Math.sin(t * 1.6 + td.phase * 2) * 0.004 * gust;
        td.canopy.rotation.x = Math.cos(t * 0.47 + td.phase) * 0.009 * gust;
      }
      const visible = Math.max(0, Math.min(1, env.petal !== undefined ? env.petal : 1));
      fallMesh.visible = visible > 0.02;
      if (!fallMesh.visible) return;
      const active = Math.max(1, Math.floor(FALL * visible));
      for (let i = 0; i < active; i++) {
        const p = petals[i];
        p.y -= p.vy * dt * (0.8 + wind * 0.7);
        p.x += (Math.sin(t * 0.8 + p.phase) * p.sway * 0.5 + wind * 0.8) * dt;
        p.z += (Math.cos(t * 0.63 + p.phase * 1.3) * p.sway * 0.35 + wind * 0.3) * dt;
        p.rx += p.spin * dt * 0.8;
        p.rz += p.spin * dt * 0.5;
        if (p.y < 0.1) { p.y = rand(7.5, 9.5); p.x = rand(-20, 10); p.z = rand(-16, 10); }
        if (p.x > 11) p.x = -20;
        if (p.x < -21) p.x = 10;
        if (p.z > 11) p.z = -16;
        if (p.z < -17) p.z = 10;
        fd.position.set(p.x, p.y, p.z);
        fd.rotation.set(p.rx, p.ry + t * p.spin * 0.3, p.rz);
        const s = p.size * (0.9 + Math.sin(t * 2.2 + p.phase) * 0.12);
        fd.scale.set(s * 1.4, s * 1.7, 1);
        fd.updateMatrix();
        fallMesh.setMatrixAt(i, fd.matrix);
      }
      fallMesh.count = active;
      fallMesh.instanceMatrix.needsUpdate = true;
    },
  };

  ctx.sakura = api;
  ctx.snowPoints = snowPoints;
  return group;
}
