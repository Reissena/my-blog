// ---------------------------------------------------------------------------
// vehicles.js — 停靠的日式配送卡车 + 沿门前道路循环行驶的小汽车
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L } from './layout.js';
import { roundedBoxGeometry, canvasTexture, damp, clamp } from './util.js';

function lightPoolTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.35, 2, w / 2, h * 0.5, w * 0.55);
    g.addColorStop(0, 'rgba(255,240,200,0.9)');
    g.addColorStop(0.4, 'rgba(255,220,150,0.35)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

export function buildVehicles(ctx) {
  const group = new THREE.Group();
  group.name = 'vehicles';
  ctx.scene.add(group);

  const poolTex = lightPoolTexture();
  const paintSilver = new THREE.MeshStandardMaterial({ color: 0xa4b8c9, metalness: 0.7, roughness: 0.3, emissive: 0x0a1017, emissiveIntensity: 0.5 });
  const paintWhite = new THREE.MeshStandardMaterial({ color: 0xf1f4f5, metalness: 0.32, roughness: 0.44, emissive: 0x0a0f12, emissiveIntensity: 0.5 });
  const paintBlue = new THREE.MeshStandardMaterial({ color: 0x2a3d52, metalness: 0.6, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0d1a22, metalness: 0.45, roughness: 0.06, transparent: true, opacity: 0.66,
    envMapIntensity: 1.5, depthWrite: false,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.96, metalness: 0.02 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc3ccd3, metalness: 0.92, roughness: 0.26 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.62, metalness: 0.38 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xb9c2c8, metalness: 0.95, roughness: 0.18 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xffe4b0, emissiveIntensity: 2.2, roughness: 0.3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: 0xff3b3b, emissiveIntensity: 1.6, roughness: 0.35 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff9a2a, emissiveIntensity: 1.3, roughness: 0.4 });

  ctx.wetMaterials.push(
    { mat: paintSilver, dry: { color: new THREE.Color(0x93a6ba), roughness: 0.28, metalness: 0.72 }, wet: { color: new THREE.Color(0x7d92a8), roughness: 0.1, metalness: 0.85 } },
    { mat: paintWhite, dry: { color: new THREE.Color(0xe8edf0), roughness: 0.42, metalness: 0.35 }, wet: { color: new THREE.Color(0xc9d3d9), roughness: 0.16, metalness: 0.6 } },
  );
  for (const m of [glass]) {
    m.userData.glass = true;
    ctx.glassMats.push(m);
  }

  function box(w, h, d, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function makeWheel(radius, width, axis, spokes) {
    const g = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
    const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.012, 12);
    const hubGeo = new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width + 0.03, 8);
    if (axis === 'z') {
      tireGeo.rotateX(Math.PI / 2); rimGeo.rotateX(Math.PI / 2); hubGeo.rotateX(Math.PI / 2);
    } else {
      tireGeo.rotateZ(Math.PI / 2); rimGeo.rotateZ(Math.PI / 2); hubGeo.rotateZ(Math.PI / 2);
    }
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    g.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    g.add(rim);
    g.add(new THREE.Mesh(hubGeo, darkMat));
    if (spokes) {
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.05, radius * 0.1, 0.012), rimMat);
        sp.rotation.z = (i / 5) * Math.PI;
        sp.position.z = axis === 'z' ? width / 2 + 0.008 : 0;
        if (axis === 'x') { sp.rotation.set(0, Math.PI / 2, (i / 5) * Math.PI); sp.position.x = width / 2 + 0.008; }
        g.add(sp);
      }
    }
    return g;
  }

  // ------------------------------------------------------------------ 小汽车
  const car = new THREE.Group();
  const carBody = new THREE.Mesh(roundedBoxGeometry(3.95, 0.56, 1.72, 0.16), paintSilver);
  carBody.position.set(0, 0.62, 0);
  carBody.castShadow = true; carBody.receiveShadow = true;
  car.add(carBody);

  const hood = new THREE.Mesh(roundedBoxGeometry(1.2, 0.14, 1.64, 0.06), paintSilver);
  hood.position.set(1.3, 0.9, 0);
  car.add(hood);
  const trunk = new THREE.Mesh(roundedBoxGeometry(0.85, 0.16, 1.6, 0.06), paintSilver);
  trunk.position.set(-1.5, 0.92, 0);
  car.add(trunk);

  const cabin = new THREE.Mesh(roundedBoxGeometry(1.9, 0.56, 1.56, 0.14), glass);
  cabin.position.set(-0.1, 1.11, 0);
  cabin.renderOrder = 3;
  car.add(cabin);
  const roof = new THREE.Mesh(roundedBoxGeometry(1.5, 0.08, 1.5, 0.04), paintSilver);
  roof.position.set(-0.12, 1.4, 0);
  car.add(roof);
  for (const z of [-0.79, 0.79]) {
    const pillar = box(0.09, 0.5, 0.04, darkMat, 0.78, 1.1, z);
    car.add(pillar);
    const pillar2 = box(0.09, 0.5, 0.04, darkMat, -0.95, 1.1, z);
    car.add(pillar2);
  }

  // 车头 / 车尾
  car.add(box(0.12, 0.3, 1.66, darkMat, 1.99, 0.55, 0));
  car.add(box(0.1, 0.2, 1.5, darkMat, -2.0, 0.58, 0));
  for (const z of [-0.58, 0.58]) {
    car.add(box(0.06, 0.13, 0.34, headMat, 1.98, 0.82, z));
    car.add(box(0.05, 0.12, 0.3, tailMat, -1.99, 0.86, z));
    const mirror = box(0.16, 0.1, 0.08, darkMat, 0.72, 1.05, z > 0 ? 0.92 : -0.92);
    car.add(mirror);
    car.add(box(0.14, 0.03, 0.03, darkMat, 0.78, 0.98, z > 0 ? 0.88 : -0.88));
  }
  car.add(box(0.02, 0.16, 0.42, chromeMat, -2.02, 0.5, 0));
  // 车牌
  car.add(box(0.02, 0.12, 0.34, new THREE.MeshStandardMaterial({ color: 0xe8ead8, roughness: 0.6 }), 2.01, 0.5, 0));

  const carWheels = [];
  for (const x of [1.28, -1.28]) {
    for (const z of [-0.8, 0.8]) {
      const w = makeWheel(0.33, 0.21, 'z', true);
      w.position.set(x, 0.33, z);
      car.add(w);
      carWheels.push(w);
    }
  }

  // 车灯光束 / 地面光斑 / 尾灯倒影
  const headLight = new THREE.SpotLight(0xffe6c0, 0, 24, 0.46, 0.75, 1.5);
  headLight.position.set(2.0, 0.8, 0);
  headLight.castShadow = false;
  headLight.target.position.set(14, 0.1, 0);
  car.add(headLight);
  car.add(headLight.target);

  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xffd9a0,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.8), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.rotation.z = Math.PI / 2;
  pool.position.set(4.8, 0.02, 0);
  pool.renderOrder = 4;
  car.add(pool);

  const tailMatPool = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xff3a4a,
  });
  const tailPool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), tailMatPool);
  tailPool.rotation.x = -Math.PI / 2;
  tailPool.rotation.z = Math.PI / 2;
  tailPool.position.set(-4.2, 0.018, 0);
  tailPool.renderOrder = 4;
  car.add(tailPool);

  const splashMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xcfe2ff,
  });
  const splashes = [];
  for (const x of [-1.1, -1.5]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), splashMat.clone());
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.03, 0.8);
    s.renderOrder = 5;
    car.add(s);
    splashes.push(s);
  }

  // 卡车旁的冷白补光，让车身在夜里能被读出来
  const truckFill = new THREE.PointLight(0xbcd6ff, 11, 9, 1.9);
  truckFill.position.set(12.2, 4.2, 0.2);
  group.add(truckFill);

  car.position.set(-30, L.roadY, 12.2);
  car.rotation.y = 0;
  group.add(car);

  // ------------------------------------------------------------------ 配送卡车
  const truck = new THREE.Group();
  truck.position.set(9.85, L.roadY, 0.2);
  group.add(truck);

  const chassis = box(1.86, 0.26, 4.8, darkMat, 0, 0.52, -0.15);
  truck.add(chassis);

  const cab = new THREE.Mesh(roundedBoxGeometry(1.9, 1.5, 1.6, 0.1), paintWhite);
  cab.position.set(0, 1.32, -2.05);
  cab.castShadow = true;
  truck.add(cab);

  const cabRoof = new THREE.Mesh(roundedBoxGeometry(1.86, 0.16, 1.7, 0.06), paintWhite);
  cabRoof.position.set(0, 2.1, -2.02);
  truck.add(cabRoof);

  // 挡风玻璃 / 侧窗
  const windshield = box(1.66, 0.72, 0.04, glass, 0, 1.62, -2.86, -0.12);
  truck.add(windshield);
  for (const x of [-0.96, 0.96]) {
    truck.add(box(0.03, 0.58, 0.92, glass, x, 1.66, -2.1));
    truck.add(box(0.18, 0.08, 0.1, darkMat, x * 1.12, 1.62, -2.55));
    truck.add(box(0.08, 0.22, 0.06, darkMat, x * 1.3, 1.7, -2.55));
    truck.add(box(0.1, 0.3, 0.16, darkMat, x * 1.36, 1.72, -2.55));
  }

  // 厢体
  const cargo = new THREE.Mesh(roundedBoxGeometry(1.98, 2.05, 3.2, 0.07), paintWhite);
  cargo.position.set(0, 1.62, 0.55);
  cargo.castShadow = true; cargo.receiveShadow = true;
  truck.add(cargo);

  const stripe = box(2.0, 0.16, 3.22, new THREE.MeshStandardMaterial({ color: 0x2c7a5b, roughness: 0.55, metalness: 0.2 }), 0, 0.95, 0.55);
  truck.add(stripe);
  const stripe2 = box(2.0, 0.05, 3.22, new THREE.MeshStandardMaterial({ color: 0x8fc9ac, roughness: 0.55, metalness: 0.2 }), 0, 0.85, 0.55);
  truck.add(stripe2);

  // 后门
  for (const x of [-0.47, 0.47]) {
    truck.add(box(0.88, 1.78, 0.05, paintWhite, x, 1.62, 2.16));
    truck.add(box(0.05, 0.34, 0.03, chromeMat, x + 0.36, 1.35, 2.2));
    truck.add(box(0.62, 0.02, 0.01, darkMat, x, 1.0, 2.2));
  }
  truck.add(box(1.98, 0.08, 0.06, darkMat, 0, 0.58, 2.16));

  // 保险杠 / 车灯 / 反光片
  truck.add(box(1.92, 0.22, 0.14, darkMat, 0, 0.62, -2.93));
  for (const x of [-0.66, 0.66]) {
    truck.add(box(0.34, 0.16, 0.06, headMat, x, 0.92, -2.9));
    truck.add(box(0.2, 0.1, 0.04, amberMat, x * 1.35, 0.95, -2.86));
    truck.add(box(0.26, 0.14, 0.05, tailMat, x, 0.9, 2.19));
  }
  truck.add(box(1.4, 0.1, 0.02, new THREE.MeshStandardMaterial({ color: 0x2c7a5b, roughness: 0.6 }), 0, 0.92, -2.91));

  const truckWheels = [];
  for (const z of [-1.85, 1.1]) {
    for (const x of [-0.88, 0.88]) {
      const w = makeWheel(0.37, 0.24, 'x', false);
      w.position.set(x, 0.37, z);
      truck.add(w);
      truckWheels.push(w);
    }
  }
  // 后轮挡泥板
  for (const x of [-0.88, 0.88]) {
    truck.add(box(0.32, 0.1, 0.9, darkMat, x, 0.78, 1.1));
  }

  // 侧面的小灯
  const sideLampMat = new THREE.MeshStandardMaterial({ color: 0xffc27a, emissive: 0xffa64a, emissiveIntensity: 1.2, roughness: 0.4 });
  for (const x of [-1.0, 1.0]) {
    truck.add(box(0.04, 0.08, 0.24, sideLampMat, x, 0.7, -0.9));
    truck.add(box(0.04, 0.08, 0.24, sideLampMat, x, 0.7, 1.9));
  }
  // 底部阴影片
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const carShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.9), shadowMat);
  carShadow.rotation.x = -Math.PI / 2;
  carShadow.position.y = 0.006;
  car.add(carShadow);
  const truckShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.0), shadowMat);
  truckShadow.rotation.x = -Math.PI / 2;
  truckShadow.position.y = 0.006;
  truck.add(truckShadow);

  // ------------------------------------------------------------------ 状态与更新
  // 环绕街区的闭合路线（南侧店铺门前 → 东侧 → 北侧小巷 → 西侧）
  const pathPoints = [
    new THREE.Vector3(-21, 0, 12.3),
    new THREE.Vector3(0, 0, 12.3),
    new THREE.Vector3(13.2, 0, 12.3),
    new THREE.Vector3(13.2, 0, -2),
    new THREE.Vector3(13.2, 0, -19.5),
    new THREE.Vector3(0, 0, -19.5),
    new THREE.Vector3(-21.4, 0, -19.5),
    new THREE.Vector3(-21.4, 0, -3),
  ];
  const path = new THREE.CatmullRomCurve3(pathPoints, true, 'catmullrom', 0.4);
  path.arcLengthDivisions = 400;
  const pathLength = path.getLength();
  const state = { dist: 0, speed: 0, paused: false, spin: 0 };
  const CRUISE = 5.4;
  const startP = path.getPointAt(0);
  car.position.set(startP.x, L.roadY, startP.z);

  function update(dt, time, env) {
    const night = env.nightFactor;
    const wet = env.wetness;
    const weatherLight = clamp(env.rain * 0.3 + night, 0, 1.4);

    const targetSpeed = state.paused ? 0 : CRUISE;
    state.speed = damp(state.speed, targetSpeed, 2.4, dt);
    state.dist = (state.dist + state.speed * dt) % pathLength;
    const t = state.dist / pathLength;
    const p = path.getPointAt(t);
    const tan = path.getTangentAt(t);
    car.position.set(p.x, L.roadY, p.z);
    car.rotation.y = Math.atan2(-tan.z, tan.x);

    const dist = state.speed * dt;
    state.spin += dist / 0.33;
    for (const w of carWheels) w.rotation.z = -state.spin;

    const headOn = 0.12 + weatherLight * 2.4;
    headMat.emissiveIntensity = headOn;
    tailMat.emissiveIntensity = 0.5 + weatherLight * 1.8;
    headLight.intensity = weatherLight * 26;
    poolMat.opacity = 0.05 + weatherLight * 0.22;
    tailMatPool.opacity = 0.04 + weatherLight * 0.16;

    const splash = wet * clamp(state.speed / CRUISE, 0, 1);
    splashes.forEach((s, i) => {
      s.material.opacity = splash * (0.18 + 0.08 * Math.sin(time * 9 + i * 2));
      const sc = 0.7 + 0.35 * Math.sin(time * 7 + i);
      s.scale.set(sc, sc, 1);
    });

    sideLampMat.emissiveIntensity = 0.35 + night * 1.1;
  }

  return {
    group,
    car,
    truck,
    update,
    setPaused(v) { state.paused = !!v; },
    getState() { return { paused: state.paused, dist: state.dist, speed: state.speed, pathLength }; },
    path,
  };
}
