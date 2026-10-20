// ---------------------------------------------------------------------------
// sky.js — gradient sky dome, sun/moon glow, and small point stars
//          colours are lerped so day / dusk / night changes are smooth
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { canvasTexture, damp, mulberry32 } from './toon.js';

function starDotTexture() {
  return canvasTexture(32, 32, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function makeStarLayer(count, size, seed) {
  const rnd = mulberry32(seed);
  const tex = starDotTexture();
  const radius = 92;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const palette = [
    new THREE.Color(0xdfe9ff),
    new THREE.Color(0xffffff),
    new THREE.Color(0xcfe0ff),
    new THREE.Color(0xffd7e6),
  ];
  for (let i = 0; i < count; i++) {
    const y = 0.05 + rnd() * 0.95;
    const phi = rnd() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    pos[i * 3] = Math.cos(phi) * r * radius;
    pos[i * 3 + 1] = y * radius;
    pos[i * 3 + 2] = Math.sin(phi) * r * radius;
    const c = palette[Math.floor(rnd() * palette.length)];
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size,
    sizeAttenuation: false,
    map: tex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    alphaTest: 0.01,
    toneMapped: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -19;
  points.visible = false;
  return { points, mat };
}

export function createSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color(0x04060e) },
    uHorizon: { value: new THREE.Color(0x0d1930) },
    uBottom: { value: new THREE.Color(0x05070d) },
    uGlowColor: { value: new THREE.Color(0x6f8fc8) },
    uGlow: { value: 0.24 },
    uSunDir: { value: new THREE.Vector3(-0.4, 0.35, -0.85).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uGlowColor;
      uniform float uGlow;
      uniform vec3 uSunDir;
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize( vWorldPosition );
        float h = clamp( dir.y * 0.5 + 0.5, 0.0, 1.0 );
        vec3 col = mix( uBottom, uHorizon, smoothstep( 0.0, 0.48, h ) );
        col = mix( col, uTop, smoothstep( 0.42, 1.0, h ) );
        float sun = max( dot( dir, normalize( uSunDir ) ), 0.0 );
        col += uGlowColor * pow( sun, 24.0 ) * uGlow;
        col += uGlowColor * 0.05 * uGlow * ( 1.0 - smoothstep( 0.0, 0.32, abs( dir.y ) ) );
        gl_FragColor = vec4( col, 1.0 );
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(105, 40, 24), mat);
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.renderOrder = -20;
  scene.add(dome);

  const stars = new THREE.Group();
  stars.name = 'stars';
  stars.visible = false;
  scene.add(stars);
  const layers = [makeStarLayer(680, 2.0, 90210), makeStarLayer(110, 3.6, 73421)];
  for (const layer of layers) stars.add(layer.points);

  const target = {
    top: new THREE.Color(0x04060e),
    horizon: new THREE.Color(0x0d1930),
    bottom: new THREE.Color(0x05070d),
    glow: new THREE.Color(0x6f8fc8),
    glowStrength: 0.24,
    stars: 0,
    sunDir: new THREE.Vector3(-0.4, 0.35, -0.85).normalize(),
  };

  function setTargets(t) {
    target.top.set(t.top);
    target.horizon.set(t.horizon);
    target.bottom.set(t.bottom);
    target.glow.set(t.glow);
    target.glowStrength = t.glowStrength;
    target.stars = t.stars;
    target.sunDir.set(t.sunDir[0], t.sunDir[1], t.sunDir[2]).normalize();
  }

  function update(dt) {
    const k = 1 - Math.exp(-1.8 * dt);
    uniforms.uTop.value.lerp(target.top, k);
    uniforms.uHorizon.value.lerp(target.horizon, k);
    uniforms.uBottom.value.lerp(target.bottom, k);
    uniforms.uGlowColor.value.lerp(target.glow, k);
    uniforms.uGlow.value = damp(uniforms.uGlow.value, target.glowStrength, 1.8, dt);
    uniforms.uSunDir.value.lerp(target.sunDir, k).normalize();
    let op = 0;
    for (const layer of layers) {
      layer.mat.opacity = damp(layer.mat.opacity, layer === layers[1] ? target.stars * 1.15 : target.stars, 1.6, dt);
      layer.points.visible = layer.mat.opacity > 0.012;
      op = Math.max(op, layer.mat.opacity);
    }
    stars.visible = op > 0.012;
  }

  return { dome, stars, setTargets, update };
}