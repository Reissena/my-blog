// ---------------------------------------------------------------------------
// petals.js — sakura petal snow + ground petal carpets around the trees
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { canvasTexture, mulberry32 } from './toon.js';
import { groundHeightAt } from './street.js';

const COUNT = 420;

function petalTexture() {
  return canvasTexture(64, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.43);
      ctx.bezierCurveTo(w * 0.36, -h * 0.28, w * 0.30, h * 0.24, 0, h * 0.43);
      ctx.bezierCurveTo(-w * 0.30, h * 0.24, -w * 0.36, -h * 0.28, 0, -h * 0.43);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#ffe6ee');
    g.addColorStop(0.5, '#f7b9cd');
    g.addColorStop(1, '#e895b2');
    ctx.fillStyle = g;
    path();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,245,248,0.35)';
    ctx.lineWidth = 1.2;
    path();
    ctx.stroke();
    // top notch
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.43, w * 0.065, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.3);
    ctx.lineTo(0, h * 0.28);
    ctx.stroke();
  }, { anisotropy: 4 });
}

function scatterTexture() {
  const rnd = mulberry32(2468);
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cols = ['#f2adc3', '#f7c5d5', '#e895b2', '#ffdbe6'];
    for (let i = 0; i < 240; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const a = rnd() * Math.PI;
      const rw = 3 + rnd() * 7;
      const rh = 6 + rnd() * 12;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.globalAlpha = 0.18 + rnd() * 0.5;
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.beginPath();
      ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

export function createPetals(scene, spotsInput) {
  const spots = (spotsInput && spotsInput.length) ? spotsInput : [[11.28, -7.4], [-10.7, -9.2]];
  const rnd = mulberry32(7781);
  const group = new THREE.Group();
  group.name = 'sakura-petals';
  scene.add(group);

  const tex = petalTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  group.add(mesh);

  const colors = [0xffffff, 0xffe9ef, 0xffd7e3, 0xf7c9d8];
  for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  mesh.instanceColor.needsUpdate = true;

  const petals = [];
  const dummy = new THREE.Object3D();
  const nearShare = 0.68;

  function reset(p, initial) {
    const near = p.spotIndex >= 0;
    const spot = near ? spots[p.spotIndex] : null;
    if (near) {
      p.x = spot[0] + (rnd() - 0.5) * 4.4;
      p.z = spot[1] + (rnd() - 0.5) * 4.4;
      p.y = initial ? 4.2 + rnd() * 5.2 : 5.2 + rnd() * 4.2;
    } else {
      p.x = (rnd() - 0.5) * 23.5;
      p.z = (rnd() - 0.5) * 23.5;
      p.y = initial ? 5.5 + rnd() * 6 : 7 + rnd() * 5;
    }
    p.speed = 0.30 + rnd() * 0.55;
    p.sway = 0.45 + rnd() * 0.75;
    p.phase = rnd() * Math.PI * 2;
    p.drift = 0.18 + rnd() * 0.3;
    p.spin = 0.35 + rnd() * 0.9;
    p.size = 0.085 + rnd() * 0.075;
  }

  for (let i = 0; i < COUNT; i++) {
    const near = rnd() < nearShare;
    const p = {
      spotIndex: near ? Math.floor(rnd() * spots.length) : -1,
      x: 0, z: 0, y: 0, speed: 0.4, sway: 0.6, phase: 0, drift: 0.2, spin: 0.5, size: 0.1,
    };
    reset(p, true);
    petals.push(p);
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.phase, p.phase * 1.7, 0);
    dummy.scale.set(p.size, p.size * 1.55, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  // loose petals collected on the ground under the trees
  const carpetTex = scatterTexture();
  const carpetMat = new THREE.MeshBasicMaterial({
    map: carpetTex,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  for (const spot of spots) {
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(spot[0], groundHeightAt(spot[0], spot[1]) + 0.009, spot[1]);
    carpet.renderOrder = 2;
    group.add(carpet);
  }

  function update(time, dt) {
    if (!group.visible) return;
    for (let i = 0; i < COUNT; i++) {
      const p = petals[i];
      p.y -= p.speed * dt;
      p.x += Math.sin(time * p.sway + p.phase) * p.drift * dt;
      p.z += Math.cos(time * p.sway * 0.73 + p.phase * 1.3) * p.drift * 0.7 * dt;
      if (p.y < 0.09) reset(p, false);
      const rx = time * p.spin + p.phase;
      const ry = time * p.spin * 0.63 + p.phase * 1.7;
      const rz = Math.sin(time * 0.8 + p.phase) * 0.9;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(p.size, p.size * 1.55, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function setEnabled(v) {
    group.visible = !!v;
    if (group.visible) mesh.instanceMatrix.needsUpdate = true;
  }

  return { group, update, setEnabled };
}
