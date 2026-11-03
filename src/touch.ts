import * as THREE from 'three';
import type { Params } from './params';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import touchFrag from './shaders/touch.frag.glsl?raw';

const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 3;
/** Pointer speed (world heights per second) that counts as a full-strength gust. */
const FULL_SPEED = 0.9;
/** How long the wind keeps blowing after the pointer stops (time constant, seconds). */
const FORCE_DECAY = 0.3;
/** Seconds without input before the sheet is cleared and the sim stops running. */
const SLEEP_AFTER = 9;

/**
 * Mouse wind: a small spring sheet over the world, driven by pointer movement.
 *
 * This is the only stateful part of the renderer. It sits on top of the looping wind and
 * settles to exactly zero, then stops running, so the seamless loop is untouched when nobody
 * is interacting.
 */
export class TouchPass {
  private readonly targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private current = 0;
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();

  private pointer: THREE.Vector2 | null = null; // height units
  private brushStart: THREE.Vector2 | null = null;
  private readonly force = new THREE.Vector2();
  private accumulator = 0;
  private idleSeconds = Infinity;
  private needsClear = true;

  constructor(
    width: number,
    height: number,
    private readonly aspect: number,
  ) {
    const make = () =>
      new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
      });
    this.targets = [make(), make()];
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: touchFrag,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
        uAspect: { value: aspect },
        uDt: { value: STEP_SECONDS },
        uStiffness: { value: 1 },
        uCoupling: { value: 1 },
        uDamping: { value: 1 },
        uBrushA: { value: new THREE.Vector2() },
        uBrushB: { value: new THREE.Vector2() },
        uRadius: { value: 0.1 },
        uForce: { value: new THREE.Vector2() },
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
    return this.targets[this.current].texture;
  }

  /** True while the sheet may still be moving. */
  get active() {
    return this.idleSeconds < SLEEP_AFTER;
  }

  /** Pointer position in world UV (y-up). */
  move(u: number, v: number) {
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

  /** Advance the sheet. Returns true if it needs drawing. */
  update(renderer: THREE.WebGLRenderer, camera: THREE.Camera, seconds: number, p: Params) {
    if (this.needsClear) {
      this.clear(renderer);
      this.needsClear = false;
    }
    if (!p.touch) return false;

    const moved =
      this.pointer && this.brushStart ? this.pointer.distanceTo(this.brushStart) : 0;
    if (moved > 1e-5) {
      const velocity = this.pointer!.clone().sub(this.brushStart!).divideScalar(Math.max(seconds, 1 / 240));
      const speed = velocity.length();
      // Wind blows the way the pointer is going; faster swipes blow harder.
      const strength = Math.min(1, speed / FULL_SPEED) * p.touchForce;
      this.force.lerp(velocity.normalize().multiplyScalar(strength), 0.6);
      this.idleSeconds = 0;
    } else {
      this.force.multiplyScalar(Math.exp(-seconds / FORCE_DECAY));
      this.idleSeconds += seconds;
    }
    if (!this.active) {
      if (this.idleSeconds !== Infinity) {
        this.idleSeconds = Infinity;
        this.clear(renderer);
        return true; // one last frame to show the cleared sheet
      }
      return false;
    }

    const u = this.material.uniforms;
    u.uStiffness.value = p.touchStiffness;
    u.uCoupling.value = p.touchCoupling;
    u.uDamping.value = p.touchDamping;
    u.uRadius.value = p.touchRadius;
    u.uForce.value.copy(this.force);
    const end = this.pointer ?? this.brushStart ?? u.uBrushB.value;
    u.uBrushA.value.copy(this.brushStart ?? end);
    u.uBrushB.value.copy(end);

    this.accumulator = Math.min(this.accumulator + seconds, MAX_STEPS_PER_FRAME * STEP_SECONDS);
    while (this.accumulator >= STEP_SECONDS) {
      this.accumulator -= STEP_SECONDS;
      const next = 1 - this.current;
      u.uPrev.value = this.targets[this.current].texture;
      renderer.setRenderTarget(this.targets[next]);
      renderer.render(this.scene, camera);
      this.current = next;
    }
    if (this.pointer) this.brushStart = this.pointer.clone();
    return true;
  }

  private clear(renderer: THREE.WebGLRenderer) {
    const color = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const target of this.targets) {
      renderer.setRenderTarget(target);
      renderer.clear();
    }
    renderer.setClearColor(color, alpha);
  }
}
