// ---------------------------------------------------------------------------
// rain.js — GPU-instanced downpour, ground ripples and eave drips
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { groundHeightAt } from './street.js';
import { mulberry32 } from './toon.js';

const COUNT = 2800;
const RIPPLE_COUNT = 190;
const HEIGHT = 17;

export function createRain(scene) {
  const group = new THREE.Group();
  group.name = 'rain';
  scene.add(group);
  const rnd = mulberry32(31337);

  /* ------------------------------------------------------------------ rain */
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.instanceCount = COUNT;

  const offsets = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  const lengths = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    offsets[i * 3] = (rnd() - 0.5) * 27;
    offsets[i * 3 + 1] = rnd() * HEIGHT;
    offsets[i * 3 + 2] = (rnd() - 0.5) * 27;
    speeds[i] = 5.4 + rnd() * 3.6;
    lengths[i] = 0.28 + rnd() * 0.46;
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
  geo.setAttribute('aLen', new THREE.InstancedBufferAttribute(lengths, 1));

  const rainMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: HEIGHT },
      uColor: { value: new THREE.Color(0xa9cdf2) },
      uOpacity: { value: 0.27 },
    },
    vertexShader: /* glsl */`
      attribute vec3 aOffset;
      attribute float aSpeed;
      attribute float aLen;
      uniform float uTime;
      uniform float uHeight;
      varying float vAlpha;
      void main() {
        float fall = mod( aOffset.y - uTime * aSpeed, uHeight );
        vec3 world = vec3( aOffset.x + fall * 0.055, fall, aOffset.z );
        vec4 mv = modelViewMatrix * vec4( world, 1.0 );
        float width = 0.028;
        mv.x += position.x * width;
        mv.y += position.y * aLen + aLen * 0.5;
        mv.x += position.y * aLen * 0.13;
        gl_Position = projectionMatrix * mv;
        vAlpha = smoothstep( 0.0, 1.4, fall ) * ( 1.0 - smoothstep( uHeight - 4.0, uHeight, fall ) );
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        float a = vAlpha * uOpacity;
        if ( a < 0.002 ) discard;
        gl_FragColor = vec4( uColor, a );
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  });
  const rain = new THREE.Mesh(geo, rainMat);
  rain.frustumCulled = false;
  rain.renderOrder = 9;
  group.add(rain);

  /* --------------------------------------------------------------- ripples */
  const ringBase = new THREE.RingGeometry(0.86, 1.0, 22);
  ringBase.rotateX(-Math.PI / 2);
  const rgeo = new THREE.InstancedBufferGeometry();
  rgeo.index = ringBase.index;
  rgeo.setAttribute('position', ringBase.getAttribute('position'));
  rgeo.instanceCount = RIPPLE_COUNT;

  const rpos = new Float32Array(RIPPLE_COUNT * 3);
  const rseed = new Float32Array(RIPPLE_COUNT);
  const rsize = new Float32Array(RIPPLE_COUNT);

  const puddleSpots = [
    [-2.3, 3.35, 1.6], [2.7, 3.95, 1.2], [5.2, 0.6, 1.1], [-7.4, 3.5, 1.3],
    [8.6, 7.5, 1.9], [-4.2, 8.3, 1.5], [11.1, -1.4, 1.0], [-8.4, -1.9, 1.2], [1.4, 8.9, 1.3],
  ];
  let placed = 0;
  for (const spot of puddleSpots) {
    for (let k = 0; k < 5 && placed < RIPPLE_COUNT; k++) {
      const x = spot[0] + (rnd() - 0.5) * spot[2] * 1.1;
      const z = spot[1] + (rnd() - 0.5) * spot[2] * 0.8;
      const y = groundHeightAt(x, z) + 0.009;
      rpos[placed * 3] = x;
      rpos[placed * 3 + 1] = y;
      rpos[placed * 3 + 2] = z;
      rseed[placed] = rnd();
      rsize[placed] = 1.1 + rnd() * 0.9;
      placed++;
    }
  }
  while (placed < RIPPLE_COUNT) {
    const x = -11.4 + rnd() * 22.8;
    const z = -11.4 + rnd() * 22.8;
    if (x > -6.2 && x < 4.2 && z > -7.4 && z < 2.2) continue; // shop floor is dry-ish
    const y = groundHeightAt(x, z) + 0.008;
    rpos[placed * 3] = x;
    rpos[placed * 3 + 1] = y;
    rpos[placed * 3 + 2] = z;
    rseed[placed] = rnd();
    rsize[placed] = 0.45 + rnd() * 1.35;
    placed++;
  }
  rgeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(rpos, 3));
  rgeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(rseed, 1));
  rgeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(rsize, 1));

  const rippleMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x9fc6ea) },
      uOpacity: { value: 0.42 },
    },
    vertexShader: /* glsl */`
      attribute vec3 aPos;
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float phase = fract( uTime * 0.42 + aSeed );
        float r = ( 0.04 + phase * 0.30 ) * aSize;
        vec3 p = aPos + vec3( position.x * r, 0.0, position.z * r );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
        vAlpha = ( 1.0 - phase ) * ( 1.0 - phase ) * smoothstep( 0.0, 0.05, phase );
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        if ( vAlpha < 0.01 ) discard;
        gl_FragColor = vec4( uColor, vAlpha * 0.42 );
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  });
  const ripples = new THREE.Mesh(rgeo, rippleMat);
  ripples.frustumCulled = false;
  ripples.renderOrder = 3;
  group.add(ripples);

  /* ------------------------------------------------------------ eave drips */
  const emitters = [];
  // awning front edge
  for (let x = -3.3; x <= 1.4; x += 1.15) emitters.push([x, 3.2, 3.42, 0.16]);
  // roof front edge
  for (let x = -5.8; x <= 3.9; x += 1.7) emitters.push([x, 4.76, 2.06, 0.16]);
  // roof side edge
  for (let z = -6.7; z <= 1.7; z += 1.55) emitters.push([4.07, 4.76, z, 0.16]);
  // vending machine awning-ish drip
  emitters.push([-10.9, 2.06, 3.35, 0.16]);

  const dropsPer = 2;
  const dropCount = emitters.length * dropsPer;
  const dropGeo = new THREE.SphereGeometry(0.024, 6, 4);
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.6 });
  const dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, dropCount);
  dropMesh.frustumCulled = false;
  dropMesh.renderOrder = 8;
  group.add(dropMesh);
  const dummy = new THREE.Object3D();
  const drops = [];
  for (let i = 0; i < dropCount; i++) {
    const e = emitters[i % emitters.length];
    drops.push({
      x: e[0], y0: e[1], z: e[2], gy: e[3],
      t: -rnd() * 3.2,
      speed: 9.8,
    });
  }

  const splashGeo = new THREE.RingGeometry(0.45, 0.6, 14);
  splashGeo.rotateX(-Math.PI / 2);
  const splashes = [];
  for (let i = 0; i < 20; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: 0xaad2f0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(splashGeo, m);
    mesh.visible = false;
    mesh.renderOrder = 4;
    group.add(mesh);
    splashes.push({ mesh, life: 1, active: false });
  }
  let splashCursor = 0;

  function update(time, dt) {
    rainMat.uniforms.uTime.value = time;
    rippleMat.uniforms.uTime.value = time;

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.t += dt;
      let show = true;
      if (d.t < 0) {
        show = false;
      } else {
        const y = d.y0 - 0.5 * d.speed * d.t * d.t;
        if (y <= d.gy) {
          // splash
          const s = splashes[splashCursor % splashes.length];
          splashCursor++;
          s.mesh.position.set(d.x, d.gy + 0.004, d.z);
          s.mesh.scale.setScalar(0.12);
          s.mesh.material.opacity = 0.5;
          s.mesh.visible = true;
          s.life = 0;
          s.active = true;
          d.t = -0.35 - rnd() * 2.6;
          show = false;
        } else {
          dummy.position.set(d.x, y, d.z);
          dummy.scale.set(1, 2.4, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          dropMesh.setMatrixAt(i, dummy.matrix);
        }
      }
      if (!show) {
        dummy.position.set(d.x, d.y0, d.z);
        dummy.scale.set(0.001, 0.001, 0.001);
        dummy.updateMatrix();
        dropMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    dropMesh.instanceMatrix.needsUpdate = true;

    for (const s of splashes) {
      if (!s.active) continue;
      s.life += dt;
      const k = s.life / 0.55;
      if (k >= 1) {
        s.active = false;
        s.mesh.visible = false;
        s.mesh.material.opacity = 0;
      } else {
        s.mesh.scale.setScalar(0.12 + k * 0.9);
        s.mesh.material.opacity = 0.42 * (1 - k) * (1 - k);
      }
    }
  }

  function setAmount(v) {
    const a = Math.max(0, Math.min(1, v));
    rainMat.uniforms.uOpacity.value = 0.27 * a;
    rippleMat.uniforms.uOpacity.value = 0.42 * a;
    dropMesh.visible = a > 0.02;
    group.visible = a > 0.005;
    if (a < 0.02) {
      for (const s of splashes) {
        if (s.active) {
          s.active = false;
          s.mesh.visible = false;
          s.mesh.material.opacity = 0;
        }
      }
    }
  }
  setAmount(1);

  return { group, update, setAmount };
}