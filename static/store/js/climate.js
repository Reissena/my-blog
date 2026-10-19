// ---------------------------------------------------------------------------
// climate.js — 天气 × 昼夜：光照、天空、雾、湿润度、积雪、灯光强度
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp, damp } from './util.js';

const TIMES = {
  day: {
    skyTop: 0x1c6fbe, skyHorizon: 0xb8dcf0, skyBottom: 0x0b141d,
    sunColor: 0xfff1d8, sunIntensity: 2.05, az: 105, el: 42,
    hemiSky: 0xbfd8ee, hemiGround: 0x5c5449, hemiIntensity: 0.5,
    ambient: 0x94b2d2, ambientIntensity: 0.16,
    fog: 0xc0d4e2, fogDensity: 0.0032,
    shop: 0.45, street: 0.0, stars: 0, exposure: 0.82,
    cloudColor: 0xf2f6fb, cloudShade: 0xa8bccd, greyLum: 0.5,
    sunSize: 46, sunOpacity: 0.85, dayFactor: 1.0, haze: 0.25,
  },
  sunset: {
    skyTop: 0x24325f, skyHorizon: 0xf28a5a, skyBottom: 0x2a1a22,
    sunColor: 0xffae72, sunIntensity: 1.15, az: 78, el: 7,
    hemiSky: 0xffb389, hemiGround: 0x3a2a2c, hemiIntensity: 0.44,
    ambient: 0x6d5170, ambientIntensity: 0.22,
    fog: 0x9c6252, fogDensity: 0.005,
    shop: 0.82, street: 0.75, stars: 0.06, exposure: 0.92,
    cloudColor: 0xc98070, cloudShade: 0x3a2634, greyLum: 0.16,
    sunSize: 62, sunOpacity: 1.0, dayFactor: 0.45, haze: 0.4,
  },
  night: {
    skyTop: 0x03060f, skyHorizon: 0x12203a, skyBottom: 0x010204,
    sunColor: 0x9db4ff, sunIntensity: 0.34, az: 150, el: 38,
    hemiSky: 0x2b4167, hemiGround: 0x0b0f16, hemiIntensity: 0.32,
    ambient: 0x172742, ambientIntensity: 0.2,
    fog: 0x101d33, fogDensity: 0.0072,
    shop: 1.0, street: 1.0, stars: 1.0, exposure: 1.12,
    cloudColor: 0x2b3852, cloudShade: 0x060910, greyLum: 0.03,
    sunSize: 18, sunOpacity: 0.0, dayFactor: 0.0, haze: 0.18,
  },
};

const WEATHERS = {
  sunny: {
    label: '晴天', rain: 0, snow: 0, lightning: false, cloud: 0.1, wind: 0.25, wet: 0,
    petal: 1.0, grey: 0x8fa3b8, skyMix: 0.0, sunMul: 1.0, hemiMul: 1.0, ambMul: 1.0,
    fogMul: 0.55, shopMul: 1.0, streetMul: 1.0, streetBoost: 0.0, starMul: 1.0, exposureMul: 1.0,
    sunOpacityMul: 1.0, signGlow: 1.0, rainOpacity: 0,
  },
  rainy: {
    label: '雨天', rain: 0.58, snow: 0, lightning: false, cloud: 0.84, wind: 0.6, wet: 1.0,
    petal: 0.35, grey: 0x54657a, skyMix: 0.62, sunMul: 0.3, hemiMul: 0.82, ambMul: 0.95,
    fogMul: 1.08, shopMul: 1.05, streetMul: 1.0, streetBoost: 0.32, starMul: 0.0, exposureMul: 0.98,
    sunOpacityMul: 0.1, signGlow: 1.1, rainOpacity: 0.55,
  },
  storm: {
    label: '雷雨', rain: 1.05, snow: 0, lightning: true, cloud: 1.0, wind: 1.15, wet: 1.12,
    petal: 0.1, grey: 0x2a3444, skyMix: 0.82, sunMul: 0.12, hemiMul: 0.52, ambMul: 0.62,
    fogMul: 1.45, shopMul: 1.1, streetMul: 1.0, streetBoost: 0.5, starMul: 0.0, exposureMul: 0.95,
    sunOpacityMul: 0.0, signGlow: 1.15, rainOpacity: 0.85,
  },
  snow: {
    label: '雪天', rain: 0, snow: 1, lightning: false, cloud: 0.92, wind: 0.5, wet: 0.5,
    petal: 0.0, grey: 0xa7b7c8, skyMix: 0.76, sunMul: 0.55, hemiMul: 1.18, ambMul: 1.3,
    fogMul: 1.3, shopMul: 1.1, streetMul: 1.0, streetBoost: 0.28, starMul: 0.1, exposureMul: 0.88,
    sunOpacityMul: 0.35, signGlow: 1.1, rainOpacity: 0,
  },
  heavy: {
    label: '暴雨', rain: 1.95, snow: 0, lightning: false, cloud: 1.0, wind: 1.9, wet: 1.4,
    petal: 0.0, grey: 0x3a424c, skyMix: 0.85, sunMul: 0.16, hemiMul: 0.46, ambMul: 0.56,
    fogMul: 1.6, shopMul: 1.15, streetMul: 1.0, streetBoost: 0.55, starMul: 0.0, exposureMul: 0.94,
    sunOpacityMul: 0.0, signGlow: 1.2, rainOpacity: 1.0,
  },
};

// 将 TIMES 中的颜色统一为 THREE.Color（避免 Color.copy(number) 产生 NaN）
for (const key of Object.keys(TIMES)) {
  const t = TIMES[key];
  for (const field of ['skyTop', 'skyHorizon', 'skyBottom', 'sunColor', 'ambient', 'hemiSky', 'hemiGround', 'fog', 'cloudColor', 'cloudShade']) {
    t[field] = new THREE.Color(t[field]);
  }
}

function dirFrom(azDeg, elDeg) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
}

function greyColor(hex, lum) {
  const c = new THREE.Color(hex);
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  return c.multiplyScalar(lum / Math.max(0.00001, l));
}

export function createLightRig(ctx) {
  const scene = ctx.scene;
  const hemi = new THREE.HemisphereLight(0xbfd8ee, 0x5c5449, 0.85);
  hemi.position.set(0, 30, 0);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x94b2d2, 0.3);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff1d8, 3.0);
  sun.position.set(30, 46, 24);
  sun.castShadow = true;
  const sm = ctx.quality.shadowSize || 2048;
  sun.shadow.mapSize.set(sm, sm);
  sun.shadow.camera.left = -38;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 38;
  sun.shadow.camera.bottom = -38;
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 170;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.024;
  sun.target.position.set(-2, 0, 0);
  scene.add(sun);
  scene.add(sun.target);

  const flashLight = new THREE.DirectionalLight(0xdfe9ff, 0);
  flashLight.position.set(-30, 60, 20);
  flashLight.target.position.set(0, 0, 0);
  scene.add(flashLight);
  scene.add(flashLight.target);

  const rim = new THREE.DirectionalLight(0x6f9dff, 0.22);
  rim.position.set(-24, 18, -30);
  scene.add(rim);

  return { hemi, ambient, sun, flashLight, rim };
}

export class Climate {
  constructor(ctx, rig, sky, weather) {
    this.ctx = ctx;
    this.rig = rig;
    this.sky = sky;
    this.weather = weather;

    this.weatherName = 'rainy';
    this.timeName = 'night';
    this.shopOn = true;

    this.env = {
      skyTop: new THREE.Color(0x12203a),
      skyHorizon: new THREE.Color(0x1b2c4a),
      skyBottom: new THREE.Color(0x010204),
      sunColor: new THREE.Color(0xffcf9e),
      sunDir: new THREE.Vector3(0.3, 0.8, 0.4),
      moonDir: new THREE.Vector3(0.4, 0.55, -0.7),
      cloudColor: new THREE.Color(0x2b3852),
      cloudShade: new THREE.Color(0x060910),
      celestialColor: new THREE.Color(0xffd9a0),
      flash: 0,
      cloud: 0.5, sunGlow: 0.4, star: 0.8, haze: 0.2,
      sunOpacity: 0.5, sunSize: 40, moonOpacity: 0.6, moonSize: 22,
      sunIntensity: 0.3, hemiIntensity: 0.2, ambientIntensity: 0.1,
      fogColor: new THREE.Color(0x0a1424), fogDensity: 0.01,
      exposure: 1.0,
      wetness: 0, rain: 0, snow: 0, wind: 0.4, petal: 1,
      nightFactor: 1, dayFactor: 0, lightning: false,
      shopLevel: 1, streetLevel: 1, signGlow: 1,
    };

    this.fog = new THREE.FogExp2(0x0a1424, 0.01);
    ctx.scene.fog = this.fog;

    // 初始化目标：直接对齐，避免开场从错误状态缓慢过渡
    this.snap();
  }

  setWeather(name) {
    if (!WEATHERS[name]) return;
    this.weatherName = name;
    this.weather.setLightningEnabled(WEATHERS[name].lightning);
    this.sky.markEnvDirty();
  }

  setTime(name) {
    if (!TIMES[name]) return;
    this.timeName = name;
    this.sky.markEnvDirty();
  }

  setShopLights(on) {
    this.shopOn = !!on;
  }

  computeTargets(out) {
    const base = TIMES[this.timeName];
    const w = WEATHERS[this.weatherName];
    const shopFactor = this.shopOn ? 1 : 0.035;

    const grey = greyColor(w.grey, base.greyLum);
    const greySoft = grey.clone().lerp(new THREE.Color(base.skyHorizon), 0.35);

    out.skyTop.copy(base.skyTop).lerp(grey, w.skyMix * 0.9);
    out.skyHorizon.copy(base.skyHorizon).lerp(greySoft, w.skyMix * 0.85);
    out.skyBottom.copy(base.skyBottom).lerp(grey, w.skyMix * 0.7);

    out.cloudColor.copy(base.cloudColor).lerp(grey, w.skyMix * 0.75);
    out.cloudShade.copy(base.cloudShade).lerp(grey, w.skyMix * 0.5);

    out.sunColor.copy(base.sunColor);
    out.sunDir.copy(dirFrom(base.az, base.el));
    out.moonDir.copy(dirFrom(150, 34));
    out.celestialColor.copy(base.sunColor);

    out.sunGlow = (this.timeName === 'day' ? 1.0 : this.timeName === 'sunset' ? 1.4 : 0.35) * w.sunMul;
    out.sunOpacity = base.sunOpacity * w.sunOpacityMul * (this.timeName === 'night' ? 0 : 1);
    out.sunSize = base.sunSize;
    out.moonOpacity = base.dayFactor < 0.5 ? (0.75 * (1 - w.cloud * 0.95)) * (1 - base.dayFactor) : 0;
    out.moonSize = 10 * (1 - w.cloud * 0.35);

    out.cloud = clamp(w.cloud + (1 - base.dayFactor) * 0.02, 0, 1);
    out.star = base.stars * w.starMul * (1 - w.cloud * 0.92);
    out.haze = base.haze * (1 + w.cloud * 0.6);

    out.sunIntensity = base.sunIntensity * w.sunMul;
    out.hemiIntensity = base.hemiIntensity * w.hemiMul;
    out.ambientIntensity = base.ambientIntensity * w.ambMul;
    out.sunColor.copy(base.sunColor);

    out.fogColor.copy(base.fog).lerp(greySoft, 0.45 + w.skyMix * 0.35);
    out.fogDensity = base.fogDensity * w.fogMul;
    out.exposure = base.exposure * (w.exposureMul || 1);

    out.wetness = w.wet;
    out.rain = w.rain;
    out.snow = w.snow;
    out.wind = w.wind;
    out.petal = w.petal;
    out.lightning = !!w.lightning;

    out.dayFactor = base.dayFactor;
    out.nightFactor = 1 - base.dayFactor;

    out.shopLevel = clamp(base.shop * w.shopMul, 0, 1.2) * shopFactor;
    out.streetLevel = clamp(base.street * w.streetMul + w.streetBoost, 0, 1);
    out.signGlow = w.signGlow;
    out.flash = Math.max(out.flash, 0);
  }

  snap() {
    this.computeTargets(this.env);
    this.applyStatic(true);
    this.sky.update(0, 0, this.env);
    this.sky.markEnvDirty();
  }

  applyStatic(immediate) {
    const env = this.env;
    const rig = this.rig;

    rig.hemi.color.copy(env.skyHorizon).lerp(new THREE.Color(0xffffff), 0.15).multiplyScalar(1.4);
    rig.hemi.groundColor.copy(TIMES[this.timeName].hemiGround);
    rig.sun.color.copy(env.sunColor);
    rig.sun.intensity = env.sunIntensity;
    rig.sun.position.copy(env.sunDir).multiplyScalar(78);
    rig.ambient.color.copy(TIMES[this.timeName].ambient);
    rig.ambient.intensity = env.ambientIntensity;
    rig.rim.intensity = 0.08 + env.nightFactor * 0.28;

    this.fog.color.copy(env.fogColor);
    this.fog.density = env.fogDensity;
    this.ctx.scene.fog = this.fog;

    this.applyMaterials(env, 1);
    this.ctx.renderer.toneMappingExposure = env.exposure;
  }

  applyMaterials(env, t) {
    const ctx = this.ctx;

    // 湿润材质
    for (const entry of ctx.wetMaterials) {
      entry.mat.color.copy(entry.dry.color).lerp(entry.wet.color, env.wetness);
      entry.mat.roughness = entry.dry.roughness + (entry.wet.roughness - entry.dry.roughness) * env.wetness;
      entry.mat.metalness = entry.dry.metalness + (entry.wet.metalness - entry.dry.metalness) * env.wetness;
    }

    // 积水 / 反光光带
    for (const entry of ctx.waterMaterials) {
      const v = entry.target ? entry.target(env) : 0;
      entry.mat.opacity = clamp(v, 0, 1);
      const vis = entry.mat.opacity > 0.005;
      if (entry.mat.visible !== vis) entry.mat.visible = vis;
    }

    // 招牌 / 室内发光材质
    const signFactor = (0.22 + 0.8 * env.shopLevel) * env.signGlow;
    for (const entry of ctx.signMats) {
      entry.mat.emissiveIntensity = entry.base * signFactor;
    }
    const interiorFactor = 0.12 + 0.88 * env.shopLevel;
    for (const mat of ctx.interiorLightMats) {
      if (mat.userData.baseEmissive === undefined) mat.userData.baseEmissive = mat.emissiveIntensity;
      mat.emissiveIntensity = mat.userData.baseEmissive * interiorFactor;
    }

    // 店内点光源
    for (const light of ctx.interiorPointLights) {
      if (light.userData.baseIntensity === undefined) light.userData.baseIntensity = light.intensity;
      light.intensity = light.userData.baseIntensity * (0.18 + 0.82 * env.shopLevel);
    }
    for (const light of ctx.storeLights) {
      if (light.userData.baseIntensity === undefined) light.userData.baseIntensity = light.intensity;
      light.intensity = light.userData.baseIntensity * (0.2 + 0.8 * env.shopLevel);
    }

    // 路灯
    const lampLevel = clamp(env.streetLevel, 0, 1.05);
    for (const entry of ctx.streetLampMats) {
      entry.light.intensity = entry.base * lampLevel;
      entry.mat.emissiveIntensity = 0.12 + 2.6 * lampLevel;
      entry.glow.opacity = entry.glowBase * lampLevel;
    }

    // 自动售货机
    for (const l of ctx.vendingLights) {
      if (l.userData.baseIntensity === undefined) l.userData.baseIntensity = l.intensity;
      l.intensity = l.userData.baseIntensity * (0.55 + 0.45 * env.nightFactor);
    }
    for (const m of ctx.vendingMats) {
      m.emissiveIntensity = 0.7 + 0.55 * env.nightFactor;
    }

    // 远处楼房窗户
    for (const m of ctx.neighborMats) {
      m.emissiveIntensity = 0.2 + 0.4 * env.nightFactor;
    }

    // 樱花在夜色里微微发光
    for (const m of ctx.blossomMats) {
      m.emissiveIntensity = 0.035 + 0.075 * env.nightFactor;
    }

    // 信号灯
    if (ctx.signal && ctx.signal.light) {
      ctx.signal.light.intensity = 4.5 * (0.45 + 0.55 * env.nightFactor);
    }

    // 玻璃（雨天更“亮”的反射）
    for (const g of ctx.glassMats) {
      g.opacity = 0.1 + env.wetness * 0.05;
      g.envMapIntensity = 1.15 + env.wetness * 0.55;
    }

    // 雾
    this.fog.density = env.fogDensity;
    this.fog.color.copy(env.fogColor);
  }

  update(dt, time) {
    const env = this.env;
    const flash = this.weather.flash || 0;

    // 目标值
    if (!this.targets) {
      this.targets = {
        skyTop: new THREE.Color(), skyHorizon: new THREE.Color(), skyBottom: new THREE.Color(),
        sunColor: new THREE.Color(), sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(),
        cloudColor: new THREE.Color(), cloudShade: new THREE.Color(), celestialColor: new THREE.Color(),
        fogColor: new THREE.Color(),
      };
    }
    const t = this.targets;
    const prevWet = env.wetness;
    this.computeTargets(t);

    // 平滑
    const kSlow = 1 - Math.exp(-1.15 * dt);
    const kMed = 1 - Math.exp(-1.8 * dt);
    const kSnow = 1 - Math.exp(-0.42 * dt);
    const kFast = 1 - Math.exp(-2.6 * dt);

    env.skyTop.lerp(t.skyTop, kSlow);
    env.skyHorizon.lerp(t.skyHorizon, kSlow);
    env.skyBottom.lerp(t.skyBottom, kSlow);
    env.cloudColor.lerp(t.cloudColor, kSlow);
    env.cloudShade.lerp(t.cloudShade, kSlow);
    env.sunColor.lerp(t.sunColor, kSlow);
    env.fogColor.lerp(t.fogColor, kSlow);
    env.sunDir.lerp(t.sunDir, kSlow).normalize();
    env.celestialColor.copy(env.sunColor);

    env.cloud = damp(env.cloud, t.cloud, 1.2, dt);
    env.sunGlow = damp(env.sunGlow, t.sunGlow, 1.4, dt);
    env.star = damp(env.star, t.star, 1.0, dt);
    env.haze = damp(env.haze, t.haze, 1.0, dt);
    env.sunOpacity = damp(env.sunOpacity, t.sunOpacity, 1.4, dt);
    env.sunSize = damp(env.sunSize, t.sunSize, 1.0, dt);
    env.moonOpacity = damp(env.moonOpacity, t.moonOpacity, 1.2, dt);
    env.moonSize = damp(env.moonSize, t.moonSize, 1.0, dt);
    env.fogDensity = damp(env.fogDensity, t.fogDensity, 1.1, dt);
    env.exposure = damp(env.exposure, t.exposure, 1.0, dt);

    env.sunIntensity = damp(env.sunIntensity, t.sunIntensity, 1.6, dt);
    env.hemiIntensity = damp(env.hemiIntensity, t.hemiIntensity, 1.3, dt);
    env.ambientIntensity = damp(env.ambientIntensity, t.ambientIntensity, 1.3, dt);

    env.wetness = damp(env.wetness, t.wetness, 1.1, dt);
    env.rain = damp(env.rain, t.rain, 1.4, dt);
    env.snow = damp(env.snow, t.snow, 0.5, dt);
    env.wind = damp(env.wind, t.wind, 1.0, dt);
    env.petal = damp(env.petal, t.petal, 1.0, dt);
    env.lightning = t.lightning;

    env.dayFactor = damp(env.dayFactor, t.dayFactor, 1.2, dt);
    env.nightFactor = 1 - env.dayFactor;
    env.shopLevel = damp(env.shopLevel, t.shopLevel, 1.4, dt);
    env.streetLevel = damp(env.streetLevel, t.streetLevel, 1.3, dt);
    env.signGlow = damp(env.signGlow, t.signGlow, 1.0, dt);

    env.flash = flash;

    // 应用光照
    const rig = this.rig;
    const flashBoost = flash;
    rig.sun.intensity = env.sunIntensity * (1.0 + flashBoost * 0.6);
    rig.sun.color.copy(env.sunColor);
    rig.sun.position.copy(env.sunDir).multiplyScalar(78);
    rig.hemi.intensity = env.hemiIntensity * (1.0 + flashBoost * 1.4) + 0.12;
    rig.hemi.color.copy(env.skyHorizon).lerp(new THREE.Color(0xffffff), 0.15).multiplyScalar(1.55);
    rig.hemi.groundColor.copy(TIMES[this.timeName].hemiGround).lerp(new THREE.Color(0x8899aa), flashBoost * 0.4);
    rig.ambient.intensity = env.ambientIntensity * (1.0 + flashBoost * 2.6) + 0.03;
    rig.ambient.color.copy(TIMES[this.timeName].ambient);
    rig.flashLight.intensity = flashBoost * 6.0;
    rig.flashLight.position.copy(env.moonDir).multiplyScalar(70);
    rig.rim.intensity = (0.08 + env.nightFactor * 0.3) + flashBoost * 0.3;

    this.ctx.renderer.toneMappingExposure = env.exposure * (1 + flashBoost * 0.22);

    this.applyMaterials(env, dt);

    // 天空
    this.sky.update(dt, time, env);

    // 天气
    this.weather.update(dt, time, env);

    return env;
  }
}
