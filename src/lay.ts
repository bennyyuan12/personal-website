import * as THREE from 'three';
import type { Params } from './params';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import noiseGlsl from './shaders/noise.glsl?raw';
import layFragSrc from './shaders/lay.frag.glsl?raw';

export const MAX_NESTS = 12;

/** How the grass lies with no wind at all. Redrawn only when things on the ground move. */
export class LayPass {
  readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly nests = Array.from({ length: MAX_NESTS }, () => new THREE.Vector4());

  constructor(aspect: number) {
    this.target = new THREE.WebGLRenderTarget(Math.round(292 * aspect), 292, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: layFragSrc.replace('#pragma include noise', noiseGlsl),
      uniforms: {
        uAspect: { value: aspect },
        uWindDir: { value: new THREE.Vector2(1, 0) },
        uLayScale: { value: 2 },
        uLayDrift: { value: 0.5 },
        uCount: { value: 0 },
        uNests: { value: this.nests },
        uNestSpread: { value: 2 },
        uNestTwist: { value: 0.8 },
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

  /** nests: x, y, half width, half height, in height units. */
  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, p: Params, nests: THREE.Vector4[]) {
    const u = this.material.uniforms;
    const heading = (p.windHeading * Math.PI) / 180;
    u.uWindDir.value.set(Math.cos(heading), Math.sin(heading));
    u.uLayScale.value = p.layScale;
    u.uLayDrift.value = p.layDrift;
    u.uNestSpread.value = p.nestSpread;
    u.uNestTwist.value = p.nestTwist;
    const count = Math.min(MAX_NESTS, nests.length);
    u.uCount.value = count;
    for (let i = 0; i < count; i++) this.nests[i].copy(nests[i]);
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera);
    renderer.setRenderTarget(null);
  }
}
