import * as THREE from 'three';
import type { Params } from './params';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import noiseGlsl from './shaders/noise.glsl?raw';
import fieldFragSrc from './shaders/field.frag.glsl?raw';

export const MAX_SCHOOLS = 8;
const TAU = Math.PI * 2;

const fieldFrag = fieldFragSrc.replace('#pragma include noise', noiseGlsl);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The direction field the blades follow. Rendered every frame into a small texture laid
 * over the photo (image UV, y-up), so it rotates with the photo on landscape screens.
 */
export class FieldPass {
  readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly s0 = Array.from({ length: MAX_SCHOOLS }, () => new THREE.Vector4());
  private readonly s1 = Array.from({ length: MAX_SCHOOLS }, () => new THREE.Vector4());
  private readonly s2 = Array.from({ length: MAX_SCHOOLS }, () => new THREE.Vector4());
  private readonly s3 = Array.from({ length: MAX_SCHOOLS }, () => new THREE.Vector4());

  constructor(
    private readonly aspect: number,
    private readonly priorRad: number,
  ) {
    // ~4 image px per texel for the 640×1050 photo; bilinear filtering smooths the rest.
    this.target = new THREE.WebGLRenderTarget(160, Math.round(160 / aspect), {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: fieldFrag,
      uniforms: {
        uPhase: { value: 0 },
        uLag: { value: 0 },
        uAspect: { value: aspect },
        uCount: { value: 0 },
        uS0: { value: this.s0 },
        uS1: { value: this.s1 },
        uS2: { value: this.s2 },
        uS3: { value: this.s3 },
        uRadiusScale: { value: 1 },
        uSharpness: { value: 1 },
        uWaveSpeed: { value: 1 },
        uRestWeight: { value: 0.1 },
        uAmpScale: { value: 1 },
        uCurl: { value: 0 },
        uCurlScale: { value: 1 },
        uCurlPeriod: { value: 2 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mesh = new THREE.Mesh(tri, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  get texture() {
    return this.target.texture;
  }

  /** Lay out the schools. Deterministic for a given seed and count. */
  setSchools(p: Params) {
    const rand = mulberry32(p.schoolSeed);
    const count = Math.max(1, Math.min(MAX_SCHOOLS, Math.round(p.schools)));
    for (let k = 0; k < MAX_SCHOOLS; k++) {
      // Stratify along the tall axis so every part of the photo has a school nearby.
      const cy = (k + 0.2 + 0.6 * rand()) / count;
      const cx = (0.15 + 0.7 * rand()) * this.aspect;
      this.s0[k].set(cx, cy, 0.05 + 0.15 * rand(), 0.05 + 0.2 * rand());
      this.s1[k].set(1 + Math.floor(rand() * 2), 1 + Math.floor(rand() * 2), rand() * TAU, rand() * TAU);
      this.s2[k].set(
        0.16 + 0.18 * rand(), // radius (image heights)
        this.priorRad + (rand() * 2 - 1) * p.headingSpread, // base heading
        0.5 + 0.8 * rand(), // swing amplitude (rad)
        1 + Math.floor(rand() * 2), // swings per loop
      );
      // School 0 leads one full sweep per loop.
      const spin = k === 0 ? (rand() < 0.5 ? -1 : 1) : 0;
      this.s3[k].set(rand() * TAU, spin, 1 + Math.floor(rand() * 2), rand() * TAU);
    }
    this.material.uniforms.uCount.value = count;
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, p: Params) {
    const u = this.material.uniforms;
    u.uPhase.value = p.phase;
    u.uLag.value = p.lag;
    u.uRadiusScale.value = p.radiusScale;
    u.uSharpness.value = p.sharpness;
    u.uWaveSpeed.value = p.waveSpeed;
    u.uRestWeight.value = p.restWeight;
    u.uAmpScale.value = p.swing;
    u.uCurl.value = p.curl;
    u.uCurlScale.value = p.curlScale;
    u.uCurlPeriod.value = Math.max(1, Math.round(p.curlPeriod));
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera);
  }
}
