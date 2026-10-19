// ---------------------------------------------------------------------------
// weather.js — 粒子雨雪、3D 积雪、闪电、雨滴涟漪、屋檐滴水
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L, inBlock } from './layout.js';
import { canvasTexture, clamp, fbm2, rand, smoothstep } from './util.js';

const GROUND_DROP = 0.0;

function groundY(x, z) {
  if (inBlock(x, z)) return 0.012;
  if (x >= L.farEast.x0 || z >= L.farSouth.z0) return 0.012;
  return L.roadY + 0.014;
}

// ------------------------------------------------------------------ shaders
const RAIN_VERT = [
  'uniform float uTime;',
  'uniform float uHeight;',
  'uniform float uWind;',
  'uniform float uSpeed;',
  'uniform float uLen;',
  'uniform float uWidth;',
  'uniform vec3 uCenter;',
  'uniform vec3 uStoreMin;',
  'uniform vec3 uStoreMax;',
  'attribute vec3 iPos;',
  'attribute vec4 iData;',
  'varying vec2 vUv;',
  'varying float vFade;',
  'void main() {',
  '  vUv = uv;',
  '  float speed = uSpeed * (0.62 + iData.x * 0.75);',
  '  float y = mod(iPos.y - uTime * speed, uHeight);',
  '  float wind = uWind * (0.7 + iData.z * 0.6);',
  '  vec3 base = vec3(iPos.x + wind * (uHeight - y) * 0.05, y, iPos.z + wind * (uHeight - y) * 0.012) + uCenter;',
  '  vec3 dir = normalize(vec3(wind * 0.18, -1.0, wind * 0.05));',
  '  vec3 toCam = normalize(cameraPosition - base);',
  '  vec3 right = normalize(cross(dir, toCam));',
  '  float len = (0.42 + iData.y * 0.62) * uLen;',
  '  float wid = (0.016 + iData.w * 0.016) * uWidth;',
  '  vec3 p = base + right * (uv.x - 0.5) * wid - dir * (uv.y - 0.5) * len;',
  '  float inside = step(uStoreMin.x, base.x) * step(base.x, uStoreMax.x) * step(uStoreMin.z, base.z) * step(base.z, uStoreMax.z) * step(base.y, uStoreMax.y);',
  '  vFade = smoothstep(0.0, 0.05, y / uHeight) * (1.0 - smoothstep(0.93, 1.0, y / uHeight)) * (1.0 - inside);',
  '  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);',
  '}',
].join('\n');

const RAIN_FRAG = [
  'uniform vec3 uColor;',
  'uniform float uOpacity;',
  'varying vec2 vUv;',
  'varying float vFade;',
  'void main() {',
  '  float across = smoothstep(0.0, 0.34, vUv.x) * (1.0 - smoothstep(0.66, 1.0, vUv.x));',
  '  float along = smoothstep(0.0, 0.10, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));',
  '  float a = across * along * uOpacity * vFade;',
  '  if (a < 0.003) discard;',
  '  gl_FragColor = vec4(uColor, a);',
  '}',
].join('\n');

const SNOW_VERT = [
  'uniform float uTime;',
  'uniform float uHeight;',
  'uniform float uWind;',
  'uniform float uSpeed;',
  'uniform float uSize;',
  'uniform vec3 uCenter;',
  'uniform vec3 uStoreMin;',
  'uniform vec3 uStoreMax;',
  'attribute vec3 iPos;',
  'attribute vec4 iData;',
  'varying vec2 vUv;',
  'varying float vFade;',
  'void main() {',
  '  vUv = uv;',
  '  float speed = uSpeed * (0.55 + iData.x);',
  '  float y = mod(iPos.y - uTime * speed, uHeight);',
  '  float sway = sin(uTime * 0.72 + iData.w * 6.283 + y * 0.16) * 0.55;',
  '  float sway2 = cos(uTime * 0.51 + iData.w * 5.1) * 0.35;',
  '  vec3 base = vec3(',
  '    iPos.x + sway + uWind * (uHeight - y) * 0.04,',
  '    y,',
  '    iPos.z + sway2 + uWind * (uHeight - y) * 0.015',
  '  ) + uCenter;',
  '  vec3 toCam = normalize(cameraPosition - base);',
  '  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));',
  '  vec3 up = cross(toCam, right);',
  '  float size = (0.028 + iData.y * 0.055) * uSize;',
  '  vec3 p = base + right * position.x * size + up * position.y * size;',
  '  float inside = step(uStoreMin.x, base.x) * step(base.x, uStoreMax.x) * step(uStoreMin.z, base.z) * step(base.z, uStoreMax.z) * step(base.y, uStoreMax.y);',
  '  vFade = (1.0 - inside) * smoothstep(0.0, 0.3, y) * (1.0 - smoothstep(0.8, 1.0, y / uHeight));',
  '  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);',
  '}',
].join('\n');

const SNOW_FRAG = [
  'uniform vec3 uColor;',
  'uniform float uOpacity;',
  'varying vec2 vUv;',
  'varying float vFade;',
  'void main() {',
  '  float d = length(vUv - 0.5) * 2.0;',
  '  float a = (1.0 - smoothstep(0.18, 1.0, d)) * uOpacity * vFade;',
  '  if (a < 0.004) discard;',
  '  gl_FragColor = vec4(uColor, a);',
  '}',
].join('\n');

const RIPPLE_VERT = [
  'uniform float uTime;',
  'attribute vec3 iPos;',
  'attribute vec4 iData;',
  'varying float vA;',
  'void main() {',
  '  float t = fract(uTime * iData.x + iData.y);',
  '  float r = mix(0.02, iData.z, t);',
  '  vec3 p = position;',
  '  p.xz *= r;',
  '  p += iPos;',
  '  vA = (1.0 - t) * smoothstep(0.0, 0.12, t);',
  '  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);',
  '}',
].join('\n');

const RIPPLE_FRAG = [
  'uniform vec3 uColor;',
  'uniform float uOpacity;',
  'varying float vA;',
  'void main() {',
  '  float a = vA * uOpacity;',
  '  if (a < 0.003) discard;',
  '  gl_FragColor = vec4(uColor, a);',
  '}',
].join('\n');

// ------------------------------------------------------------------ helpers
function makeParticleMesh(count, geometryCount, vert, frag, uniforms) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  geo.instanceCount = count;

  const pos = new Float32Array(count * 3);
  const data = new Float32Array(count * 4);
  const R = 34, H = 26;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(-R, R);
    pos[i * 3 + 1] = rand(0, H);
    pos[i * 3 + 2] = rand(-R, R);
    data[i * 4] = Math.random();
    data[i * 4 + 1] = Math.random();
    data[i * 4 + 2] = Math.random();
    data[i * 4 + 3] = Math.random();
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  return mesh;
}

export class WeatherSystem {
  constructor(ctx, quality) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    this.group.name = 'weather';
    ctx.scene.add(this.group);

    this.quality = quality;
    this.flash = 0;
    this.strikeTimer = 0;
    this.nextStrike = rand(6, 12);
    this.lightningEnabled = false;
    this.thunderEnabled = false;
    this.audioCtx = null;
    this.snowUniform = ctx.snowUniform;
    this.snowCaps = [];
    this.lastCapAmount = -1;
    this.time = 0;

    const storeMin = new THREE.Vector3(L.store.x0 - 0.4, 0, L.store.z0 - 0.4);
    const storeMax = new THREE.Vector3(L.store.x1 + 0.4, L.store.wallH + 0.2, L.store.z1 + 0.4);

    this.rainUniforms = {
      uTime: { value: 0 },
      uHeight: { value: 26 },
      uWind: { value: 0.5 },
      uSpeed: { value: 24 },
      uLen: { value: 1.0 },
      uWidth: { value: 1.0 },
      uOpacity: { value: 0.0 },
      uColor: { value: new THREE.Color(0xc8dcff) },
      uCenter: { value: new THREE.Vector3(0, 0, 0) },
      uStoreMin: { value: storeMin },
      uStoreMax: { value: storeMax },
    };
    this.rain = makeParticleMesh(quality.rainCount, 0, RAIN_VERT, RAIN_FRAG, this.rainUniforms);
    this.rainCount = quality.rainCount;
    this.rain.geometry.instanceCount = 0;
    this.group.add(this.rain);

    this.snowUniforms = {
      uTime: { value: 0 },
      uHeight: { value: 20 },
      uWind: { value: 0.4 },
      uSpeed: { value: 1.0 },
      uSize: { value: 1.0 },
      uOpacity: { value: 0.0 },
      uColor: { value: new THREE.Color(0xffffff) },
      uCenter: { value: new THREE.Vector3(0, 0, 0) },
      uStoreMin: { value: storeMin },
      uStoreMax: { value: storeMax },
    };
    this.snow = makeParticleMesh(quality.snowCount, 0, SNOW_VERT, SNOW_FRAG, this.snowUniforms);
    this.snowCount = quality.snowCount;
    this.snow.geometry.instanceCount = 0;
    this.group.add(this.snow);

    // 涟漪
    const rippleCount = quality.rippleCount || 240;
    const ringBase = new THREE.RingGeometry(0.88, 1.0, 20, 1);
    ringBase.rotateX(-Math.PI / 2);
    const ringGeo = new THREE.InstancedBufferGeometry();
    ringGeo.index = ringBase.index;
    ringGeo.setAttribute('position', ringBase.attributes.position);
    ringGeo.instanceCount = rippleCount;
    const rpos = new Float32Array(rippleCount * 3);
    const rdata = new Float32Array(rippleCount * 4);
    for (let i = 0; i < rippleCount; i++) {
      let x = 0, z = 0;
      for (let k = 0; k < 8; k++) {
        x = rand(-20, 20);
        z = rand(-16, 20);
        if (!(x > L.store.x0 - 1 && x < L.store.x1 + 1 && z > L.store.z0 - 1 && z < L.store.z1 + 1)) break;
      }
      rpos[i * 3] = x;
      rpos[i * 3 + 1] = groundY(x, z);
      rpos[i * 3 + 2] = z;
      rdata[i * 4] = rand(0.6, 1.5);
      rdata[i * 4 + 1] = Math.random();
      rdata[i * 4 + 2] = rand(0.2, 0.45);
      rdata[i * 4 + 3] = Math.random();
    }
    ringGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(rpos, 3));
    ringGeo.setAttribute('iData', new THREE.InstancedBufferAttribute(rdata, 4));
    this.rippleUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0xd6e6ff) },
    };
    const rippleMat = new THREE.ShaderMaterial({
      vertexShader: RIPPLE_VERT,
      fragmentShader: RIPPLE_FRAG,
      uniforms: this.rippleUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      fog: false,
    });
    this.ripples = new THREE.Mesh(ringGeo, rippleMat);
    this.ripples.frustumCulled = false;
    this.ripples.renderOrder = 4;
    this.group.add(this.ripples);

    this.buildSnowLayers();
    this.buildBolts();
    this.buildDrips();
  }

  // ---------------------------------------------------------------- 积雪
  snowPatchMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.78, metalness: 0.0, vertexColors: true,
    });
    const snowUniform = this.snowUniform;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSnow = snowUniform;
      shader.vertexShader = 'uniform float uSnow;\nattribute float aHeight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  transformed.y += (aHeight + 0.1) * uSnow - 0.1;'
      );
    };
    mat.customProgramCacheKey = () => 'snow-patch';
    return mat;
  }

  snowPatch(x0, x1, z0, z1, y, segX, segZ, heightFn) {
    const w = x1 - x0, d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const pos = geo.attributes.position;
    const heights = new Float32Array(pos.count);
    const colors = new Float32Array(pos.count * 3);
    const cold = new THREE.Color(0xb9cade);
    const warm = new THREE.Color(0xe9f2fb);
    const tmp = new THREE.Color();
    let maxH = 0.001;
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, heightFn(pos.getX(i), pos.getZ(i)));
      heights[i] = h;
      if (h > maxH) maxH = h;
    }
    for (let i = 0; i < pos.count; i++) {
      const k = clamp(heights[i] / maxH, 0, 1);
      tmp.copy(cold).lerp(warm, 0.35 + 0.65 * k);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.snowPatchMaterial());
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.group.add(mesh);
    return mesh;
  }

  buildSnowLayers() {
    const S = L.store;
    const self = this;

    // 街区人行道
    this.snowPatch(L.block.x0 + 0.05, L.block.x1 - 0.05, L.block.z0 + 0.05, L.block.z1 - 0.05, -0.016, 84, 82, (x, z) => {
      if (x > S.x0 - 0.25 && x < S.x1 + 0.25 && z > S.z0 - 0.25 && z < S.z1 + 0.25) return 0;
      const e = Math.min(x - L.block.x0, L.block.x1 - x, z - L.block.z0, L.block.z1 - z);
      const edge = smoothstep(0.0, 0.7, e);
      const n = fbm2(x * 0.55, z * 0.55, 4);
      const wall = Math.max(0,
        Math.max(1 - Math.abs(x - S.x0) / 1.8, 1 - Math.abs(x - S.x1) / 1.8) *
        smoothstep(S.z0 - 1, S.z0 + 1, z) * smoothstep(S.z1 + 1, S.z1 - 1, z)
      );
      return edge * (0.045 + 0.07 * n) * (0.8 + 0.55 * wall);
    });

    // 对街人行道
    this.snowPatch(L.farEast.x0 + 0.05, 25.95, -25.95, L.southRoad.z0 - 0.05, -0.016, 22, 120, (x, z) => {
      const e = Math.min(x - L.farEast.x0, 26 - x, z + 26, L.southRoad.z0 - z);
      return smoothstep(0.0, 0.6, e) * (0.07 + 0.07 * fbm2(x * 0.5, z * 0.5, 3));
    });
    this.snowPatch(-25.95, L.farEast.x0 - 0.05, L.farSouth.z0 + 0.05, 25.95, -0.016, 120, 22, (x, z) => {
      const e = Math.min(x + 26, L.farEast.x0 - x, z - L.farSouth.z0, 26 - z);
      return smoothstep(0.0, 0.6, e) * (0.07 + 0.07 * fbm2(x * 0.5, z * 0.5, 3));
    });

    // 道路积雪（路缘更厚，车道中央薄）
    const roadH = (x, z) => {
      if (inBlock(x, z)) return 0;
      if (x > L.farEast.x0 || z > L.farSouth.z0) return 0;
      const dCurb = Math.min(
        Math.abs(x - L.eastRoad.x0), Math.abs(x - L.eastRoad.x1),
        Math.abs(z - L.southRoad.z0), Math.abs(z - L.southRoad.z1),
      );
      const curb = 1 - smoothstep(0.0, 2.6, dCurb);
      const laneClear = smoothstep(2.0, 4.2, dCurb);
      const n = fbm2(x * 0.42, z * 0.42, 4);
      return (0.004 + 0.062 * curb) * (0.5 + 0.85 * n) * (1.0 - laneClear * 0.94);
    };
    this.snowPatch(-25.95, 25.95, -25.95, 25.95, L.roadY - 0.016, 150, 150, roadH);

    // 屋顶
    this.snowPatch(S.x0 - 0.12, S.x1 + 0.12, S.z0 - 0.12, S.z1 + 0.12, 3.815, 46, 46, (x, z) => {
      const e = Math.min(x - (S.x0 - 0.12), (S.x1 + 0.12) - x, z - (S.z0 - 0.12), (S.z1 + 0.12) - z);
      const edge = smoothstep(0.0, 0.45, e);
      const n = fbm2(x * 0.7 + 3.3, z * 0.7, 4);
      // 空调设备周围少一些（避免穿模）
      let clear = 1;
      for (const p of [[-5.3, 2.1, 1.7], [0.7, -3.3, 1.4], [-2.0, 4.5, 1.0]]) {
        const d = Math.hypot(x - p[0], z - p[1]);
        clear = Math.min(clear, smoothstep(p[2] * 0.45, p[2] * 0.62, d));
      }
      return edge * clear * (0.07 + 0.09 * n);
    });

    // 物件积雪（实例化）
    const surfaces = this.ctx.snowSurfaces || [];
    this.capData = surfaces.slice();
    const capGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe9f1fa, roughness: 0.85, metalness: 0 });
    this.capMesh = new THREE.InstancedMesh(capGeo, capMat, Math.max(1, this.capData.length));
    this.capMesh.castShadow = false;
    this.capMesh.receiveShadow = true;
    this.capMesh.frustumCulled = false;
    this.capMesh.visible = false;
    this.group.add(this.capMesh);

    // 树枝积雪
    const pts = this.ctx.snowPoints || [];
    this.branchData = pts;
    const branchGeo = new THREE.SphereGeometry(0.5, 8, 5);
    const branchMat = new THREE.MeshStandardMaterial({ color: 0xeef5fc, roughness: 0.85, metalness: 0 });
    this.branchMesh = new THREE.InstancedMesh(branchGeo, branchMat, Math.max(1, pts.length));
    this.branchMesh.frustumCulled = false;
    this.branchMesh.visible = false;
    this.group.add(this.branchMesh);

    this.updateSnowLayerGeometry = () => {};
  }

  updateSnowCaps(amount) {
    if (Math.abs(amount - this.lastCapAmount) < 0.004) return;
    this.lastCapAmount = amount;

    const visible = amount > 0.015;
    this.capMesh.visible = amount > 0.09;
    this.branchMesh.visible = amount > 0.1;

    if (visible) {
      const d = new THREE.Object3D();
      this.capData.forEach((s, i) => {
        const rotY = s.rotY || 0;
        const h = Math.max(0.02, (s.h || 0.08) * amount);
        const shrink = 0.55 + 0.45 * amount;
        d.position.set(s.x, s.y + h * 0.42, s.z);
        d.rotation.set(0, rotY, 0);
        d.scale.set(Math.max(0.02, s.w * 0.98 * shrink), h, Math.max(0.02, s.d * 0.98 * shrink));
        d.updateMatrix();
        this.capMesh.setMatrixAt(i, d.matrix);
      });
      this.capMesh.count = this.capData.length;
      this.capMesh.instanceMatrix.needsUpdate = true;
    }

    if (amount > 0.1) {
      const d = new THREE.Object3D();
      this.branchData.forEach((p, i) => {
        const r = Math.max(0.015, p.r * 2.6 * amount);
        d.position.set(p.x, p.y + r * 0.25, p.z);
        d.rotation.set(0, 0, 0);
        d.scale.set(r, r * 0.75, r);
        d.updateMatrix();
        this.branchMesh.setMatrixAt(i, d.matrix);
      });
      this.branchMesh.count = this.branchData.length;
      this.branchMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- 闪电
  buildBolts() {
    this.bolts = [];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry();
      const segs = 34;
      const positions = new Float32Array(segs * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xe8f0ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      this.group.add(line);
      this.bolts.push({ line, mat, geo, segs });
    }
  }

  regenerateBolt(bolt) {
    const segs = bolt.segs;
    const arr = bolt.geo.attributes.position.array;
    const x0 = rand(-14, 14), z0 = rand(-6, 6);
    let x = 0, z = 0, y = 62;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      y = 62 * (1 - t);
      x += rand(-2.6, 2.6) * (1 - t * 0.45);
      z += rand(-1.8, 1.8) * (1 - t * 0.5);
      if (i === 0) { x = 0; z = 0; }
      arr[i * 3] = x0 + x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z0 + z;
    }
    // 末端贴地
    arr[(segs - 1) * 3 + 1] = 0.5;
    bolt.geo.attributes.position.needsUpdate = true;
    bolt.geo.computeBoundingSphere();
  }

  strike() {
    this.strikeTimer = 0.55;
    const bolt = this.bolts[Math.floor(Math.random() * this.bolts.length)];
    this.regenerateBolt(bolt);
    const angle = Math.random() * Math.PI * 2;
    const dist = rand(85, 135);
    bolt.line.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    bolt.line.rotation.y = -angle + Math.PI / 2;
    bolt.line.visible = true;
    this.activeBolt = bolt;
    if (this.thunderEnabled) this.playThunder(rand(0.4, 2.2));
  }

  setLightningEnabled(v) { this.lightningEnabled = v; }

  // ---------------------------------------------------------------- 雨檐滴水
  buildDrips() {
    const dripTex = canvasTexture(256, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * w;
        const len = rand(8, 46);
        const y = Math.random() * h;
        const grad = c.createLinearGradient(0, y, 0, y + len);
        grad.addColorStop(0, 'rgba(210,230,255,0)');
        grad.addColorStop(0.25, 'rgba(210,230,255,0.55)');
        grad.addColorStop(1, 'rgba(210,230,255,0)');
        c.strokeStyle = grad;
        c.lineWidth = rand(0.8, 2.2);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + len); c.stroke();
      }
    }, { wrap: true });
    dripTex.wrapS = dripTex.wrapT = THREE.RepeatWrapping;
    const dripMat = new THREE.MeshBasicMaterial({
      map: dripTex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: 0xbfd4ee,
    });
    this.dripMats = [];
    const S = L.store;
    const dripS = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 1.1), dripMat);
    dripS.position.set((S.x0 + S.x1) / 2, 2.45, S.z1 + 1.3);
    dripS.renderOrder = 5;
    this.group.add(dripS);
    this.dripMats.push(dripMat);

    const dripMat2 = dripMat.clone();
    dripMat2.map = dripTex.clone();
    dripMat2.map.needsUpdate = true;
    const dripE = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 1.1), dripMat2);
    dripE.position.set(S.x1 + 1.3, 2.45, (S.z0 + S.z1) / 2);
    dripE.rotation.y = Math.PI / 2;
    dripE.renderOrder = 5;
    this.group.add(dripE);
    this.dripMats.push(dripMat2);
    this.dripTex = dripTex;
    this.dripTex2 = dripMat2.map;
  }

  // ---------------------------------------------------------------- 声音
  playThunder(delay) {
    if (!this.audioCtx) return;
    const ac = this.audioCtx;
    const start = ac.currentTime + delay;
    const dur = 3.0;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const data = buffer.getChannelData(0);
    let lp = 0, lp2 = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const white = Math.random() * 2 - 1;
      lp = lp * 0.985 + white * 0.015;
      lp2 = lp2 * 0.96 + lp * 0.04;
      const env = Math.min(1, t * 14) * Math.exp(-t * 2.6);
      const crack = i < ac.sampleRate * 0.08 ? (Math.random() * 2 - 1) * (1 - i / (ac.sampleRate * 0.08)) * 0.55 : 0;
      data[i] = (lp2 * 7.5 + lp * 1.6 + crack) * env;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ac.createGain();
    gain.gain.value = 0.75;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(start);
  }

  setThunderEnabled(v) {
    this.thunderEnabled = v;
    if (v && !this.audioCtx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AC();
      } catch (e) {
        this.audioCtx = null;
      }
    }
    if (v && this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  // ---------------------------------------------------------------- 主更新
  update(dt, time, env) {
    this.time = time;
    const rain = env.rain;
    const snow = env.snow;
    const wind = env.wind;

    // 雨
    this.rainUniforms.uTime.value = time;
    this.rainUniforms.uWind.value = wind * 1.0;
    this.rainUniforms.uSpeed.value = 22 + rain * 9;
    this.rainUniforms.uLen.value = 0.85 + rain * 0.5;
    this.rainUniforms.uWidth.value = 1.0 + rain * 0.35;
    this.rainUniforms.uOpacity.value = clamp(rain * 1.05, 0, 0.95);
    const rainActive = rain > 0.02;
    this.rain.visible = rainActive;
    if (rainActive) {
      this.rain.geometry.instanceCount = Math.max(1, Math.floor(this.rainCount * clamp(rain / 1.9, 0, 1)));
      this.rainUniforms.uCenter.value.y = 0;
    }

    // 雪
    this.snowUniforms.uTime.value = time;
    this.snowUniforms.uWind.value = wind * 1.0;
    this.snowUniforms.uSpeed.value = 0.85 + wind * 0.5;
    this.snowUniforms.uOpacity.value = clamp(snow * 0.85, 0, 0.9);
    const snowActive = snow > 0.02;
    this.snow.visible = snowActive;
    if (snowActive) {
      this.snow.geometry.instanceCount = Math.max(1, Math.floor(this.snowCount * clamp(snow, 0, 1)));
    }

    this.rippleUniforms.uTime.value = time;
    this.rippleUniforms.uOpacity.value = clamp(rain * 0.5, 0, 1) * (0.25 + env.nightFactor * 0.4);
    this.ripples.visible = rain > 0.05;

    // 积雪
    this.snowUniform.value = snow;
    this.updateSnowCaps(snow);

    // 雨滴涟漪
    this.updateDrips(rain, time);

    // 雷雨
    this.setLightningEnabled(env.lightning);
    this.updateLightning(dt, env);

    // 花瓣强度交给 sakura（通过 env）
  }

  updateDrips(rain, time) {
    const a = clamp(rain * 0.9, 0, 1);
    this.dripMats.forEach((m, i) => {
      m.opacity = a * 0.55;
      if (m.map) {
        m.map.offset.y = -time * (0.55 + i * 0.15);
        m.map.offset.x = Math.sin(time * 0.3 + i) * 0.02;
      }
    });
  }

  updateLightning(dt, env) {
    if (this.lightningEnabled) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.strike();
        this.nextStrike = rand(5.5, 13.5);
        if (Math.random() > 0.65) {
          setTimeout(() => { if (this.lightningEnabled) this.strike(); }, rand(120, 320));
        }
      }
    }

    this.flash = Math.max(this.flash * Math.exp(-dt * 6.5), 0);
    if (this.strikeTimer > 0) {
      this.strikeTimer = Math.max(0, this.strikeTimer - dt);
      const k = this.strikeTimer / 0.55;
      const flicker = 0.55 + 0.45 * Math.abs(Math.sin(this.strikeTimer * 46.0));
      this.flash = Math.max(this.flash, k * flicker);
      this.boltOpacity = Math.max(this.boltOpacity || 0, k * 1.4);
    } else if (this.activeBolt) {
      this.activeBolt = null;
      this.boltOpacity = 0;
    }

    this.bolts.forEach((b) => {
      if (b.line === this.activeBolt) {
        b.mat.opacity = clamp(this.boltOpacity || 0, 0, 1);
      } else {
        b.mat.opacity = 0;
        if (b.line.visible && this.strikeTimer <= 0) b.line.visible = false;
      }
    });
  }

  dispose() {
    if (this.audioCtx) this.audioCtx.close();
  }
}
