import * as THREE from 'three';
import { ATTR_COMPONENTS, ROOT_COMPONENTS } from './bladeFormat';
import bladeVert from './shaders/blade.vert.glsl?raw';
import bladeFrag from './shaders/blade.frag.glsl?raw';
import bgVert from './shaders/background.vert.glsl?raw';
import bgFrag from './shaders/background.frag.glsl?raw';

/** One tapered strip per blade: (segments + 1) rows × 2 vertices. */
export function createBladeGeometry(roots: Uint16Array, attrs: Uint8Array, count: number, segments = 4) {
  const geo = new THREE.InstancedBufferGeometry();
  const pos: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pos.push(-0.5, t, 0, 0.5, t, 0);
  }
  const idx: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = 2 * i;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);

  geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(roots, ROOT_COMPONENTS, true));
  const buf = new THREE.InstancedInterleavedBuffer(attrs, ATTR_COMPONENTS, 1);
  geo.setAttribute('aA', new THREE.InterleavedBufferAttribute(buf, 4, 0, true));
  geo.setAttribute('aB', new THREE.InterleavedBufferAttribute(buf, 4, 4, true));
  geo.setAttribute('aC', new THREE.InterleavedBufferAttribute(buf, 4, 8, true));
  geo.instanceCount = count;
  return geo;
}

export function createBladeMaterial(
  photo: THREE.Texture,
  field: THREE.Texture,
  light: THREE.Texture,
  ramp: THREE.Texture,
  shapes: THREE.Texture,
  imageSize: THREE.Vector2,
  lenMax: number,
  widthMax: number,
  tuftReach: number,
) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: bladeVert,
    fragmentShader: bladeFrag,
    uniforms: {
      uPhoto: { value: photo },
      uImageToClip: { value: new THREE.Matrix3() },
      uImageSize: { value: imageSize },
      uLenMax: { value: lenMax },
      uWidthMax: { value: widthMax },
      uPhase: { value: 0 },
      uLenScale: { value: 1 },
      uWidthScale: { value: 1 },
      uJitter: { value: 0 },
      uDensity: { value: 1 },
      uRootShade: { value: 0.8 },
      uSheen: { value: 0 },
      uLightDir: { value: new THREE.Vector2(0, 1) },
      uField: { value: field },
      uLight: { value: light },
      uRamp: { value: ramp },
      uBaked: { value: 0.3 },
      uShapes: { value: shapes },
      uTuftSpread: { value: 0 },
      uTuftPull: { value: 0 },
      uMinWidth: { value: 1 },
      uTuftDepth: { value: 0 },
      uBladeTone: { value: 0 },
      uTuftReach: { value: tuftReach },
      uTuftMix: { value: 1 },
      uTuftGain: { value: 0 },
      uTuftLag: { value: 0 },
      uClumpGain: { value: 0 },
      uClumpLag: { value: 0 },
      uFlutter: { value: 0 },
    },
    // Solid blades in a depth buffer, as in games: what lies over what comes from each blade's
    // height, and hidden fragments are never shaded.
    blending: THREE.NoBlending,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
}

export function createBackground(
  photo: THREE.Texture,
  light: THREE.Texture,
  ramp: THREE.Texture,
  shapes: THREE.Texture,
  imageSize: THREE.Vector2,
  priorDeg: number,
) {
  const geo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  const a = (priorDeg * Math.PI) / 180;
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: bgVert,
    fragmentShader: bgFrag,
    uniforms: {
      uPhoto: { value: photo },
      uImageToClip: { value: new THREE.Matrix3() },
      uImageSize: { value: imageSize },
      uLight: { value: light },
      uRamp: { value: ramp },
      uShapes: { value: shapes },
      uDim: { value: 0.75 },
      uPriorDir: { value: new THREE.Vector2(Math.cos(a), Math.sin(a)) },
    },
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
