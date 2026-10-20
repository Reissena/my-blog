// ---------------------------------------------------------------------------
// snow.js — soft instanced snowfall (zero CPU per-frame particle updates)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mulberry32 } from './toon.js';

const COUNT = 2200;
const HEIGHT = 16;

export function createSnow(scene) {
  const rnd = mulberry32(4411);
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.instanceCount = COUNT;

  const offsets = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    offsets[i * 3] = (rnd() - 0.5) * 28;
    offsets[i * 3 + 1] = rnd() * HEIGHT;
    offsets[i * 3 + 2] = (rnd() - 0.5) * 28;
    speeds[i] = 0.45 + rnd() * 0.85;
    sizes[i] = 0.04 + rnd() * 0.06;
    phases[i] = rnd() * Math.PI * 2;
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: HEIGHT },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aOffset;
      attribute float aSpeed;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uHeight;
      varying float vAlpha;
      varying vec2 vLocal;
      void main() {
        float fall = mod( aOffset.y - uTime * aSpeed, uHeight );
        float sway = sin( uTime * 0.45 + aPhase ) * 0.4 + sin( uTime * 0.19 + aPhase * 2.1 ) * 0.22;
        vec3 world = vec3( aOffset.x + sway, fall, aOffset.z + cos( uTime * 0.32 + aPhase ) * 0.25 );
        vec4 mv = modelViewMatrix * vec4( world, 1.0 );
        mv.x += position.x * aSize;
        mv.y += position.y * aSize;
        gl_Position = projectionMatrix * mv;
        vLocal = position.xy;
        vAlpha = smoothstep( 0.0, 0.9, fall ) * ( 1.0 - smoothstep( uHeight - 2.0, uHeight, fall ) );
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying float vAlpha;
      varying vec2 vLocal;
      void main() {
        float d = length( vLocal );
        float a = smoothstep( 0.5, 0.06, d ) * vAlpha * uOpacity;
        if ( a < 0.008 ) discard;
        gl_FragColor = vec4( 0.92, 0.96, 1.0, a );
      }`,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  const group = new THREE.Group();
  group.name = 'snow';
  group.visible = false;
  group.add(mesh);
  scene.add(group);

  function setAmount(v) {
    const a = Math.max(0, Math.min(1, v));
    mat.uniforms.uOpacity.value = a * 0.9;
    group.visible = a > 0.008;
  }
  function update(time) {
    mat.uniforms.uTime.value = time;
  }
  setAmount(0);

  return { group, setAmount, update };
}