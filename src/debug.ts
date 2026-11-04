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
  wind.add(p, 'breeze', 0, 1, 0.01).name('resting lean');
  wind.add(p, 'gust', 0, 2, 0.01).name('gust lean');
  wind.add(p, 'gustCells', 0.5, 6, 0.05).name('gust size (lower = wider)');
  wind.add(p, 'gustCross', 0.2, 3, 0.05).name('front length (lower = longer)');
  wind.add(p, 'gustTrips', 1, 4, 1).name('gust speed');
  wind.add(p, 'gustDetail', 0, 1, 0.01).name('small features');
  wind.add(p, 'gustEdge', 0.1, 1, 0.01).name('gust softness');
  wind.add(p, 'gustTurn', 0, 2, 0.01).name('gusts differ in direction');
  wind.add(p, 'pressAt', 0.1, 0.9, 0.01).name('strength that moves grass');

  const response = gui.addFolder('Grass response');
  response.add(p, 'yield', 0.02, 1.5, 0.01).name('flex before it stays over');
  response.add(p, 'setRate', 0.01, 1, 0.01).name('how fast a new lie sets');
  response.add(p, 'calm', 0, 0.3, 0.01).name('light air');
  response.add(p, 'stiffness', 2, 60, 0.5).name('stiffness');
  response.add(p, 'damping', 0.5, 12, 0.1).name('damping (low = recoil)');
  response.add(p, 'coupling', 0, 1200, 10).name('neighbor pull');
  response.add(p, 'lagTime', 0.05, 1.5, 0.01).name('late tufts delay (s)');
  response.add(p, 'lenScale', 0.5, 1.8, 0.01).name('blade length');
  response.add(p, 'follow', 0, 2.5, 0.01).name('lean per bend');
  response.add(p, 'rootTurn', 0, 1, 0.01).name('lean at base');
  response.add(p, 'tuftMix', 0, 1, 0.01).name('tuft cohesion');
  response.add(p, 'tuftGain', 0, 1, 0.01).name('tuft give varies');
  response.add(p, 'tuftLag', 0, 1, 0.01).name('tuft timing varies');
  response.add(p, 'clumpGain', 0, 1, 0.01).name('clump give varies');
  response.add(p, 'clumpLag', 0, 1, 0.01).name('clump timing varies');
  response.add(p, 'flutter', 0, 0.5, 0.01).name('blade flutter');
  response.add(p, 'tuftSpread', 0, 1.2, 0.01).name('tufts splay');

  const light = gui.addFolder('Light from lean');
  light.add(p, 'baked', 0, 1, 0.01).name('fixed hills (photo lighting)');
  light.add(p, 'tuftDepth', 0, 1, 0.01).name('shadow between tufts');
  light.add(p, 'bladeTone', 0, 1, 0.01).name('tone varies by blade');
  light.add(p, 'tilt', 0, 1.5, 0.01).name('tone from lean');
  light.add(p, 'relief', 0, 2, 0.01).name('heaped / parted');
  light.add(p, 'shimmer', 0, 1, 0.01).name('flash while moving');
  light.add(p, 'lightAngle', 0, 360, 1).name('light direction');

  const touch = gui.addFolder('Mouse wind');
  touch.add(p, 'touch').name('enabled');
  touch.add(p, 'touchForce', 0, 4, 0.01).name('strength');
  touch.add(p, 'touchRadius', 0.02, 0.4, 0.005).name('radius');

  const school = gui.addFolder('School field');
  school.add(p, 'schoolAmount', 0, 1.5, 0.01).name('amount');
  school.add(p, 'schools', 1, 8, 1).onChange(on.schools);
  school.add(p, 'schoolSeed', 1, 99, 1).name('seed').onChange(on.schools);
  school.add(p, 'headingSpread', 0, 1.5, 0.01).name('heading spread').onChange(on.schools);
  school.add(p, 'radiusScale', 0.3, 2.5, 0.01).name('school size');
  school.add(p, 'sharpness', 0.3, 6, 0.1).name('edge sharpness');
  school.add(p, 'waveSpeed', 0.5, 10, 0.1).name('turn wave speed');
  school.add(p, 'swing', 0, 2, 0.01).name('swing');
  school.add(p, 'restWeight', 0, 1, 0.01).name('calm areas');
  school.add(p, 'ripple', 0, 1, 0.01).name('swirl');
  school.add(p, 'curlScale', 0.5, 8, 0.1).name('swirl scale');
  school.add(p, 'curlPeriod', 1, 6, 1).name('swirl speed');

  const blades = gui.addFolder('Blades');
  blades.add(p, 'density', 0.05, 1, 0.01);
  blades.add(p, 'widthScale', 0.3, 3, 0.01).name('width');
  blades.add(p, 'jitter', 0, 0.5, 0.01).name('sway (rad)');
  blades.add(p, 'rootShade', 0.2, 1, 0.01).name('root shade');
  blades.add(p, 'sheen', 0, 1.5, 0.01);

  const bg = gui.addFolder('Background');
  bg.add(p, 'bgDim', 0, 1, 0.01).name('brightness');

  gui.close();
  return gui;
}
