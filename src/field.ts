import * as THREE from 'three';
import type { Params } from './params';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import noiseGlsl from './shaders/noise.glsl?raw';
import fieldFragSrc from './shaders/field.frag.glsl?raw';
import surfaceFrag from './shaders/surface.frag.glsl?raw';

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

function fullscreenMesh(material: THREE.RawShaderMaterial) {
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mesh = new THREE.Mesh(tri, material);
  mesh.frustumCulled = false;
  return mesh;
}

function fieldTarget(width: number, height: number, count: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    count,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
}

/** Texels along the world's height; fine enough for the wind ripples. */
const FIELD_HEIGHT = 224;

/**
 * The stateless, looping wind. Rendered every frame into a small texture laid over the world
 * (image UV, y-up): only a function of the loop phase, so frame N always equals frame 0.
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
    this.target = fieldTarget(Math.round(FIELD_HEIGHT * aspect), FIELD_HEIGHT, 1);
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: fieldFrag,
      uniforms: {
        uPhase: { value: 0 },
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
        uCurlScale: { value: 1 },
        uCurlPeriod: { value: 2 },
        uSchoolAmount: { value: 1 },
        uWindDir: { value: new THREE.Vector2(1, 0) },
        uBreeze: { value: 0 },
        uGust: { value: 0 },
        uGustCells: { value: 2 },
        uGustCross: { value: 1 },
        uGustTrips: { value: 1 },
        uGustDetail: { value: 0 },
        uGustEdge: { value: 0.4 },
        uGustTurn: { value: 0 },
        uPressAt: { value: 0.5 },
        uRipple: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(fullscreenMesh(this.material));
  }

  get texture() {
    return this.target.textures[0];
  }

  get size() {
    return new THREE.Vector2(this.target.width, this.target.height);
  }

  /** Lay out the schools. Deterministic for a given seed and count. */
  setSchools(p: Params) {
    const rand = mulberry32(p.schoolSeed);
    const count = Math.max(1, Math.min(MAX_SCHOOLS, Math.round(p.schools)));
    for (let k = 0; k < MAX_SCHOOLS; k++) {
      // Stratify along the long axis so every part of the world has a school nearby.
      const cx = ((k + 0.2 + 0.6 * rand()) / count) * this.aspect;
      const cy = 0.15 + 0.7 * rand();
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
    u.uRadiusScale.value = p.radiusScale;
    u.uSharpness.value = p.sharpness;
    u.uWaveSpeed.value = p.waveSpeed;
    u.uRestWeight.value = p.restWeight;
    u.uAmpScale.value = p.swing;
    u.uCurlScale.value = p.curlScale;
    u.uCurlPeriod.value = Math.max(1, Math.round(p.curlPeriod));
    u.uSchoolAmount.value = p.schoolAmount;
    const heading = (p.windHeading * Math.PI) / 180;
    u.uWindDir.value.set(Math.cos(heading), Math.sin(heading));
    u.uBreeze.value = p.breeze;
    u.uGust.value = p.gust;
    u.uGustCells.value = p.gustCells;
    u.uGustCross.value = p.gustCross;
    u.uGustTrips.value = Math.max(1, Math.round(p.gustTrips));
    u.uGustDetail.value = p.gustDetail;
    u.uGustEdge.value = p.gustEdge;
    u.uGustTurn.value = p.gustTurn;
    u.uPressAt.value = p.pressAt;
    u.uRipple.value = p.ripple;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera);
  }
}

/** Turns the bend of the grass into the final field and its lighting. */
export class SurfacePass {
  readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();

  constructor(field: FieldPass) {
    const size = field.size;
    this.target = fieldTarget(size.x, size.y, 2);
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: surfaceFrag,
      uniforms: {
        uSheet: { value: null },
        uMemory: { value: null },
        uTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) },
        uLightDir: { value: new THREE.Vector2(0, 1) },
        uTilt: { value: 0 },
        uRelief: { value: 0 },
        uShimmer: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(fullscreenMesh(this.material));
  }

  get fieldTexture() {
    return this.target.textures[0];
  }

  get lightTexture() {
    return this.target.textures[1];
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, p: Params, sheet: THREE.Texture, memory: THREE.Texture) {
    const u = this.material.uniforms;
    u.uSheet.value = sheet;
    u.uMemory.value = memory;
    const la = (p.lightAngle * Math.PI) / 180;
    u.uLightDir.value.set(Math.cos(la), Math.sin(la));
    u.uTilt.value = p.tilt;
    u.uRelief.value = p.relief;
    u.uShimmer.value = p.shimmer;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera);
  }
}
