import type { Quality } from './quality';

export type ViewMode = 'ascii' | 'blades' | 'photo' | 'split' | 'direction' | 'field' | 'light';
export type RotateMode = 'auto' | '0' | '90' | '-90';

// Order matches uView in display.frag.glsl.
export const VIEW_MODES: ViewMode[] = ['ascii', 'blades', 'photo', 'split', 'direction', 'field', 'light'];

/** Dark → bright, ordered by measured ink coverage in JetBrains Mono. Leading space = empty. */
export const DEFAULT_RAMP = " .':;!|lI";

export interface Params {
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
  bgLod: number;
  bgDim: number;
  // wind
  windHeading: number;
  breeze: number;
  gust: number;
  ripple: number;
  schoolAmount: number;
  relief: number;
  crestGlow: number;
  // mouse wind
  touch: boolean;
  touchForce: number;
  touchRadius: number;
  touchGain: number;
  touchDent: number;
  touchSheen: number;
  touchFlat: number;
  touchStiffness: number;
  touchCoupling: number;
  touchDamping: number;
  // school field
  follow: number;
  rootTurn: number;
  drift: number;
  lag: number;
  schools: number;
  schoolSeed: number;
  headingSpread: number;
  radiusScale: number;
  sharpness: number;
  waveSpeed: number;
  swing: number;
  restWeight: number;
  curl: number;
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
    view: 'ascii',
    split: 0.5,
    rotate: '0',
    zoom: 1.02,
    quality: 'auto',
    renderScale: 1,
    lenScale: 1,
    widthScale: 1,
    jitter: 0.12,
    density: 1,
    rootShade: 0.78,
    sheen: 0.35,
    lightAngle: 120,
    bgLod: 2.5,
    bgDim: 0.6,
    windHeading: 155,
    breeze: 0.12,
    gust: 0.8,
    ripple: 0.3,
    schoolAmount: 0.45,
    relief: 1.6,
    crestGlow: 0.14,
    touch: !reducedMotion,
    touchForce: 18,
    touchRadius: 0.15,
    touchGain: 1.7,
    touchDent: 1.8,
    touchSheen: 0.22,
    touchFlat: 0.55,
    touchStiffness: 7,
    touchCoupling: 2400,
    touchDamping: 1.8,
    follow: 1.15,
    rootTurn: 0.55,
    drift: 2,
    lag: 0.025,
    schools: 7,
    schoolSeed: 7,
    headingSpread: 1.0,
    radiusScale: 0.85,
    sharpness: 3,
    waveSpeed: 2.5,
    swing: 1,
    restWeight: 0.12,
    curl: 0.35,
    curlScale: 2.5,
    curlPeriod: 2,
    ramp: DEFAULT_RAMP,
    cellSize: 5,
    thin: 0.7,
    bold: 0.38,
    dither: 0.6,
    blend: 0.25,
    gain: 1.36,
    underlay: 0.84,
    glow: 0.12,
    exposure: 1.45,
    contrast: 0.9,
    saturation: 1.4,
    loopSeconds: 24,
    paused: reducedMotion,
    phase: 0,
    gui: true,
  };
}

/** Debug overrides, e.g. ?view=split&phase=0.25&paused=1&gui=0 */
export function applyUrlParams(p: Params) {
  const q = new URLSearchParams(location.search);
  const num = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const view = q.get('view');
  if (view && (VIEW_MODES as string[]).includes(view)) p.view = view as ViewMode;
  const rot = q.get('rot');
  if (rot === 'auto' || rot === '0' || rot === '90' || rot === '-90') p.rotate = rot;
  const numeric = [
    'split', 'zoom', 'renderScale', 'lenScale', 'widthScale', 'jitter', 'density', 'rootShade', 'sheen',
    'phase', 'loopSeconds', 'follow', 'rootTurn', 'drift', 'lag', 'schools', 'schoolSeed', 'headingSpread',
    'radiusScale', 'sharpness', 'waveSpeed', 'swing', 'restWeight', 'curl', 'curlScale', 'curlPeriod',
    'cellSize', 'thin', 'bold', 'dither', 'blend', 'gain', 'underlay', 'glow', 'exposure', 'contrast', 'saturation',
    'windHeading', 'breeze', 'gust', 'ripple', 'schoolAmount', 'relief', 'crestGlow',
    'touchForce', 'touchRadius', 'touchGain', 'touchDent', 'touchSheen', 'touchFlat', 'touchStiffness',
    'touchCoupling', 'touchDamping',
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
