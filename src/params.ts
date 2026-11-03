import type { Quality } from './quality';

export type ViewMode = 'ascii' | 'blades' | 'photo' | 'split' | 'direction' | 'field';
export type RotateMode = 'auto' | '0' | '90' | '-90';

// Order matches uView in display.frag.glsl.
export const VIEW_MODES: ViewMode[] = ['ascii', 'blades', 'photo', 'split', 'direction', 'field'];

/** Dark → bright, ordered by measured ink coverage in JetBrains Mono. Leading space = empty. */
export const DEFAULT_RAMP = " .':;!|lI";

export interface Params {
  view: ViewMode;
  split: number;
  rotate: RotateMode;
  zoom: number;
  quality: Quality;
  /** Blade pass resolution in CSS px multiples. 1 is plenty under the ASCII layer. */
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
  lift: number;
  underlay: number;
  glow: number;
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
    rotate: 'auto',
    zoom: 1.04,
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
    follow: 1,
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
    cellSize: 12,
    thin: 0.68,
    bold: 0.3,
    dither: 0.6,
    blend: 0.25,
    gain: 1.15,
    lift: 0.95,
    underlay: 0.2,
    glow: 0.35,
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
    'cellSize', 'thin', 'bold', 'dither', 'blend', 'gain', 'lift', 'underlay', 'glow',
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
