// ---------------------------------------------------------------------------
// toon.js — the shared cel-shading toolkit for the konbini diorama
//   * 3-step gradient map generated at runtime (DataTexture)
//   * MeshToonMaterial factory
//   * inverted-hull outline material + helpers
//   * tiny procedural canvas texture / geometry / glow utilities
// ---------------------------------------------------------------------------
import * as THREE from 'three';

/* --------------------------------------------------------------------------
   gradient map (3 tones) — sampled on the red channel by MeshToonMaterial
   -------------------------------------------------------------------------- */
let _gradient = null;
export function gradientMap() {
  if (_gradient) return _gradient;
  const steps = new Uint8Array([58, 142, 255]);
  const tex = new THREE.DataTexture(steps, 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.name = 'toon-gradient-3step';
  _gradient = tex;
  return tex;
}

/* --------------------------------------------------------------------------
   materials
   -------------------------------------------------------------------------- */
export function toon(color, opts = {}) {
  const { map, emissive, emissiveIntensity, emissiveMap, transparent, opacity,
    side, depthWrite, alphaTest, vertexColors, flatShading, toneMapped } = opts;
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
  });
  if (map) mat.map = map;
  if (emissive !== undefined) mat.emissive = new THREE.Color(emissive);
  if (emissiveIntensity !== undefined) mat.emissiveIntensity = emissiveIntensity;
  if (emissiveMap) { mat.emissiveMap = emissiveMap; mat.emissive = new THREE.Color(0xffffff); }
  if (transparent !== undefined) mat.transparent = transparent;
  if (opacity !== undefined) mat.opacity = opacity;
  if (side !== undefined) mat.side = side;
  if (depthWrite !== undefined) mat.depthWrite = depthWrite;
  if (alphaTest !== undefined) mat.alphaTest = alphaTest;
  if (vertexColors !== undefined) mat.vertexColors = vertexColors;
  if (flatShading !== undefined) mat.flatShading = flatShading;
  if (toneMapped !== undefined) mat.toneMapped = toneMapped;
  return mat;
}

export function rimToon(color, rim = 0x8fc8ff, opts = {}) {
  const mat = toon(color, opts);
  mat.emissive = new THREE.Color(rim);
  mat.emissiveIntensity = opts.rimIntensity ?? 0.06;
  return mat;
}

/* --------------------------------------------------------------------------
   inverted-hull outlines
   -------------------------------------------------------------------------- */
const _outlineMats = new Map();
export function outlineMaterial(thickness = 0.02, color = 0x14101e) {
  const key = thickness.toFixed(4) + '|' + color;
  const cached = _outlineMats.get(key);
  if (cached) return cached;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */`
      uniform float uThickness;
      void main() {
        vec3 p = position + normalize( normal ) * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4( uColor, 1.0 );
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    fog: false,
    toneMapped: false,
  });
  _outlineMats.set(key, mat);
  return mat;
}

/** Adds a back-side shell to a mesh. Returns the shell. */
export function addOutline(mesh, thickness = 0.02, color = 0x14101e) {
  if (!mesh.geometry) return null;
  const shell = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness, color));
  shell.name = (mesh.name || 'mesh') + '-outline';
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.matrixAutoUpdate = false;
  shell.frustumCulled = false;
  shell.renderOrder = -1;
  mesh.add(shell);
  return shell;
}

/* --------------------------------------------------------------------------
   geometry cache + primitives
   -------------------------------------------------------------------------- */
const _geo = new Map();
const key3 = (a, b, c) => a.toFixed(3) + '|' + b.toFixed(3) + '|' + c.toFixed(3);

export function boxGeo(w, h, d) {
  const k = 'b' + key3(w, h, d);
  let g = _geo.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _geo.set(k, g); }
  return g;
}

export function planeGeo(w, h) {
  const k = 'p' + key3(w, h, 0);
  let g = _geo.get(k);
  if (!g) { g = new THREE.PlaneGeometry(w, h); _geo.set(k, g); }
  return g;
}

export function cylGeo(rt, rb, h, seg = 12, open = false) {
  const k = 'c' + key3(rt, rb, h) + '|' + seg + '|' + (open ? 1 : 0);
  let g = _geo.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); _geo.set(k, g); }
  return g;
}

export function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
  if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  m.castShadow = opts.cast ?? false;
  m.receiveShadow = opts.receive ?? true;
  if (opts.name) m.name = opts.name;
  parent.add(m);
  if (opts.line) addOutline(m, opts.line, opts.lineColor ?? 0x14101e);
  return m;
}

/** axis-aligned box whose BOTTOM sits at y */
export function addBox(parent, w, h, d, mat, x, y, z, opts = {}) {
  return addMesh(parent, boxGeo(w, h, d), mat, x, y + h / 2, z, opts);
}

export function addCyl(parent, rt, rb, h, seg, mat, x, y, z, opts = {}) {
  return addMesh(parent, cylGeo(rt, rb, h, seg), mat, x, y + h / 2, z, opts);
}

export function addPlane(parent, w, h, mat, x, y, z, opts = {}) {
  return addMesh(parent, planeGeo(w, h), mat, x, y, z, opts);
}

/* --------------------------------------------------------------------------
   procedural canvas textures
   -------------------------------------------------------------------------- */
export function canvasTexture(w, h, draw, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 8;
  if (opts.wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.needsUpdate = true;
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const JP_FONT = "'Yu Gothic UI','Yu Gothic','Meiryo','MS Gothic','Hiragino Kaku Gothic ProN',sans-serif";
export { JP_FONT };

export function drawText(ctx, text, x, y, size, color, opts = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  ctx.font = (opts.weight || 800) + ' ' + size + 'px ' + (opts.font || JP_FONT);
  if (opts.letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = opts.letterSpacing;
  if (opts.rotate) {
    ctx.translate(x, y);
    ctx.rotate(opts.rotate);
    ctx.fillText(text, 0, 0);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

/* --------------------------------------------------------------------------
   additive glow helpers
   -------------------------------------------------------------------------- */
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  _glowTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return _glowTex;
}

export function addGlow(parent, color, size, x, y, z, opacity = 0.55) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  s.renderOrder = 5;
  parent.add(s);
  return s;
}

/** A soft radial pool of light to lay on the ground (additive plane). */
export function addLightPool(parent, color, w, d, x, y, z, opacity = 0.3, rotY = 0) {
  const tex = canvasTexture(256, 256, (ctx, cw, ch) => {
    const g = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  });
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(planeGeo(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotY;
  mesh.position.set(x, y, z);
  mesh.renderOrder = 3;
  parent.add(mesh);
  return mesh;
}

/* --------------------------------------------------------------------------
   instancing helpers
   -------------------------------------------------------------------------- */
const _dummy = new THREE.Object3D();

/**
 * transforms: [{ p:[x,y,z], r?:[x,y,z], s?:[x,y,z] }]
 * colors: optional array of hex/int
 */
export function instancedMesh(geo, mat, transforms, opts = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
  mesh.castShadow = opts.cast ?? false;
  mesh.receiveShadow = opts.receive ?? false;
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    _dummy.position.set(t.p[0], t.p[1], t.p[2]);
    const r = t.r || [0, 0, 0];
    _dummy.rotation.set(r[0], r[1], r[2]);
    const s = t.s || [1, 1, 1];
    _dummy.scale.set(s[0], s[1], s[2]);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
    if (opts.colors) mesh.setColorAt(i, new THREE.Color(opts.colors[i % opts.colors.length]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  parentAdd(opts.parent, mesh);
  return mesh;
}

function parentAdd(parent, mesh) {
  if (parent) parent.add(mesh);
}

/* --------------------------------------------------------------------------
   misc
   -------------------------------------------------------------------------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
