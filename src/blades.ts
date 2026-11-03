import * as THREE from 'three';
import { BLADE_STRIDE } from './bladeFormat';
import bladeVert from './shaders/blade.vert.glsl?raw';
import bladeFrag from './shaders/blade.frag.glsl?raw';
import bgVert from './shaders/background.vert.glsl?raw';
import bgFrag from './shaders/background.frag.glsl?raw';

/** One tapered strip per blade: (segments + 1) rows × 2 vertices. */
export function createBladeGeometry(data: Uint16Array, count: number, segments = 4) {
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

  const buf = new THREE.InstancedInterleavedBuffer(data, BLADE_STRIDE, 1);
  geo.setAttribute('aA', new THREE.InterleavedBufferAttribute(buf, 4, 0, true));
  geo.setAttribute('aB', new THREE.InterleavedBufferAttribute(buf, 4, 4, true));
  geo.setAttribute('aC', new THREE.InterleavedBufferAttribute(buf, 2, 8, true));
  geo.instanceCount = count;
  return geo;
}

export function createBladeMaterial(
  photo: THREE.Texture,
  field: THREE.Texture,
  imageSize: THREE.Vector2,
  lenMax: number,
  widthMax: number,
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
      uFollow: { value: 1 },
      uRootTurn: { value: 0.5 },
      uDrift: { value: 0 },
    },
    // Premultiplied "over"; instances blend in buffer order (dark → bright).
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function createBackground(photo: THREE.Texture, imageSize: THREE.Vector2, priorDeg: number) {
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
      uLod: { value: 2.5 },
      uDim: { value: 0.6 },
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
