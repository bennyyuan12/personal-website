import GUI from 'lil-gui';
import { VIEW_MODES, type Params } from './params';

export interface Stats {
  fps: number;
  frameMs: number;
  tier: string;
}

export function createGui(
  p: Params,
  stats: Stats,
  on: { resize: () => void; scrub: () => void; schools: () => void; ramp: () => void; quality: () => void },
) {
  const gui = new GUI({ title: 'grass' });
  gui.add(stats, 'fps').listen().disable().decimals(0);
  gui.add(stats, 'frameMs').name('frame ms').listen().disable().decimals(1);
  gui.add(stats, 'tier').name('active tier').listen().disable();
  gui.add(p, 'quality', ['auto', 'high', 'medium', 'low']).onChange(on.quality);

  const view = gui.addFolder('View');
  view.add(p, 'view', VIEW_MODES);
  view.add(p, 'split', 0, 1, 0.01);
  view.add(p, 'rotate', ['auto', '0', '90', '-90']).onChange(on.resize);
  view.add(p, 'zoom', 1, 3, 0.01).onChange(on.resize);
  view.add(p, 'renderScale', 0.5, 2, 0.25).name('render scale').onChange(on.resize);

  const ascii = gui.addFolder('ASCII');
  ascii.add(p, 'ramp').name('ramp (dark→bright)').onFinishChange(on.ramp);
  ascii.add(p, 'cellSize', 5, 32, 1).name('cell (px)').onChange(on.resize);
  ascii.add(p, 'thin', 0.5, 0.98, 0.01).name('dark stroke edge');
  ascii.add(p, 'bold', 0.1, 0.8, 0.01).name('bright stroke edge');
  ascii.add(p, 'dither', 0, 2, 0.01);
  ascii.add(p, 'blend', 0, 1, 0.01).name('glyph blend');
  ascii.add(p, 'gain', 0.3, 2.5, 0.01).name('ink brightness');
  ascii.add(p, 'underlay', 0, 1.2, 0.01).name('grass underlay');
  ascii.add(p, 'glow', 0, 1.5, 0.01);

  const color = gui.addFolder('Color');
  color.add(p, 'exposure', 0.5, 2.5, 0.01);
  color.add(p, 'contrast', 0.6, 2.2, 0.01);
  color.add(p, 'saturation', 0, 2.5, 0.01);

  const wind = gui.addFolder('Wind');
  wind.add(p, 'windHeading', 0, 360, 1).name('heading');
  wind.add(p, 'breeze', 0, 1, 0.01);
  wind.add(p, 'gust', 0, 2, 0.01);
  wind.add(p, 'ripple', 0, 1.5, 0.01);
  wind.add(p, 'relief', 0, 6, 0.01).name('light relief');
  wind.add(p, 'crestGlow', 0, 1, 0.01).name('crest glow');

  const touch = gui.addFolder('Mouse wind');
  touch.add(p, 'touch').name('enabled');
  touch.add(p, 'touchForce', 0, 80, 1).name('force');
  touch.add(p, 'touchRadius', 0.02, 0.4, 0.005).name('radius');
  touch.add(p, 'touchGain', 0, 3, 0.01).name('push on blades');
  touch.add(p, 'touchDent', 0, 2, 0.01).name('dent depth');
  touch.add(p, 'touchSheen', 0, 1.5, 0.01).name('light from lean');
  touch.add(p, 'touchFlat', 0, 1, 0.01).name('flattened glow');
  touch.add(p, 'touchStiffness', 1, 40, 0.5).name('spring');
  touch.add(p, 'touchCoupling', 200, 6000, 50).name('ripple speed');
  touch.add(p, 'touchDamping', 0.2, 10, 0.1).name('damping');

  const loop = gui.addFolder('Loop');
  loop.add(p, 'paused');
  loop.add(p, 'phase', 0, 1, 0.001).listen().onChange(on.scrub);
  loop.add(p, 'loopSeconds', 4, 60, 1).name('loop seconds');

  const school = gui.addFolder('School field');
  school.add(p, 'schoolAmount', 0, 1.5, 0.01).name('amount');
  school.add(p, 'follow', 0, 2.5, 0.01).name('wind response');
  school.add(p, 'rootTurn', 0, 1, 0.01).name('root turn');
  school.add(p, 'drift', 0, 8, 0.1).name('drift (px)');
  school.add(p, 'lag', 0, 0.1, 0.001).name('straggler lag');
  school.add(p, 'schools', 1, 8, 1).onChange(on.schools);
  school.add(p, 'schoolSeed', 1, 99, 1).name('seed').onChange(on.schools);
  school.add(p, 'headingSpread', 0, 1.5, 0.01).name('heading spread').onChange(on.schools);
  school.add(p, 'radiusScale', 0.3, 2.5, 0.01).name('school size');
  school.add(p, 'sharpness', 0.3, 6, 0.1).name('edge sharpness');
  school.add(p, 'waveSpeed', 0.5, 10, 0.1).name('turn wave speed');
  school.add(p, 'swing', 0, 2, 0.01).name('swing');
  school.add(p, 'restWeight', 0, 1, 0.01).name('calm areas');
  school.add(p, 'curl', 0, 1.5, 0.01).name('swirl');
  school.add(p, 'curlScale', 0.5, 8, 0.1).name('swirl scale');
  school.add(p, 'curlPeriod', 1, 6, 1).name('swirl speed');

  const blades = gui.addFolder('Blades');
  blades.add(p, 'density', 0.05, 1, 0.01);
  blades.add(p, 'lenScale', 0.3, 3, 0.01).name('length');
  blades.add(p, 'widthScale', 0.3, 3, 0.01).name('width');
  blades.add(p, 'jitter', 0, 1.5, 0.01).name('sway (rad)');
  blades.add(p, 'rootShade', 0.2, 1, 0.01).name('root shade');
  blades.add(p, 'sheen', 0, 1.5, 0.01);
  blades.add(p, 'lightAngle', 0, 360, 1).name('light angle');

  const bg = gui.addFolder('Background');
  bg.add(p, 'bgLod', 0, 6, 0.1).name('blur (mip)');
  bg.add(p, 'bgDim', 0, 1, 0.01).name('brightness');

  gui.close();
  return gui;
}
