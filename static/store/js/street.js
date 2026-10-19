// ---------------------------------------------------------------------------
// street.js — 路灯、电线杆、信号灯、自动售货机、自行车与街边小物
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L } from './layout.js';
import { canvasTexture, JP_FONT, rand, mulberry32, stdMat } from './util.js';

function haloTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

function vendingTexture(kind) {
  return canvasTexture(512, 800, (c, w, h) => {
    const cold = kind === 'cold';
    c.fillStyle = cold ? '#eef6ff' : '#fff3e6';
    c.fillRect(0, 0, w, h);
    // 顶部品牌条
    c.fillStyle = cold ? '#1f5fa8' : '#b03a35';
    c.fillRect(0, 0, w, 118);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 62px ' + JP_FONT;
    c.fillText(cold ? 'つめたい' : 'あったかい', w / 2, 62);
    c.font = '500 22px "Inter", sans-serif';
    c.fillText(cold ? 'COLD DRINKS' : 'HOT DRINKS', w / 2, 104);

    // 饮料格
    const cols = 5, rows = 3;
    const x0 = 28, y0 = 150, cw = (w - 56) / cols, ch = 150;
    const colors = ['#e04a3f', '#2f8f5b', '#e8b23c', '#4b78c4', '#9c5ab8', '#d97b32', '#4aa3a3', '#c9426b'];
    const rnd = mulberry32(cold ? 5 : 9);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const x = x0 + k * cw, y = y0 + r * ch;
        c.fillStyle = 'rgba(20,30,45,0.08)';
        c.fillRect(x + 6, y + 6, cw - 12, ch - 24);
        // 瓶子
        c.fillStyle = colors[Math.floor(rnd() * colors.length)];
        const bw = 42, bh = 84;
        const bx0 = x + cw / 2 - bw / 2, by0 = y + 24;
        c.beginPath();
        c.roundRect(bx0, by0, bw, bh, 12);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.fillRect(bx0 + 8, by0 + 12, 8, bh - 30);
        // 标签
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillRect(bx0 + 4, by0 + bh * 0.45, bw - 8, 20);
        // 价格
        c.fillStyle = '#22303f';
        c.font = '700 26px "Inter", sans-serif';
        c.textAlign = 'center';
        c.fillText('¥' + (cold ? 130 : 120), x + cw / 2, y + ch - 22);
      }
    }
    // 下方按钮区
    c.fillStyle = cold ? '#dbe9f7' : '#f6e3d2';
    c.fillRect(0, h - 210, w, 210);
    for (let i = 0; i < 5; i++) {
      c.fillStyle = 'rgba(40,60,80,0.35)';
      c.fillRect(40 + i * 88, h - 178, 54, 26);
      c.fillStyle = '#3a4a5a';
      c.fillRect(40 + i * 88, h - 140, 54, 8);
    }
    // 取物口
    c.fillStyle = '#20262c';
    c.fillRect(150, h - 96, 212, 62);
    c.fillStyle = '#0d1116';
    c.fillRect(164, h - 82, 184, 34);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.font = '500 20px "Inter", sans-serif';
    c.textAlign = 'center';
    c.fillText('PUSH', w / 2, h - 30);
  });
}

function menuBoardTexture() {
  return canvasTexture(384, 512, (c, w, h) => {
    c.fillStyle = '#2c2620'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c7ac7d'; c.lineWidth = 6;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#f6efdf';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 58px ' + JP_FONT;
    c.fillText('本日のおすすめ', w / 2, 78);
    c.fillStyle = '#ffcf9b';
    c.font = '500 34px ' + JP_FONT;
    c.fillText('桜ラテ', w / 2, 170);
    c.fillText('おにぎり', w / 2, 236);
    c.fillText('おでん', w / 2, 302);
    c.fillStyle = '#ffe9c8';
    c.font = '700 42px "Inter", sans-serif';
    c.fillText('¥280', w / 2, 396);
    c.font = '500 22px "Inter", sans-serif';
    c.fillStyle = 'rgba(246,239,223,0.6)';
    c.fillText('SAKURA MART', w / 2, 460);
  });
}

export function buildStreet(ctx) {
  const group = new THREE.Group();
  group.name = 'street';
  ctx.scene.add(group);
  const rnd = mulberry32(4242);

  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x40464c, roughness: 0.45, metalness: 0.7 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8d9297, roughness: 0.5, metalness: 0.6 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb3b0a6, roughness: 0.9, metalness: 0.05 });
  const halo = haloTexture();

  // ---------------------------------------------------------------- 路灯
  function streetLamp(x, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 12), concreteMat);
    base.position.y = 0.21;
    base.castShadow = true;
    g.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 6.0, 10), poleMat);
    pole.position.y = 3.2;
    pole.castShadow = true;
    g.add(pole);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 6.1, 0),
      new THREE.Vector3(0, 6.55, 0.3),
      new THREE.Vector3(0, 6.72, 0.95),
      new THREE.Vector3(0, 6.66, 1.75),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.06, 8, false), poleMat);
    arm.castShadow = true;
    g.add(arm);

    const headBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.72), darkMetal);
    headBody.position.set(0, 6.56, 2.02);
    headBody.castShadow = true;
    g.add(headBody);

    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xf2f7ff, emissive: 0xbcd8ff, emissiveIntensity: 2.6, roughness: 0.4,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), lampMat);
    panel.rotation.x = Math.PI / 2;
    panel.position.set(0, 6.47, 2.02);
    g.add(panel);

    const glowMat = new THREE.SpriteMaterial({
      map: halo, color: 0xc4dcff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(1.9, 1.9, 1);
    glow.position.set(0, 6.42, 2.02);
    g.add(glow);

    const light = new THREE.PointLight(0xbdd7ff, 42, 27, 1.95);
    light.position.set(0, 6.1, 2.02);
    g.add(light);

    group.add(g);
    ctx.streetLampMats.push({ mat: lampMat, glow: glowMat, light, base: 34, glowBase: 0.62 });
    ctx.snowSurfaces.push({ x: x + Math.sin(rotY) * 2.02, y: 6.64, z: z + Math.cos(rotY) * 2.02, w: 0.44, d: 0.74, h: 0.07 });
    return g;
  }

  for (const lamp of L.streetLamps) streetLamp(lamp.x, lamp.z, lamp.rot);

  // ---------------------------------------------------------------- 信号灯
  const signalGroup = new THREE.Group();
  signalGroup.position.set(7.65, 0, 8.35);
  group.add(signalGroup);

  const sigPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.6, 10), poleMat);
  sigPole.position.y = 2.8;
  sigPole.castShadow = true;
  signalGroup.add(sigPole);
  const sigBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.35, 12), concreteMat);
  sigBase.position.y = 0.175;
  signalGroup.add(sigBase);

  // 横向悬臂，朝西伸向南侧道路
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 5.45, 0),
    new THREE.Vector3(-0.5, 5.72, 0),
    new THREE.Vector3(-1.2, 5.74, 0),
    new THREE.Vector3(-1.8, 5.66, 0),
  ]);
  const sigArm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 16, 0.055, 8, false), poleMat);
  sigArm.castShadow = true;
  signalGroup.add(sigArm);

  const sigBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.32), new THREE.MeshStandardMaterial({ color: 0x2f4a3b, roughness: 0.6, metalness: 0.3 }));
  sigBox.position.set(-1.2, 5.52, 0);
  sigBox.castShadow = true;
  signalGroup.add(sigBox);
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x22332b, roughness: 0.7 });
  const lampMats = [];
  const lampColors = [0x3fd9a0, 0xffd166, 0xff5a6e];
  for (let i = 0; i < 3; i++) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.1, 14), visorMat);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(-1.67 + i * 0.44, 5.52, 0.16);
    signalGroup.add(housing);
    const mat = new THREE.MeshStandardMaterial({
      color: lampColors[i], emissive: lampColors[i], emissiveIntensity: i === 2 ? 2.2 : 0.05, roughness: 0.35,
    });
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), mat);
    bulb.position.set(-1.67 + i * 0.44, 5.52, 0.222);
    signalGroup.add(bulb);
    lampMats.push(mat);
  }
  // 行人信号灯
  const pedBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.26), new THREE.MeshStandardMaterial({ color: 0x2f4a3b, roughness: 0.6 }));
  pedBox.position.set(0.2, 2.9, 0.05);
  signalGroup.add(pedBox);
  const pedRed = new THREE.MeshStandardMaterial({ color: 0xff5a6e, emissive: 0xff5a6e, emissiveIntensity: 0.1, roughness: 0.4 });
  const pedGreen = new THREE.MeshStandardMaterial({ color: 0x55ffc0, emissive: 0x55ffc0, emissiveIntensity: 2.0, roughness: 0.4 });
  for (let i = 0; i < 2; i++) {
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), i === 0 ? pedRed : pedGreen);
    bulb.position.set(0.2, 3.06 - i * 0.28, 0.19);
    signalGroup.add(bulb);
  }
  const signalLight = new THREE.PointLight(0x55ffc0, 2.4, 5, 2.0);
  signalLight.position.set(6.2, 3.0, 8.4);
  group.add(signalLight);
  ctx.signal = { lampMats, pedRed, pedGreen, light: signalLight, t: 0, phase: 0 };

  // 信号灯更新时间
  ctx.updaters.push((dt) => {
    const s = ctx.signal;
    s.t += dt;
    const cycle = 19;
    const tt = s.t % cycle;
    let phase;
    if (tt < 11) phase = 0;        // 绿
    else if (tt < 14) phase = 1;   // 黄
    else phase = 2;                // 红
    if (phase !== s.phase) {
      s.phase = phase;
      lampMats.forEach((m, i) => { m.emissiveIntensity = i === phase ? 2.4 : 0.04; });
      const walk = phase === 2 && tt < 17.4;
      const c = new THREE.Color(phase === 2 ? 0xff5a6e : 0x55ffc0);
      if (s.light) {
        s.light.color.copy(c);
        s.light.intensity = 2.2;
      }
    }
  });

  // ---------------------------------------------------------------- 电线杆
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.85, metalness: 0.1 });
  const poleTops = [];

  function utilityPole(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 8.4, 10), new THREE.MeshStandardMaterial({ color: 0x9c9a92, roughness: 0.9, metalness: 0.05 }));
    p.position.y = 4.6;
    p.castShadow = true;
    g.add(p);
    for (const y of [7.2, 7.9]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.09), darkMetal);
      arm.position.y = y;
      arm.castShadow = true;
      g.add(arm);
      for (const dx of [-0.7, 0, 0.7]) {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.4 }));
        ins.position.set(dx, y + 0.12, 0);
        g.add(ins);
      }
    }
    const trans = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 12), new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.6, metalness: 0.4 }));
    trans.position.set(0.25, 6.25, 0);
    trans.castShadow = true;
    g.add(trans);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0x2c4f8a, roughness: 0.5 }));
    plate.position.set(0, 2.7, 0.2);
    g.add(plate);
    group.add(g);
    poleTops.push(new THREE.Vector3(x, 0, z));
    ctx.snowSurfaces.push({ x, y: 8.4, z, w: 0.4, d: 0.4, h: 0.08 });
    return g;
  }

  utilityPole(21.6, -17.5);
  utilityPole(21.6, 0.5);

  function wire(a, b, y1, y2, sag, xoff) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = a.x + (b.x - a.x) * t + (xoff || 0);
      const z = a.z + (b.z - a.z) * t;
      const y = y1 + (y2 - y1) * t - Math.sin(Math.PI * t) * sag;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.022, 5, false), wireMat);
    group.add(m);
  }

  for (let i = 0; i < poleTops.length - 1; i++) {
    const a = poleTops[i], b = poleTops[i + 1];
    for (const dx of [-0.7, 0, 0.7]) {
      wire(a, b, 7.34, 7.34, 0.5, dx);
      wire(a, b, 8.04, 8.04, 0.42, dx);
    }
    wire(a, b, 6.6, 6.6, 0.35, 0.15);
  }
  // 引入店面的电线（单根）
  if (poleTops[1]) wire(poleTops[1], new THREE.Vector3(4.4, 0, 6.4), 7.1, 4.1, 0.3, 0);

  // ---------------------------------------------------------------- 自动售货机
  function vendingMachine(x, z, rotY, kind) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: kind === 'cold' ? 0xdfe8f0 : 0xf0e0d2, roughness: 0.42, metalness: 0.35,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.78), bodyMat);
    body.position.y = 0.98;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    const frontTex = vendingTexture(kind);
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex, emissiveMap: frontTex, emissive: 0xffffff, emissiveIntensity: 1.15, roughness: 0.35,
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.72), frontMat);
    front.position.set(0, 1.02, 0.392);
    g.add(front);

    const topLip = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.09, 0.82), new THREE.MeshStandardMaterial({ color: 0x39424a, roughness: 0.5, metalness: 0.5 }));
    topLip.position.y = 1.95;
    g.add(topLip);

    // 侧面散热格栅
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.5), new THREE.MeshStandardMaterial({ color: 0x7a8288, roughness: 0.6 }));
      s.position.set(0.56, 0.5 + i * 0.16, 0);
      g.add(s);
    }

    const glow = new THREE.PointLight(kind === 'cold' ? 0xcfe8ff : 0xffd6ad, 5.5, 5, 2.0);
    glow.position.set(0, 1.1, 0.9);
    g.add(glow);

    group.add(g);
    ctx.vendingLights.push(glow);
    ctx.vendingMats.push(frontMat);
    ctx.snowSurfaces.push({
      x: x + Math.sin(rotY) * 0, y: 2.0, z: z + Math.cos(rotY) * 0,
      w: rotY ? 0.82 : 1.14, d: rotY ? 1.14 : 0.82, h: 0.09,
    });
    return g;
  }

  vendingMachine(5.45, 6.62, 0, 'cold');
  vendingMachine(-9.65, 7.7, 0, 'hot');

  // ---------------------------------------------------------------- 垃圾桶
  function bin(x, z, color, label) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.8, 14), mat);
    body.position.y = 0.4;
    body.castShadow = true;
    g.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.07, 14), new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.6 }));
    lid.position.y = 0.83;
    g.add(lid);
    const tex = canvasTexture(128, 64, (c, w, h) => {
      c.fillStyle = 'rgba(0,0,0,0)'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f4f1e6'; c.font = '600 26px ' + JP_FONT;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(label, w / 2, h / 2);
    });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    lab.position.set(0, 0.58, 0.235);
    g.add(lab);
    group.add(g);
    ctx.snowSurfaces.push({ x, y: 0.87, z, w: 0.44, d: 0.44, h: 0.06 });
    return g;
  }
  bin(-4.4, 8.4, 0x3c7a5a, 'もえる');
  bin(-3.85, 8.4, 0x2f5f8a, 'ペット');
  bin(-3.3, 8.4, 0x8a4a3a, 'かん');

  // ---------------------------------------------------------------- 自行车
  function bicycle(x, z, rotY, lean) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.rotation.z = lean || 0;

    const wheelGeo = new THREE.TorusGeometry(0.33, 0.024, 8, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.7, metalness: 0.3 });
    for (const dx of [-0.52, 0.52]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(dx, 0.34, 0);
      w.castShadow = true;
      g.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), poleMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(dx, 0.34, 0);
      g.add(hub);
    }
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x9aa8b4, roughness: 0.35, metalness: 0.75 });
    const tube = (x1, y1, x2, y2, r) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), frameMat);
      m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
      m.rotation.z = Math.atan2(x2 - x1, y2 - y1);
      m.castShadow = true;
      return m;
    };
    g.add(tube(-0.52, 0.34, -0.02, 0.62, 0.022));
    g.add(tube(-0.02, 0.62, 0.30, 0.36, 0.022));
    g.add(tube(0.30, 0.36, 0.52, 0.34, 0.02));
    g.add(tube(-0.52, 0.34, 0.12, 0.36, 0.018));
    g.add(tube(-0.02, 0.62, 0.30, 0.72, 0.02));
    g.add(tube(0.30, 0.72, 0.52, 0.34, 0.02));
    // 车把 / 车座
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), frameMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0.3, 0.76, 0);
    g.add(bar);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.8 }));
    seat.position.set(-0.04, 0.68, 0);
    g.add(seat);
    // 车筐
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.26), new THREE.MeshStandardMaterial({ color: 0x8f9aa3, roughness: 0.6, metalness: 0.5, wireframe: false }));
    basket.position.set(0.42, 0.62, 0);
    basket.castShadow = true;
    g.add(basket);
    group.add(g);
    ctx.snowSurfaces.push({ x, y: 0.78, z, w: 0.5, d: 0.9, h: 0.05 });
    return g;
  }
  bicycle(-9.15, 2.6, -0.35, 0.08);
  bicycle(-9.1, 1.35, -0.28, 0.05);
  bicycle(6.1, -6.6, 2.6, -0.06);

  // ---------------------------------------------------------------- 长椅 & 花坛
  function bench(x, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.11), wood);
      slat.position.set(0, 0.44, -0.2 + i * 0.13);
      slat.castShadow = true;
      g.add(slat);
    }
    for (let i = 0; i < 3; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.11, 0.05), wood);
      slat.position.set(0, 0.62 + i * 0.14, 0.26);
      slat.castShadow = true;
      g.add(slat);
    }
    for (const dx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 0.5), darkMetal);
      leg.position.set(dx, 0.22, 0);
      g.add(leg);
    }
    group.add(g);
    ctx.snowSurfaces.push({ x, y: 0.47, z, w: 1.8, d: 0.5, h: 0.05 });
    return g;
  }
  bench(6.5, -15.0, Math.PI);

  function planter(x, z, w, d) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pot = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, d), new THREE.MeshStandardMaterial({ color: 0x6a6257, roughness: 0.9 }));
    pot.position.y = 0.21;
    pot.castShadow = true; pot.receiveShadow = true;
    g.add(pot);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 0.03, d - 0.08), new THREE.MeshStandardMaterial({ color: 0x38302a, roughness: 1 }));
    soil.position.y = 0.43;
    g.add(soil);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.85 });
    const count = Math.max(4, Math.round(w * d * 3));
    for (let i = 0; i < count; i++) {
      const r = 0.13 + rnd() * 0.16;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMat);
      leaf.position.set((rnd() - 0.5) * (w - 0.2), 0.5 + rnd() * 0.22, (rnd() - 0.5) * (d - 0.2));
      leaf.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      leaf.castShadow = true;
      g.add(leaf);
    }
    return g;
  }
  group.add(planter(-7.1, 7.8, 1.2, 0.7));
  group.add(planter(4.9, -3.2, 0.8, 1.4));
  group.add(planter(-16.8, 5.0, 1.4, 1.4));

  // ---------------------------------------------------------------- A 字菜单牌
  {
    const tex = menuBoardTexture();
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2 });
    const g = new THREE.Group();
    g.position.set(4.35, 0, 8.15);
    g.rotation.y = -0.2;
    for (const s of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.96, 0.04), boardMat);
      board.position.set(0, 0.55, s * 0.1);
      board.rotation.x = s * 0.22;
      board.castShadow = true;
      g.add(board);
    }
    group.add(g);
    ctx.snowSurfaces.push({ x: 4.35, y: 1.02, z: 8.15, w: 0.6, d: 0.24, h: 0.05 });
  }

  // ---------------------------------------------------------------- 路牌
  function roadSign(x, z, text, color) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), poleMat);
    p.position.y = 1.2;
    p.castShadow = true;
    g.add(p);
    const tex = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = color;
      c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#f5f2e8'; c.lineWidth = 12;
      c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 16, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#f5f2e8';
      c.font = '700 140px "Inter", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, w / 2, h / 2 + 8);
    });
    const sign = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }));
    sign.position.y = 2.2;
    g.add(sign);
    group.add(g);
    ctx.snowSurfaces.push({ x, y: 2.33, z, w: 0.12, d: 0.12, h: 0.03 });
    return g;
  }
  roadSign(-13.9, 21.35, 'P', '#245c9a');
  roadSign(7.6, -10.2, 'P', '#245c9a');

  // ---------------------------------------------------------------- 消防栓 & 小物
  const hydrant = new THREE.Group();
  {
    const red = new THREE.MeshStandardMaterial({ color: 0xa8453a, roughness: 0.6, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.5, 10), red);
    body.position.y = 0.28;
    body.castShadow = true;
    hydrant.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), red);
    cap.position.y = 0.55;
    hydrant.add(cap);
    for (const s of [-1, 1]) {
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), red);
      n.rotation.z = Math.PI / 2;
      n.position.set(s * 0.19, 0.4, 0);
      hydrant.add(n);
    }
    hydrant.position.set(-17.6, 0, 8.3);
    group.add(hydrant);
    ctx.snowSurfaces.push({ x: -17.6, y: 0.56, z: 8.3, w: 0.3, d: 0.3, h: 0.05 });
  }

  return group;
}
