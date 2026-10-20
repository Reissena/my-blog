// ---------------------------------------------------------------------------
// main.js — rain / sakura konbini diorama
//   renderer / camera / controls / plinth / day-night & weather state / loop
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toon, addBox, clamp, damp } from './toon.js';
import { buildStreet } from './street.js';
import { buildStore } from './store.js';
import { createRain } from './rain.js';
import { createSky } from './sky.js';
import { createSnow } from './snow.js';
import { createPetals } from './petals.js';
import { createHud } from './ui.js';
import { buildRamen } from './ramen.js';
import { setSnowAmount } from './snowcover.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x05070f, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0d1930, 0.0072);

/* --------------------------------------------------------------------------
   camera + controls
   -------------------------------------------------------------------------- */
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.5, 220);
const DEFAULT_TARGET = new THREE.Vector3(3.4, 1.2, 0.3);
const DEFAULT_POS = new THREE.Vector3(31.2, 22.0, 31.2);
camera.position.copy(DEFAULT_POS);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(DEFAULT_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.65;
controls.panSpeed = 0.7;
controls.screenSpacePanning = true;
controls.minDistance = 9;
controls.maxDistance = 56;
controls.minPolarAngle = 0.36;
controls.maxPolarAngle = 1.36;
controls.update();

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
controls.addEventListener('start', () => document.body.classList.add('dragging'));
controls.addEventListener('end', () => document.body.classList.remove('dragging'));

/* --------------------------------------------------------------------------
   lights (the shop's point lights are collected so time-of-day can dim them)
   -------------------------------------------------------------------------- */
const hemi = new THREE.HemisphereLight(0x8fa8ff, 0x241f30, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xc0d2ff, 1.25);
key.position.set(12, 22, 16);
key.target.position.set(-1, 0, -1);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -18;
key.shadow.camera.right = 18;
key.shadow.camera.top = 18;
key.shadow.camera.bottom = -18;
key.shadow.camera.near = 2;
key.shadow.camera.far = 80;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.035;
key.shadow.radius = 2.5;
scene.add(key);
scene.add(key.target);

const rim = new THREE.DirectionalLight(0x7089ff, 0.5);
rim.position.set(-16, 9, -14);
scene.add(rim);

const fill = new THREE.DirectionalLight(0x8ea2cc, 0.42);
fill.position.set(-13, 7, 9);
scene.add(fill);

const interiorLights = [];
function pointLight(color, intensity, distance, x, y, z) {
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(x, y, z);
  scene.add(l);
  interiorLights.push({ light: l, base: intensity });
  return l;
}
pointLight(0xffc98c, 8.5, 13, -2.2, 3.15, -4.2);
pointLight(0xffd3a2, 6.0, 11, 1.6, 3.1, -1.3);
pointLight(0xffc98b, 2.0, 5.5, -1.2, 2.55, 1.1);
pointLight(0xffd2a2, 4.2, 5.5, -4.7, 2.45, 1.05);
pointLight(0xffcf9a, 5.0, 8.0, -3.6, 2.72, -5.6);
pointLight(0xffc382, 1.7, 5.5, -1.0, 2.65, 3.55);
pointLight(0xffb36b, 5.0, 5.5, -6.9, 2.65, 2.1);

/* --------------------------------------------------------------------------
   diorama plinth — square, layered, pale inlay
   -------------------------------------------------------------------------- */
const base = new THREE.Group();
base.name = 'plinth';
scene.add(base);

const rimMat = new THREE.MeshBasicMaterial({ color: 0x4b5b78, toneMapped: false });

function tier(w, h, d, bottomY, color, cast = true) {
  return addBox(base, w, h, d, toon(color), 0, bottomY, 0, { cast, receive: true });
}
tier(24.2, 0.22, 24.2, -0.22, 0x333b52);
tier(24.7, 0.32, 24.7, -0.54, 0x262d43);
tier(25.2, 0.42, 25.2, -0.96, 0x1c2234);
tier(25.6, 0.12, 25.6, -1.08, 0x141925, false);

function rimRing(half, y) {
  const len = half * 2.0;
  addBox(base, len, 0.014, 0.042, rimMat, 0, y, half);
  addBox(base, len, 0.014, 0.042, rimMat, 0, y, -half);
  addBox(base, 0.042, 0.014, len, rimMat, half, y, 0);
  addBox(base, 0.042, 0.014, len, rimMat, -half, y, 0);
}
rimRing(11.96, 0.002);
rimRing(12.23, -0.198);
rimRing(12.48, -0.518);
rimRing(12.73, -0.938);

/* --------------------------------------------------------------------------
   world
   -------------------------------------------------------------------------- */
const street = buildStreet(scene);
const store = buildStore(scene);
const ramen = buildRamen(scene);
const rain = createRain(scene);
const sky = createSky(scene);
const snow = createSnow(scene);
const petals = createPetals(scene, street.sakuraSpots);

/* --------------------------------------------------------------------------
   time / weather presets
   -------------------------------------------------------------------------- */
const TIME = {
  day: {
    keyColor: 0xfff1d6, keyIntensity: 2.10, keyPos: [17, 30, 21],
    hemiSky: 0xcfe8ff, hemiGround: 0xc6b294, hemiIntensity: 0.95,
    rim: 0.26, fill: 0.22, fogDensity: 0.0030, interior: 0.55, ground: 1.0, lamp: 0.28,
    sky: { top: 0x3f86d4, horizon: 0x93bfe2, bottom: 0xc2dcee, glow: 0xffe9b8, glowStrength: 0.9, stars: 0, sunDir: [-0.35, 0.45, -0.82] },
  },
  dusk: {
    keyColor: 0xffad65, keyIntensity: 1.55, keyPos: [20, 13, 22],
    hemiSky: 0x7889c8, hemiGround: 0x4a3442, hemiIntensity: 0.62,
    rim: 0.40, fill: 0.40, fogDensity: 0.0055, interior: 0.95, ground: 0.32, lamp: 0.92,
    sky: { top: 0x2b3768, horizon: 0xe39a73, bottom: 0x4a3546, glow: 0xffb36b, glowStrength: 0.85, stars: 0.12, sunDir: [-0.72, 0.16, -0.68] },
  },
  night: {
    keyColor: 0xc0d2ff, keyIntensity: 1.25, keyPos: [12, 22, 16],
    hemiSky: 0x8fa8ff, hemiGround: 0x241f30, hemiIntensity: 0.55,
    rim: 0.50, fill: 0.42, fogDensity: 0.0072, interior: 1.0, ground: 0.0, lamp: 1.0,
    sky: { top: 0x02040a, horizon: 0x060f1d, bottom: 0x020308, glow: 0x3f5c8f, glowStrength: 0.12, stars: 0, sunDir: [-0.35, 0.30, -0.85] },
  },
};

const SKY = {
  day: {
    clear: TIME.day.sky,
    rain: { top: 0x4a6078, horizon: 0x8298ab, bottom: 0xa8b6c1, glow: 0xcdd6dd, glowStrength: 0.25, stars: 0, sunDir: [-0.35, 0.45, -0.82] },
    snow: { top: 0x6f88a2, horizon: 0xb8ccdb, bottom: 0xd6e2ea, glow: 0xffffff, glowStrength: 0.30, stars: 0, sunDir: [-0.35, 0.45, -0.82] },
  },
  dusk: {
    clear: TIME.dusk.sky,
    rain: { top: 0x222b42, horizon: 0x8b6c68, bottom: 0x2a2530, glow: 0xc98a5e, glowStrength: 0.30, stars: 0, sunDir: [-0.72, 0.16, -0.68] },
    snow: { top: 0x35405c, horizon: 0xc0a6a4, bottom: 0x46414d, glow: 0xefc4a0, glowStrength: 0.38, stars: 0, sunDir: [-0.72, 0.16, -0.68] },
  },
  night: {
    clear: { top: 0x010207, horizon: 0x050d1a, bottom: 0x010205, glow: 0x506fa0, glowStrength: 0.16, stars: 1.0, sunDir: [-0.35, 0.30, -0.85] },
    rain: TIME.night.sky,
    snow: { top: 0x040a14, horizon: 0x101c2b, bottom: 0x050810, glow: 0x6f8aad, glowStrength: 0.15, stars: 0, sunDir: [-0.35, 0.30, -0.85] },
  },
};

const WEATHER = {
  clear: { rain: 0, snow: 0, wet: 0, key: 1.0, hemi: 1.0, fog: 0.9, interior: 0.95, ground: 1.0, cover: 0 },
  rain: { rain: 1, snow: 0, wet: 1, key: 0.82, hemi: 0.95, fog: 1.55, interior: 1.08, ground: 0.72, cover: 0 },
  snow: { rain: 0, snow: 1, wet: 0.28, key: 0.9, hemi: 1.05, fog: 1.32, interior: 1.0, ground: 0.85, cover: 1 },
};

/* --------------------------------------------------------------------------
   state + controls
   -------------------------------------------------------------------------- */
const state = { time: 'night', weather: 'rain', lamp: true, petals: true };

const env = {
  keyColor: new THREE.Color(0xc0d2ff),
  keyIntensity: 1.25,
  keyPos: new THREE.Vector3(12, 22, 16),
  hemiSky: new THREE.Color(0x8fa8ff),
  hemiGround: new THREE.Color(0x241f30),
  hemiIntensity: 0.55,
  rim: 0.5,
  fill: 0.42,
  fog: new THREE.Color(0x0d1930),
  fogDensity: 0.0072,
  interior: 1.0,
  ground: 0.0,
  lamp: 1.0,
  rain: 1,
  snow: 0,
  wet: 1,
  cover: 0,
};

const target = {
  keyColor: new THREE.Color(0xc0d2ff),
  keyIntensity: 1.25,
  keyPos: new THREE.Vector3(12, 22, 16),
  hemiSky: new THREE.Color(0x8fa8ff),
  hemiGround: new THREE.Color(0x241f30),
  hemiIntensity: 0.55,
  rim: 0.5,
  fill: 0.42,
  fog: new THREE.Color(0x0d1930),
  fogDensity: 0.0072,
  interior: 1.0,
  ground: 0.0,
  lamp: 1.0,
  rain: 1,
  snow: 0,
  wet: 1,
  cover: 0,
};

function refreshTargets() {
  const t = TIME[state.time];
  const w = WEATHER[state.weather];
  const skyPreset = SKY[state.time][state.weather];

  target.keyColor.setHex(t.keyColor);
  target.keyIntensity = t.keyIntensity * w.key;
  target.keyPos.fromArray(t.keyPos);
  target.hemiSky.setHex(t.hemiSky);
  target.hemiGround.setHex(t.hemiGround);
  target.hemiIntensity = t.hemiIntensity * w.hemi;
  target.rim = t.rim;
  target.fill = t.fill;
  target.fog.setHex(skyPreset.horizon);
  target.fogDensity = t.fogDensity * w.fog;
  target.interior = t.interior * w.interior;
  target.ground = t.ground * w.ground;
  target.lamp = t.lamp;
  target.rain = w.rain;
  target.snow = w.snow;
  target.wet = w.wet;
  target.cover = w.cover;

  sky.setTargets(skyPreset);
}

function snapEnvironment() {
  env.keyColor.copy(target.keyColor);
  env.keyIntensity = target.keyIntensity;
  env.keyPos.copy(target.keyPos);
  env.hemiSky.copy(target.hemiSky);
  env.hemiGround.copy(target.hemiGround);
  env.hemiIntensity = target.hemiIntensity;
  env.rim = target.rim;
  env.fill = target.fill;
  env.fog.copy(target.fog);
  env.fogDensity = target.fogDensity;
  env.interior = target.interior;
  env.ground = target.ground;
  env.lamp = target.lamp;
  env.rain = target.rain;
  env.snow = target.snow;
  env.wet = target.wet;
  env.cover = target.cover;

  key.color.copy(env.keyColor);
  key.intensity = env.keyIntensity;
  key.position.copy(env.keyPos);
  hemi.color.copy(env.hemiSky);
  hemi.groundColor.copy(env.hemiGround);
  hemi.intensity = env.hemiIntensity;
  rim.intensity = env.rim;
  fill.intensity = env.fill;
  scene.fog.color.copy(env.fog);
  scene.fog.density = env.fogDensity;
  for (const item of interiorLights) item.light.intensity = item.base * env.interior;
  street.setDaylight(env.ground);
  street.setLampMood(env.lamp);
  rain.setAmount(env.rain);
  snow.setAmount(env.snow);
  street.setWetness(env.wet);
  store.setRainAmount(env.rain);
  setSnowAmount(env.cover);
}

const hud = createHud(state, (next) => {
  state.time = next.time;
  state.weather = next.weather;
  state.lamp = next.lamp;
  state.petals = next.petals;
  street.setLamp(state.lamp);
  petals.setEnabled(state.petals);
  refreshTargets();
});

street.setLamp(state.lamp);
petals.setEnabled(state.petals);

function applyEnvironment(dt) {
  const k = 1 - Math.exp(-2.1 * dt);
  env.keyColor.lerp(target.keyColor, k);
  env.keyIntensity = damp(env.keyIntensity, target.keyIntensity, 2.1, dt);
  env.keyPos.lerp(target.keyPos, k);
  env.hemiSky.lerp(target.hemiSky, k);
  env.hemiGround.lerp(target.hemiGround, k);
  env.hemiIntensity = damp(env.hemiIntensity, target.hemiIntensity, 2.1, dt);
  env.rim = damp(env.rim, target.rim, 2.1, dt);
  env.fill = damp(env.fill, target.fill, 2.1, dt);
  env.fog.lerp(target.fog, k);
  env.fogDensity = damp(env.fogDensity, target.fogDensity, 1.8, dt);
  env.interior = damp(env.interior, target.interior, 1.8, dt);
  env.ground = damp(env.ground, target.ground, 1.8, dt);
  env.lamp = damp(env.lamp, target.lamp, 1.8, dt);
  env.rain = damp(env.rain, target.rain, 1.6, dt);
  env.snow = damp(env.snow, target.snow, 1.3, dt);
  env.wet = damp(env.wet, target.wet, 1.4, dt);
  env.cover = damp(env.cover, target.cover, 1.1, dt);

  key.color.copy(env.keyColor);
  key.intensity = env.keyIntensity;
  key.position.copy(env.keyPos);
  hemi.color.copy(env.hemiSky);
  hemi.groundColor.copy(env.hemiGround);
  hemi.intensity = env.hemiIntensity;
  rim.intensity = env.rim;
  fill.intensity = env.fill;
  scene.fog.color.copy(env.fog);
  scene.fog.density = env.fogDensity;

  for (const item of interiorLights) item.light.intensity = item.base * env.interior;
  street.setDaylight(env.ground);
  street.setLampMood(env.lamp);
  rain.setAmount(env.rain);
  snow.setAmount(env.snow);
  street.setWetness(env.wet);
  store.setRainAmount(env.rain);
  setSnowAmount(env.cover);
}

refreshTargets();
snapEnvironment();

/* --------------------------------------------------------------------------
   resize / fov
   -------------------------------------------------------------------------- */
let baseFov = 34;
const BASE_ASPECT = 16 / 9;
function applyFov() {
  const a = Math.max(0.5, camera.aspect);
  const halfH = Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * BASE_ASPECT;
  const needed = THREE.MathUtils.radToDeg(2 * Math.atan(halfH / a));
  camera.fov = clamp(Math.max(baseFov, needed), baseFov, 66);
  camera.updateProjectionMatrix();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h);
  applyFov();
}
window.addEventListener('resize', resize);
applyFov();

/* --------------------------------------------------------------------------
   preset views
   -------------------------------------------------------------------------- */
const VIEWS = {
  default: { pos: [31.2, 22.0, 31.2], target: [3.4, 1.2, 0.3], fov: 34 },
  window: { pos: [-1.0, 2.95, 10.4], target: [-0.9, 1.85, 0.4], fov: 40 },
  corner: { pos: [-19.6, 13.4, 20.4], target: [-1.6, 1.25, -1.2], fov: 34 },
  side: { pos: [18.6, 11.4, 12.6], target: [1.4, 1.4, -2.8], fov: 34 },
  sakura: { pos: [18.0, 8.6, 3.2], target: [10.8, 3.0, -6.6], fov: 34 },
  lamp: { pos: [10.0, 4.3, 13.5], target: [6.0, 4.8, 4.9], fov: 34 },
  ramen: { pos: [21.5, 6.2, 21.0], target: [15.6, 2.0, 7.0], fov: 33 },
};

function setView(name) {
  const v = VIEWS[name] || VIEWS.default;
  camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
  controls.target.set(v.target[0], v.target[1], v.target[2]);
  baseFov = v.fov || 34;
  applyFov();
  controls.update();
}

/* --------------------------------------------------------------------------
   keep the camera on the model and out of the shop
   -------------------------------------------------------------------------- */
const _before = new THREE.Vector3();
function constrainCamera() {
  _before.copy(controls.target);
  controls.target.x = clamp(controls.target.x, -8.0, 17.5);
  controls.target.y = clamp(controls.target.y, 0.35, 4.0);
  controls.target.z = clamp(controls.target.z, -8.0, 11.5);
  if (!_before.equals(controls.target)) {
    camera.position.x += controls.target.x - _before.x;
    camera.position.y += controls.target.y - _before.y;
    camera.position.z += controls.target.z - _before.z;
  }
  const p = camera.position;
  if (p.x > -6.6 && p.x < 4.6 && p.z > -7.6 && p.z < 2.5 && p.y < 5.05) {
    p.y = 5.05;
    camera.lookAt(controls.target);
  }
  if (p.x > 12.8 && p.x < 18.9 && p.z > 2.3 && p.z < 8.7 && p.y < 5.4) {
    p.y = 5.4;
    camera.lookAt(controls.target);
  }
  if (p.y < 0.85) {
    p.y = 0.85;
    camera.lookAt(controls.target);
  }
}

/* --------------------------------------------------------------------------
   loop
   -------------------------------------------------------------------------- */
const clock = new THREE.Clock();
let frames = 0;

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;
  frames++;

  store.update(t, dt);
  ramen.update(t, dt);
  street.update(t, dt);
  rain.update(t, dt);
  snow.update(t);
  petals.update(t, dt);
  applyEnvironment(dt);
  sky.update(dt);

  controls.update();
  constrainCamera();

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

/* --------------------------------------------------------------------------
   debug hook
   -------------------------------------------------------------------------- */
window.__konbini = {
  ready: true,
  canvas,
  renderer,
  scene,
  camera,
  controls,
  views: VIEWS,
  setView,
  state: () => ({ ...state }),
  setTime: (v) => hud.update({ time: v }),
  setWeather: (v) => hud.update({ weather: v }),
  setLamp: (v) => hud.update({ lamp: !!v }),
  setPetals: (v) => hud.update({ petals: !!v }),
  door: (v) => store.setDoor(v),
  doorAmount: () => store.doorAmount,
  signLevel: () => store.signMats[0].mat.color.r,
  signalPhase: () => street.phase(),
  stats: () => ({
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
    dpr: renderer.getPixelRatio(),
    size: [renderer.domElement.width, renderer.domElement.height],
    memory: renderer.info.memory,
    frames,
  }),
};