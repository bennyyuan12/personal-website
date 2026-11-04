import { applyPreset, findPreset } from './presets';
import type { Quality } from './quality';

export type ViewMode = 'ascii' | 'blades' | 'photo' | 'split' | 'direction' | 'field' | 'light';
export type RotateMode = 'auto' | '0' | '90' | '-90';

// Order matches uView in display.frag.glsl.
export const VIEW_MODES: ViewMode[] = ['ascii', 'blades', 'photo', 'split', 'direction', 'field', 'light'];

/** Dark → bright, ordered by measured ink coverage in JetBrains Mono. Leading space = empty. */
export const DEFAULT_RAMP = " .':;!|lI";

export interface Params {
  /** Id of the motion version in use (see presets.ts). */
  preset: string;
  view: ViewMode;
  split: number;
  rotate: RotateMode;
  zoom: number;
  quality: Quality;
  /** Multiplies the quality tier's blade pass resolution. */
  renderScale: number;
  lenScale: number;
  widthScale: number;
  jitter: number;
  density: number;
  rootShade: number;
  sheen: number;
  lightAngle: number;
  bgDim: number;
  // wind
  windHeading: number;
  breeze: number;
  gust: number;
  ripple: number;
  schoolAmount: number;
  gustCells: number;
  gustCross: number;
  gustTrips: number;
  gustDetail: number;
  gustEdge: number;
  gustTurn: number;
  pressAt: number;
  // how the grass responds
  stiffness: number;
  damping: number;
  coupling: number;
  lagTime: number;
  yield: number;
  setRate: number;
  calm: number;
  tuftMix: number;
  tuftGain: number;
  tuftLag: number;
  clumpGain: number;
  clumpLag: number;
  flutter: number;
  tuftSpread: number;
  tuftPull: number;
  // light from how the grass is lying
  baked: number;
  tuftDepth: number;
  bladeTone: number;
  tilt: number;
  relief: number;
  shimmer: number;
  // mouse wind
  touch: boolean;
  touchForce: number;
  touchRadius: number;
  /** Air seconds: how long the pointer's air keeps moving. */
  airFade: number;
  /** Lean per unit of air speed. */
  airLean: number;
  /** Air speed (heights per second) that has the grass entirely in its grip. */
  airFull: number;
  airStiffness: number;
  /** Per second: how quickly grass rises back toward its lay on its own. */
  regrow: number;
  // the steady rhythm of the wind
  sway: number;
  rhythmCells: number;
  rhythmA: number;
  rhythmB: number;
  // the lay of the grass
  layScale: number;
  layDrift: number;
  nestSpread: number;
  nestTwist: number;
  // school field
  schools: number;
  schoolSeed: number;
  headingSpread: number;
  radiusScale: number;
  sharpness: number;
  waveSpeed: number;
  swing: number;
  restWeight: number;
  curlScale: number;
  curlPeriod: number;
  // ascii layer
  ramp: string;
  cellSize: number;
  thin: number;
  bold: number;
  dither: number;
  blend: number;
  gain: number;
  underlay: number;
  /** Under the letters: 0 one flat color per cell, 1 every blade. */
  grain: number;
  groundShade: number;
  glow: number;
  // color
  exposure: number;
  contrast: number;
  saturation: number;
  loopSeconds: number;
  paused: boolean;
  phase: number;
  gui: boolean;
}

export function defaultParams(): Params {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    preset: 'c',
    view: 'ascii',
    split: 0.5,
    rotate: '0',
    zoom: 1.02,
    quality: 'auto',
    renderScale: 1,
    lenScale: 1,
    widthScale: 1,
    jitter: 0.03,
    density: 1,
    rootShade: 0.42,
    sheen: 0.12,
    lightAngle: 72,
    bgDim: 0.5,
    // The motion values below are overwritten by the chosen preset.
    windHeading: -18,
    breeze: 0.2,
    gust: 1.5,
    ripple: 0.08,
    schoolAmount: 0.14,
    gustCells: 1.3,
    gustCross: 0.55,
    gustTrips: 1,
    gustDetail: 0.22,
    gustEdge: 0.5,
    gustTurn: 1,
    pressAt: 0.74,
    stiffness: 12,
    damping: 3.2,
    coupling: 300,
    lagTime: 0.45,
    yield: 0.3,
    setRate: 0.2,
    calm: 0.012,
    tuftMix: 0.7,
    tuftGain: 0.22,
    tuftLag: 0.45,
    clumpGain: 0.2,
    clumpLag: 0.35,
    flutter: 0.05,
    tuftSpread: 0.4,
    tuftPull: 0.45,
    baked: 0.25,
    tuftDepth: 0.55,
    bladeTone: 0.34,
    tilt: 0.55,
    relief: 0.9,
    shimmer: 0.1,
    // Reduced motion still answers the pointer: nothing moves on its own, and the visitor still
    // has to be able to find what's under the grass.
    touch: true,
    touchForce: 16,
    touchRadius: 0.085,
    airFade: 0.7,
    airLean: 2.4,
    airFull: 0.32,
    airStiffness: 70,
    regrow: 0.02,
    sway: 0.3,
    rhythmCells: 1.5,
    rhythmA: 12,
    rhythmB: 19,
    layScale: 1.45,
    layDrift: 0.55,
    nestSpread: 3,
    nestTwist: 0.55,
    schools: 7,
    schoolSeed: 7,
    headingSpread: 1.0,
    radiusScale: 0.85,
    sharpness: 3,
    waveSpeed: 2.5,
    swing: 1,
    restWeight: 0.12,
    curlScale: 2.5,
    curlPeriod: 2,
    ramp: DEFAULT_RAMP,
    cellSize: 7,
    thin: 0.7,
    bold: 0.38,
    dither: 0.6,
    blend: 0.25,
    gain: 1.3,
    underlay: 0.8,
    grain: 0.62,
    groundShade: 0.38,
    glow: 0.12,
    exposure: 1.08,
    contrast: 0.92,
    saturation: 1.02,
    loopSeconds: 48,
    paused: reducedMotion,
    phase: 0,
    gui: import.meta.env.DEV, // ?gui=1 brings the tuning panel back on a build
  };
}

/** Debug overrides, e.g. ?view=split&phase=0.25&paused=1&gui=0 */
export function applyUrlParams(p: Params) {
  const q = new URLSearchParams(location.search);
  const preset = findPreset(q.get('preset')) ?? findPreset(p.preset);
  if (preset) applyPreset(p, preset);
  const num = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const view = q.get('view');
  if (view && (VIEW_MODES as string[]).includes(view)) p.view = view as ViewMode;
  const rot = q.get('rot');
  if (rot === 'auto' || rot === '0' || rot === '90' || rot === '-90') p.rotate = rot;
  const numeric = [
    'split', 'zoom', 'renderScale', 'lenScale', 'widthScale', 'jitter', 'density', 'rootShade', 'sheen',
    'phase', 'loopSeconds', 'schools', 'schoolSeed', 'headingSpread',
    'radiusScale', 'sharpness', 'waveSpeed', 'swing', 'restWeight', 'curlScale', 'curlPeriod',
    'bgDim', 'cellSize', 'thin', 'bold', 'dither', 'blend', 'gain', 'underlay', 'grain', 'groundShade', 'glow', 'exposure', 'contrast', 'saturation',
    'windHeading', 'breeze', 'gust', 'ripple', 'schoolAmount', 'baked', 'tuftDepth', 'bladeTone', 'tilt', 'relief', 'shimmer', 'lightAngle',
    'gustCells', 'gustCross', 'gustTrips', 'gustDetail', 'gustEdge', 'gustTurn', 'pressAt',
    'stiffness', 'damping', 'coupling', 'lagTime', 'yield', 'setRate', 'calm',
    'tuftMix', 'tuftGain', 'tuftLag', 'clumpGain', 'clumpLag', 'flutter', 'tuftSpread', 'tuftPull',
    'touchForce', 'touchRadius', 'airFade', 'airLean', 'airFull', 'airStiffness', 'regrow',
    'sway', 'rhythmCells', 'rhythmA', 'rhythmB', 'layScale', 'layDrift', 'nestSpread', 'nestTwist',
  ] as const;
  for (const k of numeric) {
    const v = num(k);
    if (v !== undefined && Number.isFinite(v)) p[k] = v;
  }
  const ramp = q.get('ramp');
  if (ramp) p.ramp = ramp;
  const quality = q.get('quality');
  if (quality === 'auto' || quality === 'high' || quality === 'medium' || quality === 'low') p.quality = quality;
  if (q.has('paused')) p.paused = q.get('paused') !== '0';
  if (q.has('gui')) p.gui = q.get('gui') !== '0';
}
