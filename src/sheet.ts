import * as THREE from 'three';
import type { Params } from './params';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import sheetFrag from './shaders/sheet.frag.glsl?raw';

const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;

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
 * how it started, and with a looping wind it repeats with the loop. What the pointer's air lays
 * over stays that way until a later gust blows through it.
 */
export class GrassSheet {
  private readonly targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private current = 0;
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  private accumulator = 0;

  constructor(width: number, height: number, wind: THREE.Texture, lay: THREE.Texture) {
    this.targets = [target(width, height), target(width, height)];
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: sheetFrag,
      uniforms: {
        uPrev: { value: null },
        uPrevMemory: { value: null },
        uWind: { value: wind },
        uLay: { value: lay },
        uAir: { value: null },
        uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
        uDt: { value: STEP_SECONDS },
        uStiffness: { value: 1 },
        uCoupling: { value: 1 },
        uDamping: { value: 1 },
        uLagRate: { value: 0.1 },
        uYield: { value: 0.3 },
        uSet: { value: 0.2 },
        uCalm: { value: 0.04 },
        uWindDir: { value: new THREE.Vector2(1, 0) },
        uSway: { value: 0 },
        uAirLean: { value: 1 },
        uAirFull: { value: 0.2 },
        uAirStiffness: { value: 0 },
        uRegrow: { value: 0 },
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
  advance(renderer: THREE.WebGLRenderer, camera: THREE.Camera, seconds: number, p: Params, air: THREE.Texture) {
    const u = this.material.uniforms;
    u.uStiffness.value = p.stiffness;
    u.uCoupling.value = p.coupling;
    u.uDamping.value = p.damping;
    u.uLagRate.value = 1 - Math.exp(-STEP_SECONDS / Math.max(p.lagTime, 1e-3));
    u.uYield.value = p.yield;
    u.uSet.value = p.setRate;
    u.uCalm.value = p.calm;
    const heading = (p.windHeading * Math.PI) / 180;
    u.uWindDir.value.set(Math.cos(heading), Math.sin(heading));
    u.uSway.value = p.sway;
    u.uAir.value = air;
    u.uAirLean.value = p.airLean;
    u.uAirFull.value = p.airFull;
    u.uAirStiffness.value = p.airStiffness;
    u.uRegrow.value = p.regrow;

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
  }
}
