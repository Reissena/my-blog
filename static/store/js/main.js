// ---------------------------------------------------------------------------
// main.js — 场景装配、渲染循环、相机与容错
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { setMaxAnisotropy } from './util.js';
import { buildWorld } from './world.js';
import { buildStore } from './store.js';
import { buildStreet } from './street.js';
import { buildSakura } from './sakura.js';
import { buildVehicles } from './vehicles.js';
import { createSky } from './sky.js';
import { WeatherSystem } from './weather.js';
import { createLightRig, Climate } from './climate.js';
import { initUI } from './ui.js';

const DEFAULT_TARGET = new THREE.Vector3(-1.5, 2.0, 0.6);
const DEFAULT_VIEW = { az: 45, el: 29, dist: 61 };

function computeDefaultCamera() {
  const az = THREE.MathUtils.degToRad(DEFAULT_VIEW.az);
  const el = THREE.MathUtils.degToRad(DEFAULT_VIEW.el);
  const d = DEFAULT_VIEW.dist;
  return new THREE.Vector3(
    DEFAULT_TARGET.x + d * Math.cos(el) * Math.sin(az),
    DEFAULT_TARGET.y + d * Math.sin(el),
    DEFAULT_TARGET.z + d * Math.cos(el) * Math.cos(az),
  );
}

function detectQuality() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) || window.innerWidth < 780;
  const cores = navigator.hardwareConcurrency || 4;
  const low = mobile || cores <= 4;
  return {
    low,
    mobile,
    dpr: low ? 1.25 : Math.min(window.devicePixelRatio || 1, 1.75),
    shadowSize: low ? 1024 : 2048,
    rainCount: low ? 6500 : 13000,
    snowCount: low ? 2400 : 5200,
    rippleCount: low ? 140 : 280,
    samples: low ? 0 : 4,
    bloom: true,
  };
}

function boot() {
  const canvas = document.getElementById('scene');
  const quality = detectQuality();

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance',
    stencil: false, depth: true,
  });
  renderer.setPixelRatio(quality.dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05070f, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.5, 700);
  camera.position.copy(computeDefaultCamera());
  camera.lookAt(DEFAULT_TARGET);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(DEFAULT_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;
  controls.minDistance = 22;
  controls.maxDistance = 98;
  controls.minPolarAngle = 0.16;
  controls.maxPolarAngle = Math.PI / 2 - 0.045;
  controls.screenSpacePanning = false;
  controls.autoRotateSpeed = 0.55;
  controls.update();

  const ctx = {
    scene, camera, renderer, quality,
    wetMaterials: [],
    waterMaterials: [],
    snowSurfaces: [],
    snowPoints: [],
    snowUniform: { value: 0 },
    signMats: [],
    glassMats: [],
    interiorLightMats: [],
    interiorPointLights: [],
    storeLights: [],
    streetLampMats: [],
    vendingLights: [],
    vendingMats: [],
    neighborMats: [],
    blossomMats: [],
    updaters: [],
    signal: null,
    sakura: null,
  };

  buildWorld(ctx);
  buildStore(ctx);
  buildStreet(ctx);
  buildSakura(ctx);
  const vehicles = buildVehicles(ctx);
  ctx.vehicles = vehicles;

  const rig = createLightRig(ctx);
  const sky = createSky(ctx);
  const weather = new WeatherSystem(ctx, quality);
  const climate = new Climate(ctx, rig, sky, weather);
  ctx.climate = climate;

  // 后期处理
  let composer = null;
  let bloomPass = null;
  const rt = new THREE.WebGLRenderTarget(
    window.innerWidth * quality.dpr,
    window.innerHeight * quality.dpr,
    { type: THREE.HalfFloatType, samples: quality.samples },
  );
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(quality.dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.34, 0.55, 1.02,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- 状态
  const state = {
    weather: 'rainy',
    time: 'night',
    shopLights: true,
    autoRotate: false,
    sound: false,
    carMotion: true,
    resetting: false,
  };
  let nightBackup = null;
  let resetAnim = null;

  const ui = initUI({
    onWeather: (w) => { state.weather = w; climate.setWeather(w); sync(); },
    onTime: (t) => { state.time = t; climate.setTime(t); sync(); },
    onReset: () => { startReset(); },
    onAutoRotate: () => {
      state.autoRotate = !state.autoRotate;
      controls.autoRotate = state.autoRotate;
      sync();
    },
    onNightMode: () => {
      if (state.weather === 'rainy' && state.time === 'night') {
        const b = nightBackup || { weather: 'sunny', time: 'day' };
        state.weather = b.weather; state.time = b.time;
        climate.setWeather(b.weather); climate.setTime(b.time);
      } else {
        nightBackup = { weather: state.weather, time: state.time };
        state.weather = 'rainy'; state.time = 'night';
        climate.setWeather('rainy'); climate.setTime('night');
      }
      sync();
    },
    onShopLights: () => {
      state.shopLights = !state.shopLights;
      climate.setShopLights(state.shopLights);
      sync();
    },
    onSound: () => {
      state.sound = !state.sound;
      weather.setThunderEnabled(state.sound);
      sync();
    },
    onCarMotion: () => {
      state.carMotion = !state.carMotion;
      vehicles.setPaused(!state.carMotion);
      sync();
    },
  });

  function sync() {
    ui.sync({
      weather: state.weather, time: state.time, shopLights: state.shopLights,
      autoRotate: state.autoRotate, sound: state.sound, carMotion: state.carMotion,
    });
  }

  function startReset() {
    resetAnim = {
      t: 0,
      dur: 1.0,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: computeDefaultCamera(),
      toTarget: DEFAULT_TARGET.clone(),
    };
    state.autoRotate = false;
    controls.autoRotate = false;
    sync();
  }

  // ---------------------------------------------------------------- 循环
  const clock = new THREE.Clock();
  let elapsed = 0;
  let frames = 0;
  let fpsAcc = 0;
  let fps = 0;

  function clampTarget() {
    const t = controls.target;
    t.x = THREE.MathUtils.clamp(t.x, -13, 13);
    t.y = THREE.MathUtils.clamp(t.y, 0.2, 7);
    t.z = THREE.MathUtils.clamp(t.z, -12, 13);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dtRaw = clock.getDelta();
    const dt = Math.min(0.05, dtRaw);
    elapsed += dt;

    controls.autoRotate = state.autoRotate;
    controls.update();
    clampTarget();

    if (resetAnim) {
      resetAnim.t += dt;
      const k = Math.min(1, resetAnim.t / resetAnim.dur);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(resetAnim.fromPos, resetAnim.toPos, e);
      controls.target.lerpVectors(resetAnim.fromTarget, resetAnim.toTarget, e);
      if (k >= 1) resetAnim = null;
    }

    climate.update(dt, elapsed);
    if (ctx.sakura) ctx.sakura.update(dt, elapsed, climate.env);
    for (const fn of ctx.updaters) fn(dt, elapsed, climate.env);
    vehicles.update(dt, elapsed, climate.env);

    if (bloomPass) {
      bloomPass.strength = 0.2 + (weather.flash || 0) * 0.4 + climate.env.nightFactor * 0.2;
    }

    composer.render();

    frames++;
    fpsAcc += dtRaw;
    if (fpsAcc > 1) { fps = frames / fpsAcc; frames = 0; fpsAcc = 0; }

    if (!window.__APP_READY__) {
      window.__APP_READY__ = true;
      window.__hideBoot && window.__hideBoot();
      sync();
    }
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(quality.dpr);
    renderer.setSize(w, h);
    composer.setPixelRatio(quality.dpr);
    composer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 180));

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    window.__showFatal && window.__showFatal('WebGL 上下文丢失。', '请刷新页面重试；如果反复出现，请降低浏览器硬件加速压力。');
  }, false);

  sync();
  renderer.compile(scene, camera);
  requestAnimationFrame(animate);

  // 测试 / 调试接口
  window.__app = {
    THREE,
    state,
    scene, camera, renderer, controls, composer, climate, weather, ctx, bloomPass, vehicles,
    setWeather(w) { state.weather = w; climate.setWeather(w); sync(); },
    setTime(t) { state.time = t; climate.setTime(t); sync(); },
    setShopLights(v) { state.shopLights = !!v; climate.setShopLights(v); sync(); },
    resetView: startReset,
    getFps() { return fps; },
    snapEnv() { climate.snap(); },
  };
}

try {
  boot();
} catch (err) {
  console.error(err);
  if (window.__showFatal) window.__showFatal('初始化 3D 场景时发生错误。', err);
}
