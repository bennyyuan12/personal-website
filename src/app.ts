import * as THREE from 'three';
import { CellPass, createCdfTexture, createRampTexture } from './ascii';
import type { BladeMeta } from './bladeFormat';
import { createBackground, createBladeGeometry, createBladeMaterial } from './blades';
import { ATTR_COMPONENTS, ROOT_COMPONENTS } from './bladeFormat';
import { FieldPass, SurfacePass } from './field';
import { buildGlyphAtlas, SDF_RADIUS, type GlyphAtlas } from './glyphs';
import { VIEW_MODES, type Params } from './params';
import { TIERS, type Tier } from './quality';
import { GrassSheet } from './sheet';
import { computeView, type Rotation } from './view';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';
import displayFrag from './shaders/display.frag.glsl?raw';

const asset = (name: string) => `${import.meta.env.BASE_URL}grass/${name}`;

export interface Viewport {
  width: number; // CSS px
  height: number;
  dpr: number;
}

export interface App {
  renderer: THREE.WebGLRenderer;
  /** Move the grass on by `seconds`, feeling the wind at params.phase. */
  advance(seconds: number): void;
  /** Run the grass for `seconds` up to params.phase, so it arrives on its repeating cycle. */
  settle(seconds: number): void;
  /** Render the grass as it stands. */
  draw(): void;
  /** Pointer position in CSS px, or null when it leaves. */
  pointer(x: number | null, y?: number): void;
  /** True while something the pointer did may still be moving. */
  readonly pointerActive: boolean;
  /** Re-read the window size (or keep a fixed viewport, e.g. for capture). */
  resize(): void;
  setFixedViewport(viewport: Viewport | null): void;
  readonly tier: Tier;
  setTier(tier: Tier): void;
  rebuildGlyphs(): Promise<void>;
  setSchools(): void;
  compile(): Promise<void>;
  /** Internals for debugging in the console (dev only). */
  debug: Record<string, unknown>;
}

export async function createApp(
  canvas: HTMLCanvasElement,
  params: Params,
  options: { tier: Tier; preserveDrawingBuffer?: boolean },
): Promise<App> {
  const [meta, bin, photo, firstAtlas] = await Promise.all([
    fetch(asset('meta.json')).then((r) => r.json() as Promise<BladeMeta>),
    fetch(asset('blades.bin')).then((r) => r.arrayBuffer()),
    new THREE.TextureLoader().loadAsync(asset('world.jpg')),
    buildGlyphAtlas(params.ramp),
  ]);
  let atlas: GlyphAtlas = firstAtlas;
  let tier = options.tier;
  let fixedViewport: Viewport | null = null;
  const roots = new Uint16Array(bin, 0, meta.count * ROOT_COMPONENTS);
  const attrs = new Uint8Array(bin, meta.count * ROOT_COMPONENTS * 2, meta.count * ATTR_COMPONENTS);

  // Keep the photo's raw sRGB values: "at rest" should reproduce the photo exactly.
  photo.colorSpace = THREE.NoColorSpace;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  renderer.setClearColor(0x000000, 1);
  photo.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const imageSize = new THREE.Vector2(meta.imageWidth, meta.imageHeight);
  const camera = new THREE.Camera(); // unused: shaders do their own projection

  // ---- wind: looping field + mouse wind → final push and lighting ----
  const aspect = meta.imageWidth / meta.imageHeight;
  const field = new FieldPass(aspect, (meta.priorAngleDeg * Math.PI) / 180);
  field.setSchools(params);
  const surface = new SurfacePass(field);
  const sheet = new GrassSheet(field.size.x, field.size.y, aspect, field.texture);

  // ---- blade pass → MRT (color, direction) ----
  const target = new THREE.WebGLRenderTarget(1, 1, {
    count: 2,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
  const ramp = createRampTexture(meta.lumRamp);
  const background = createBackground(photo, surface.lightTexture, ramp, imageSize, meta.priorAngleDeg);
  background.renderOrder = 0;
  const bladeMat = createBladeMaterial(
    photo,
    surface.fieldTexture,
    surface.lightTexture,
    ramp,
    imageSize,
    meta.lenMax,
    meta.widthMax,
    meta.tuftReach,
  );
  const blades = new THREE.Mesh(createBladeGeometry(roots, attrs, meta.count, TIERS[tier].segments), bladeMat);
  blades.frustumCulled = false;
  blades.renderOrder = 1;
  const bladeScene = new THREE.Scene();
  bladeScene.add(background, blades);

  // ---- cell pass: one texel per ASCII cell ----
  const cells = new CellPass(target.textures[0], target.textures[1]);

  // ---- display pass (ASCII composite) → screen ----
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const displayMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: fullscreenVert,
    fragmentShader: displayFrag,
    uniforms: {
      uColor: { value: target.textures[0] },
      uDir: { value: target.textures[1] },
      uPhoto: { value: photo },
      uField: { value: surface.fieldTexture },
      uLight: { value: surface.lightTexture },
      uCellColor: { value: cells.colorTexture },
      uCellDir: { value: cells.dirTexture },
      uAtlas: { value: atlas.texture },
      uCdf: { value: createCdfTexture(meta.lumCdf) },
      uClipToUV: { value: new THREE.Matrix3() },
      uView: { value: 0 },
      uSplit: { value: 0.5 },
      uResolution: { value: new THREE.Vector2() },
      uViewportCss: { value: new THREE.Vector2() },
      uCell: { value: 10 },
      uGlyphCount: { value: atlas.count },
      uAtlasLod: { value: 0 },
      uAA: { value: 0.1 },
      uThin: { value: 0.8 },
      uBold: { value: 0.5 },
      uDither: { value: 0 },
      uBlend: { value: 0 },
      uGain: { value: 1 },
      uUnderlay: { value: 0 },
      uGlow: { value: 0 },
      uExposure: { value: 1 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uTint: { value: new THREE.Vector3(0.98, 1, 0.86) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const display = new THREE.Mesh(tri, displayMat);
  display.frustumCulled = false;
  const displayScene = new THREE.Scene();
  displayScene.add(display);

  const viewport = new THREE.Vector2(1, 1);
  const clipToUV = new THREE.Matrix3();

  function resize() {
    const w = fixedViewport?.width ?? window.innerWidth;
    const h = fixedViewport?.height ?? window.innerHeight;
    if (w <= 0 || h <= 0) return; // hidden or collapsed: keep the last good view until it returns
    const dpr = fixedViewport?.dpr ?? Math.min(window.devicePixelRatio, TIERS[tier].dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const scale = Math.min(dpr, TIERS[tier].bladeScale) * params.renderScale;
    target.setSize(Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale)));
    viewport.set(w, h);
    const du = displayMat.uniforms;
    du.uResolution.value.set(w * dpr, h * dpr);
    du.uViewportCss.value.set(w, h);

    const rotation: Rotation = params.rotate === 'auto' ? (w > h ? 90 : 0) : (Number(params.rotate) as Rotation);
    const view = computeView(w, h, meta.imageWidth, meta.imageHeight, rotation, params.zoom);
    bladeMat.uniforms.uImageToClip.value.copy(view.imageToClip);
    // Keep blades at least ~1.7 render px wide at their base, whatever the zoom.
    bladeMat.uniforms.uMinWidth.value = 1.7 / (view.scale * scale);
    (background.material as THREE.RawShaderMaterial).uniforms.uImageToClip.value.copy(view.imageToClip);
    du.uClipToUV.value.copy(view.clipToUV);

    clipToUV.copy(view.clipToUV);

    // ASCII grid: square cells, a whole number of device px so glyphs stay crisp. The atlas is
    // sampled at the mip level that matches, and the edge ramp is sized to ~1 device px.
    const cellDevice = Math.max(3, Math.round(params.cellSize * dpr));
    const cell = cellDevice / dpr;
    cells.resize(w, h, cell, (rotation * Math.PI) / 180);
    const tilePerDevicePx = atlas.tile / cellDevice;
    du.uCell.value = cell;
    du.uAtlasLod.value = Math.max(0, Math.log2(tilePerDevicePx) - 0.5);
    du.uAA.value = (0.5 * tilePerDevicePx) / SDF_RADIUS;
  }

  function draw() {
    const u = bladeMat.uniforms;
    u.uPhase.value = params.phase;
    u.uLenScale.value = params.lenScale;
    u.uWidthScale.value = params.widthScale;
    u.uJitter.value = params.jitter;
    u.uDensity.value = params.density * TIERS[tier].density;
    u.uRootShade.value = params.rootShade;
    u.uSheen.value = params.sheen;
    const la = (params.lightAngle * Math.PI) / 180;
    u.uLightDir.value.set(Math.cos(la), Math.sin(la));
    u.uFollow.value = params.follow;
    u.uRootTurn.value = params.rootTurn;
    u.uTuftMix.value = params.tuftMix;
    u.uTuftGain.value = params.tuftGain;
    u.uTuftLag.value = params.tuftLag;
    u.uClumpGain.value = params.clumpGain;
    u.uClumpLag.value = params.clumpLag;
    u.uFlutter.value = params.flutter;
    u.uTuftSpread.value = params.tuftSpread;
    u.uBaked.value = params.baked;
    u.uTuftDepth.value = params.tuftDepth;
    u.uBladeTone.value = params.bladeTone;
    const bu = (background.material as THREE.RawShaderMaterial).uniforms;
    bu.uBaked.value = params.baked;
    bu.uDim.value = params.bgDim;
    const du = displayMat.uniforms;
    du.uView.value = VIEW_MODES.indexOf(params.view);
    du.uSplit.value = params.split;
    du.uThin.value = params.thin;
    du.uBold.value = params.bold;
    du.uDither.value = params.dither;
    du.uBlend.value = params.blend;
    du.uGain.value = params.gain;
    du.uUnderlay.value = params.underlay;
    du.uGlow.value = params.glow;
    du.uExposure.value = params.exposure;
    du.uContrast.value = params.contrast;
    du.uSaturation.value = params.saturation;

    surface.render(renderer, camera, params, sheet.stateTexture, sheet.memoryTexture);
    renderer.setRenderTarget(target);
    renderer.render(bladeScene, camera);
    cells.render(renderer, camera);
    renderer.setRenderTarget(null);
    renderer.render(displayScene, camera);
  }

  resize();
  sheet.clear(renderer);

  return {
    renderer,
    draw,
    resize,
    pointer(x, y = 0) {
      if (x === null) {
        sheet.lift();
        return;
      }
      if (viewport.x <= 1 || viewport.y <= 1) return;
      const uv = new THREE.Vector3((2 * x) / viewport.x - 1, 1 - (2 * y) / viewport.y, 1).applyMatrix3(clipToUV);
      sheet.move(uv.x, uv.y);
    },
    get pointerActive() {
      return sheet.pointerActive;
    },
    advance(seconds) {
      field.render(renderer, camera, params);
      sheet.advance(renderer, camera, seconds, params);
    },
    settle(seconds) {
      const end = params.phase;
      const hop = 1 / 15;
      const hops = Math.ceil(seconds / hop);
      // Stops one hop short: the caller's first advance() is the step that lands on `end`.
      for (let i = hops; i >= 1; i--) {
        params.phase = (end - (i * hop) / params.loopSeconds + 8) % 1;
        field.render(renderer, camera, params);
        sheet.advance(renderer, camera, hop, params);
      }
      params.phase = end;
    },
    setFixedViewport(viewport) {
      fixedViewport = viewport;
      resize();
    },
    get tier() {
      return tier;
    },
    setTier(next) {
      if (next === tier) return;
      const segmentsChanged = TIERS[next].segments !== TIERS[tier].segments;
      tier = next;
      if (segmentsChanged) {
        const old = blades.geometry;
        blades.geometry = createBladeGeometry(roots, attrs, meta.count, TIERS[tier].segments);
        old.dispose();
      }
      resize();
    },
    async rebuildGlyphs() {
      const next = await buildGlyphAtlas(params.ramp || ' ');
      atlas.texture.dispose();
      atlas = next;
      displayMat.uniforms.uAtlas.value = atlas.texture;
      displayMat.uniforms.uGlyphCount.value = atlas.count;
      resize();
    },
    setSchools() {
      field.setSchools(params);
    },
    async compile() {
      // Compile up front so the first frame isn't drawn with programs still compiling.
      await renderer.compileAsync(bladeScene, camera);
      await renderer.compileAsync(displayScene, camera);
    },
    debug: { cells, target, field, surface, sheet },
  };
}
