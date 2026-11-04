import * as THREE from 'three';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import cellFrag from './shaders/cell.frag.glsl?raw';

/** 256-entry luminance CDF of the photo as a 1D texture, for histogram equalization. */
export function createCdfTexture(cdf: number[]) {
  const data = new Uint8Array(256);
  for (let i = 0; i < 256; i++) data[i] = Math.round((cdf[i] ?? 1) * 255);
  const tex = new THREE.DataTexture(data, 256, 1, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

/** The image's color at each brightness, as a 1D texture. */
export function createRampTexture(ramp: number[]) {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round((ramp[i * 3 + c] ?? 0) * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Averages the blade render into one texel per ASCII cell (color + direction). */
export class CellPass {
  readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  cols = 1;
  rows = 1;

  constructor(color: THREE.Texture, dir: THREE.Texture) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      count: 2,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      // Letters read exact cells with texelFetch; only the soft shadow on drawings uses the filter.
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: cellFrag,
      uniforms: {
        uColor: { value: color },
        uDir: { value: dir },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uCell: { value: 10 },
        uViewRotation: { value: 0 },
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

  get colorTexture() {
    return this.target.textures[0];
  }

  get dirTexture() {
    return this.target.textures[1];
  }

  resize(viewportW: number, viewportH: number, cell: number, viewRotationRad: number) {
    this.cols = Math.max(1, Math.ceil(viewportW / cell));
    this.rows = Math.max(1, Math.ceil(viewportH / cell));
    this.target.setSize(this.cols, this.rows);
    const u = this.material.uniforms;
    u.uViewport.value.set(viewportW, viewportH);
    u.uCell.value = cell;
    u.uViewRotation.value = viewRotationRad;
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera);
  }
}
