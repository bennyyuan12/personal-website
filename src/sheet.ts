import * as THREE from 'three';
import type { Params } from './params';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import sheetFrag from './shaders/sheet.frag.glsl?raw';

const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;
/** Pointer speed (world heights per second) that counts as a full-strength gust. */
const FULL_SPEED = 0.9;
/** How long the pointer's wind keeps blowing after it stops (time constant, seconds). */
const POINTER_DECAY = 0.3;
/** Seconds after the last pointer move during which the grass may still be moving from it. */
const POINTER_LINGER = 4;

function target(width: number, height: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    count: 2,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
}

/**
 * How the whole field is lying: bend, plus a memory of where the grass has come to rest.
 *
 * The grass keeps what the wind does to it, so what you see at any moment is only a function of
 * the recent gusts. Once every spot has been crossed by a gust, the state no longer depends on
 * how it started, and with a looping wind it repeats with the loop. A pointer trail stays until
 * a later gust blows through it.
 */
export class GrassSheet {
  private readonly targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private current = 0;
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();

  private pointer: THREE.Vector2 | null = null; // height units
  private brushStart: THREE.Vector2 | null = null;
  private readonly pointerLean = new THREE.Vector2();
  private pointerPress = 0;
  private accumulator = 0;
  private sincePointer = Infinity;

  constructor(
    width: number,
    height: number,
    private readonly aspect: number,
    wind: THREE.Texture,
  ) {
    this.targets = [target(width, height), target(width, height)];
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: sheetFrag,
      uniforms: {
        uPrev: { value: null },
        uPrevMemory: { value: null },
        uWind: { value: wind },
        uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
        uAspect: { value: aspect },
        uDt: { value: STEP_SECONDS },
        uStiffness: { value: 1 },
        uCoupling: { value: 1 },
        uDamping: { value: 1 },
        uLagRate: { value: 0.1 },
        uYield: { value: 0.3 },
        uSet: { value: 0.2 },
        uCalm: { value: 0.04 },
        uBrushA: { value: new THREE.Vector2() },
        uBrushB: { value: new THREE.Vector2() },
        uRadius: { value: 0.1 },
        uPointerLean: { value: new THREE.Vector2() },
        uPointerPress: { value: 0 },
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

  get stateTexture() {
    return this.targets[this.current].textures[0];
  }

  get memoryTexture() {
    return this.targets[this.current].textures[1];
  }

  /** True while something the pointer did may still be moving. */
  get pointerActive() {
    return this.sincePointer < POINTER_LINGER;
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

  clear(renderer: THREE.WebGLRenderer) {
    const color = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const t of this.targets) {
      renderer.setRenderTarget(t);
      renderer.clear();
    }
    renderer.setClearColor(color, alpha);
  }

  /** Advance the sheet by `seconds`, in fixed steps. */
  advance(renderer: THREE.WebGLRenderer, camera: THREE.Camera, seconds: number, p: Params) {
    const moved = this.pointer && this.brushStart ? this.pointer.distanceTo(this.brushStart) : 0;
    if (p.touch && moved > 1e-5) {
      const velocity = this.pointer!.clone().sub(this.brushStart!).divideScalar(Math.max(seconds, 1 / 240));
      // The pointer is wind: it blows the way it's going, and faster swipes blow harder.
      const strength = Math.min(1, velocity.length() / FULL_SPEED);
      this.pointerLean.lerp(velocity.normalize().multiplyScalar(p.touchForce), 0.6);
      this.pointerPress += (strength - this.pointerPress) * 0.6;
      this.sincePointer = 0;
    } else {
      this.pointerPress *= Math.exp(-seconds / POINTER_DECAY);
      this.sincePointer += seconds;
    }

    const u = this.material.uniforms;
    u.uStiffness.value = p.stiffness;
    u.uCoupling.value = p.coupling;
    u.uDamping.value = p.damping;
    u.uLagRate.value = 1 - Math.exp(-STEP_SECONDS / Math.max(p.lagTime, 1e-3));
    u.uYield.value = p.yield;
    u.uSet.value = p.setRate;
    u.uCalm.value = p.calm;
    u.uRadius.value = p.touchRadius;
    u.uPointerLean.value.copy(this.pointerLean);
    u.uPointerPress.value = this.pointerPress;
    const end = this.pointer ?? this.brushStart ?? u.uBrushB.value;
    u.uBrushA.value.copy(this.brushStart ?? end);
    u.uBrushB.value.copy(end);

    this.accumulator = Math.min(this.accumulator + seconds, MAX_STEPS_PER_FRAME * STEP_SECONDS);
    while (this.accumulator >= STEP_SECONDS) {
      this.accumulator -= STEP_SECONDS;
      const next = 1 - this.current;
      u.uPrev.value = this.targets[this.current].textures[0];
      u.uPrevMemory.value = this.targets[this.current].textures[1];
      renderer.setRenderTarget(this.targets[next]);
      renderer.render(this.scene, camera);
      this.current = next;
    }
    if (this.pointer) this.brushStart = this.pointer.clone();
  }
}
