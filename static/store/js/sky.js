// ---------------------------------------------------------------------------
// sky.js — 程序化天空穹顶（渐变 / 云层 / 日月 / 星空） + 环境反射贴图
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { canvasTexture, rand } from './util.js';

const VERT = "varying vec3 vDir;\nvoid main() {\n  vDir = (modelMatrix * vec4(position, 1.0)).xyz;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}";

const FRAG = "uniform vec3 uTop;\nuniform vec3 uHorizon;\nuniform vec3 uBottom;\nuniform vec3 uSunDir;\nuniform vec3 uSunColor;\nuniform vec3 uCloudColor;\nuniform vec3 uCloudShade;\nuniform float uSunGlow;\nuniform float uCloud;\nuniform float uStar;\nuniform float uTime;\nuniform float uFlash;\nuniform float uHaze;\n\nvarying vec3 vDir;\n\nfloat hash21(vec2 p) {\n  p = fract(p * vec2(123.34, 456.21));\n  p += dot(p, p + 45.32);\n  return fract(p.x * p.y);\n}\n\nfloat vnoise(vec2 p) {\n  vec2 i = floor(p);\n  vec2 f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = hash21(i);\n  float b = hash21(i + vec2(1.0, 0.0));\n  float c = hash21(i + vec2(0.0, 1.0));\n  float d = hash21(i + vec2(1.0, 1.0));\n  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);\n}\n\nfloat fbm(vec2 p) {\n  float v = 0.0;\n  float a = 0.5;\n  for (int i = 0; i < 5; i++) {\n    v += a * vnoise(p);\n    p = p * 2.03 + 17.1;\n    a *= 0.5;\n  }\n  return v;\n}\n\nvoid main() {\n  vec3 dir = normalize(vDir);\n  float h = dir.y;\n  float t = pow(clamp(h, 0.0, 1.0), 0.62);\n  vec3 col = mix(uHorizon, uTop, t);\n  col = mix(col, uBottom, (1.0 - smoothstep(-0.22, 0.02, h)));\n\n  float sd = max(dot(dir, normalize(uSunDir)), 0.0);\n  col += uSunColor * (pow(sd, 6.0) * 0.10 + pow(sd, 42.0) * 0.16) * uSunGlow;\n  col += uSunColor * pow(sd, 900.0) * 1.6 * uSunGlow;\n\n  float horizonMask = smoothstep(0.015, 0.22, h);\n  vec2 cp = dir.xz / max(h + 0.16, 0.16);\n  cp = cp * 1.15 + vec2(uTime * 0.0055, uTime * 0.0027);\n  float n = fbm(cp * 1.25);\n  float n2 = fbm(cp * 2.8 + 9.4);\n  float density = n * 0.72 + n2 * 0.28;\n  float thresh = mix(0.78, 0.26, clamp(uCloud, 0.0, 1.0));\n  float cloudMask = smoothstep(thresh, thresh + 0.24, density);\n  cloudMask *= horizonMask * smoothstep(0.0, 0.28, h + 0.05);\n  float lit = smoothstep(0.35, 0.95, density);\n  vec3 cloudCol = mix(uCloudShade, uCloudColor, lit) * 0.92;\n  cloudCol += uSunColor * pow(sd, 8.0) * 0.35 * (0.4 + uSunGlow * 0.6);\n  col = mix(col, cloudCol, clamp(cloudMask, 0.0, 1.0) * 0.92);\n\n  float haze = pow(1.0 - clamp(h, 0.0, 1.0), 7.0);\n  col = mix(col, uHorizon + uHaze * 0.02, haze * 0.55);\n\n  if (uStar > 0.01 && uCloud < 0.85) {\n    vec2 sp = floor(dir.xz * 240.0 / max(0.25, 1.0 - abs(h) * 0.5));\n    float s = hash21(sp);\n    float star = smoothstep(0.9965, 1.0, s) * smoothstep(0.65, 0.98, h);\n    star *= (0.55 + 0.45 * sin(uTime * 1.7 + s * 40.0));\n    star *= uStar * (1.0 - uCloud * 0.85);\n    col += vec3(0.86, 0.92, 1.0) * star * 1.5;\n  }\n\n  col += uFlash * vec3(0.58, 0.66, 0.9) * 0.55;\n\n  gl_FragColor = vec4(col, 1.0);\n}";

function discTexture(inner, outer) {
  return canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.32, inner);
    g.addColorStop(0.55, outer);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

export function createSky(ctx) {
  const group = new THREE.Group();
  group.name = 'sky';
  ctx.scene.add(group);

  const uniforms = {
    uTop: { value: new THREE.Color(0x0a1430) },
    uHorizon: { value: new THREE.Color(0x1c2a45) },
    uBottom: { value: new THREE.Color(0x05070f) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
    uSunColor: { value: new THREE.Color(0xffd0a0) },
    uCloudColor: { value: new THREE.Color(0x2a3550) },
    uCloudShade: { value: new THREE.Color(0x0c1220) },
    uSunGlow: { value: 0.4 },
    uCloud: { value: 0.5 },
    uStar: { value: 0.4 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uHaze: { value: 0.2 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 32), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  const starCount = 900;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand(0, Math.PI * 2);
    const y = rand(0.04, 1);
    const r = Math.sqrt(1 - y * y);
    starPositions[i * 3] = Math.cos(theta) * r * 290;
    starPositions[i * 3 + 1] = y * 290;
    starPositions[i * 3 + 2] = Math.sin(theta) * r * 290;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdce8ff, size: 1.7, sizeAttenuation: false, transparent: true,
    opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  const sunSpriteMat = new THREE.SpriteMaterial({
    map: discTexture('rgba(255,248,230,1)', 'rgba(255,196,120,0.55)'),
    transparent: true, opacity: 0.9, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending, color: 0xffe6c0,
  });
  const sunSprite = new THREE.Sprite(sunSpriteMat);
  sunSprite.scale.set(58, 58, 1);
  group.add(sunSprite);

  const moonSpriteMat = new THREE.SpriteMaterial({
    map: discTexture('rgba(232,240,255,1)', 'rgba(150,180,255,0.35)'),
    transparent: true, opacity: 0, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending, color: 0xdce8ff,
  });
  const moonSprite = new THREE.Sprite(moonSpriteMat);
  moonSprite.scale.set(26, 26, 1);
  group.add(moonSprite);

  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), material);
  envDome.frustumCulled = false;
  envScene.add(envDome);
  const pmrem = new THREE.PMREMGenerator(ctx.renderer);
  let envRT = null;
  let envDirty = true;
  let envTimer = 0;

  function refreshEnv() {
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0, 0.1, 100);
    ctx.scene.environment = envRT.texture;
    ctx.envMap = envRT.texture;
    envDirty = false;
  }
  refreshEnv();

  return {
    group,
    uniforms,
    stars,
    sunSprite,
    moonSprite,
    markEnvDirty() { envDirty = true; envTimer = 0.35; },
    update(dt, time, env) {
      uniforms.uTime.value = time;
      uniforms.uTop.value.copy(env.skyTop);
      uniforms.uHorizon.value.copy(env.skyHorizon);
      uniforms.uBottom.value.copy(env.skyBottom);
      uniforms.uSunColor.value.copy(env.sunColor);
      uniforms.uSunDir.value.copy(env.sunDir);
      uniforms.uSunGlow.value = env.sunGlow;
      uniforms.uCloud.value = env.cloud;
      uniforms.uCloudColor.value.copy(env.cloudColor);
      uniforms.uCloudShade.value.copy(env.cloudShade);
      uniforms.uStar.value = env.star;
      uniforms.uFlash.value = env.flash;
      uniforms.uHaze.value = env.haze;

      sunSprite.position.copy(env.sunDir).multiplyScalar(255);
      moonSprite.position.copy(env.moonDir).multiplyScalar(255);
      sunSpriteMat.color.copy(env.celestialColor);
      sunSpriteMat.opacity = env.sunOpacity;
      sunSprite.scale.setScalar(env.sunSize);
      moonSpriteMat.opacity = env.moonOpacity;
      moonSprite.scale.setScalar(env.moonSize);

      stars.material.opacity = env.star * 0.9;

      if (envDirty) {
        envTimer -= dt;
        if (envTimer <= 0) refreshEnv();
      }
    },
    refreshEnv,
  };
}
