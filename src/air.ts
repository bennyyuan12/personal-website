import * as THREE from 'three';
import type { Params } from './params';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import advectFrag from './shaders/air-advect.frag.glsl?raw';
import divergenceFrag from './shaders/air-divergence.frag.glsl?raw';
import pressureFrag from './shaders/air-pressure.frag.glsl?raw';
import gradientFrag from './shaders/air-gradient.frag.glsl?raw';

const GRID_HEIGHT = 72;
const PRESSURE_ITERATIONS = 14;
/** Heights per second: a swipe faster than this doesn't blow any harder. */
const TOP_SPEED = 2.4;
/** How long the pointer keeps blowing after it stops (time constant, seconds). */
const BLOW_DECAY = 0.15;
/** Seconds after the last push during which the air may still be moving. */
const LINGER = 5;

function target(width: number, height: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: false,
  });
}

export interface Hold {
  u: number;
  v: number;
  /** Height units. */
  radius: number;
  /** Per second, like Params.touchForce. */
  strength: number;
}

/**
 * The pointer's wind: real moving air on a small grid (Stam's stable fluids). A swipe drags air
 * along, the air keeps going after the pointer has passed, rolls into eddies at its sides, and
 * dies away. The looping wind stays separate, so with nobody touching the grass the field still
 * loops exactly.
 */
export class Air {
  private readonly velocity: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readonly pressure: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readonly divergence: THREE.WebGLRenderTarget;
  private readonly advect: THREE.RawShaderMaterial;
  private readonly diverge: THREE.RawShaderMaterial;
  private readonly solve: THREE.RawShaderMaterial;
  private readonly subtract: THREE.RawShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly holds = [new THREE.Vector4(), new THREE.Vector4()];
  private readonly push = new THREE.Vector2();
  private readonly spot = new THREE.Vector2();
  private current = 0;
  private currentPressure = 0;
  private pointer: THREE.Vector2 | null = null; // height units
  private brushStart: THREE.Vector2 | null = null;
  private blow = 0;
  private sincePush = Infinity;

  constructor(private readonly aspect: number) {
    const width = Math.round(GRID_HEIGHT * aspect);
    const height = GRID_HEIGHT;
    this.velocity = [target(width, height), target(width, height)];
    this.pressure = [target(width, height), target(width, height)];
    this.divergence = target(width, height);
    const texel = new THREE.Vector2(1 / width, 1 / height);
    const dx = 1 / height;
    const material = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: fullscreenVert,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    this.advect = material(advectFrag, {
      uVelocity: { value: null },
      uAspect: { value: aspect },
      uDt: { value: 1 / 60 },
      uFade: { value: 1 },
      uBrushA: { value: new THREE.Vector2() },
      uBrushB: { value: new THREE.Vector2() },
      uPush: { value: this.push },
      uDrag: { value: 0 },
      uRadius: { value: 0.1 },
    });
    this.diverge = material(divergenceFrag, {
      uVelocity: { value: null },
      uTexel: { value: texel },
      uDx: { value: dx },
      uAspect: { value: aspect },
      uSpot: { value: this.spot },
      uBlow: { value: 0 },
      uRadius: { value: 0.1 },
      uHolds: { value: this.holds },
    });
    this.solve = material(pressureFrag, {
      uPressure: { value: null },
      uDivergence: { value: this.divergence.texture },
      uTexel: { value: texel },
      uDx: { value: dx },
    });
    this.subtract = material(gradientFrag, {
      uVelocity: { value: null },
      uPressure: { value: null },
      uTexel: { value: texel },
      uDx: { value: dx },
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.mesh = new THREE.Mesh(tri, this.advect);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /** XY: air velocity, heights per second. */
  get texture() {
    return this.velocity[this.current].texture;
  }

  /** True while the air may still be moving. */
  get active() {
    return this.sincePush < LINGER || this.holds.some((h) => h.w > 0);
  }

  /** Pointer position in world UV (y-up). */
  move(u: number, v: number) {
    if (!Number.isFinite(u) || !Number.isFinite(v)) return;
    const next = new THREE.Vector2(u * this.aspect, v);
    if (!this.pointer) {
      this.pointer = next;
      this.brushStart = next.clone();
      return;
    }
    this.pointer.copy(next);
  }

  /** The pointer left, so the next move shouldn't draw a stroke across the whole world. */
  lift() {
    this.pointer = null;
    this.brushStart = null;
  }

  /** Keep air landing on a spot, or stop with null. */
  setHold(slot: number, hold: Hold | null) {
    if (hold) this.holds[slot].set(hold.u * this.aspect, hold.v, hold.radius, hold.strength);
    else this.holds[slot].set(0, 0, 0, 0);
  }

  private draw(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    material: THREE.RawShaderMaterial,
    output: THREE.WebGLRenderTarget,
  ) {
    this.mesh.material = material;
    renderer.setRenderTarget(output);
    renderer.render(this.scene, camera);
  }

  step(renderer: THREE.WebGLRenderer, camera: THREE.Camera, seconds: number, p: Params) {
    const dt = Math.min(Math.max(seconds, 1 / 240), 1 / 30);
    const moved = this.pointer && this.brushStart ? this.pointer.distanceTo(this.brushStart) : 0;
    const swiping = p.touch && moved > 1e-5;
    let drag = 0;
    if (swiping) {
      this.push.copy(this.pointer!).sub(this.brushStart!).divideScalar(dt);
      const speed = this.push.length();
      if (speed > TOP_SPEED) this.push.multiplyScalar(TOP_SPEED / speed);
      this.blow = Math.max(this.blow, 0.5 + 0.5 * Math.min(1, speed / TOP_SPEED));
      drag = 0.4;
      this.sincePush = 0;
    } else {
      this.blow *= Math.exp(-dt / BLOW_DECAY);
      this.sincePush += dt;
    }
    if (!this.active) return; // still air: nothing here needs working out

    const end = this.pointer ?? this.brushStart ?? this.spot;
    this.spot.copy(end);

    const a = this.advect.uniforms;
    a.uVelocity.value = this.velocity[this.current].texture;
    a.uDt.value = dt;
    a.uFade.value = Math.exp(-dt / p.airFade);
    a.uBrushA.value.copy(this.brushStart ?? end);
    a.uBrushB.value.copy(end);
    a.uDrag.value = drag;
    a.uRadius.value = p.touchRadius;
    this.draw(renderer, camera, this.advect, this.velocity[1 - this.current]);
    this.current = 1 - this.current;

    const d = this.diverge.uniforms;
    d.uVelocity.value = this.velocity[this.current].texture;
    d.uBlow.value = this.blow * p.touchForce;
    d.uRadius.value = p.touchRadius;
    this.draw(renderer, camera, this.diverge, this.divergence);

    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      this.solve.uniforms.uPressure.value = this.pressure[this.currentPressure].texture;
      this.draw(renderer, camera, this.solve, this.pressure[1 - this.currentPressure]);
      this.currentPressure = 1 - this.currentPressure;
    }

    const g = this.subtract.uniforms;
    g.uVelocity.value = this.velocity[this.current].texture;
    g.uPressure.value = this.pressure[this.currentPressure].texture;
    this.draw(renderer, camera, this.subtract, this.velocity[1 - this.current]);
    this.current = 1 - this.current;

    if (this.pointer) this.brushStart = this.pointer.clone();
  }
}
