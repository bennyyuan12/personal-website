import type { Params } from './params';

/** Everything that differs between the motion versions. */
type MotionKey =
  | 'windHeading' | 'breeze' | 'gust' | 'gustCells' | 'gustCross' | 'gustTrips' | 'gustDetail' | 'gustEdge'
  | 'gustTurn' | 'pressAt' | 'ripple' | 'schoolAmount'
  | 'stiffness' | 'damping' | 'coupling' | 'lagTime' | 'yield' | 'setRate' | 'calm'
  | 'lenScale' | 'rootTurn' | 'follow'
  | 'tuftMix' | 'tuftGain' | 'tuftLag' | 'clumpGain' | 'clumpLag' | 'flutter' | 'tuftSpread'
  | 'tilt' | 'relief' | 'shimmer';

export interface Preset {
  id: string;
  name: string;
  note: string;
  values: Pick<Params, MotionKey>;
}

const SHARED = {
  windHeading: -12,
  ripple: 0.05,
  schoolAmount: 0.1,
  calm: 0.012,
} as const;

export const PRESETS: Preset[] = [
  {
    id: 'a',
    name: 'Swell',
    note: 'Wide slow gusts lay the grass over in big sheets, and it stays until the next one.',
    values: {
      ...SHARED,
      breeze: 0.5, gust: 0.85, gustCells: 1.3, gustCross: 0.55, gustTrips: 1, gustDetail: 0.22, gustEdge: 0.5,
      gustTurn: 0.9, pressAt: 0.74,
      stiffness: 10, damping: 3.2, coupling: 240, lagTime: 0.45, yield: 0.28, setRate: 0.2,
      lenScale: 1, rootTurn: 0.45, follow: 1,
      tuftMix: 0.75, tuftGain: 0.25, tuftLag: 0.45, clumpGain: 0.2, clumpLag: 0.35, flutter: 0.04, tuftSpread: 0.35,
      tilt: 0.55, relief: 0.9, shimmer: 0.1,
    },
  },
  {
    id: 'b',
    name: 'Tufts',
    note: 'Groups go over one after another and each stays its own way: the most broken-up field.',
    values: {
      ...SHARED,
      breeze: 0.45, gust: 0.85, gustCells: 2.1, gustCross: 0.95, gustTrips: 2, gustDetail: 0.34, gustEdge: 0.42,
      gustTurn: 1.1, pressAt: 0.72,
      stiffness: 14, damping: 3.6, coupling: 90, lagTime: 0.6, yield: 0.2, setRate: 0.25,
      lenScale: 1, rootTurn: 0.5, follow: 1.05,
      tuftMix: 1, tuftGain: 0.5, tuftLag: 0.85, clumpGain: 0.4, clumpLag: 0.6, flutter: 0.05, tuftSpread: 0.7,
      tilt: 0.55, relief: 0.9, shimmer: 0.09,
    },
  },
  {
    id: 'c',
    name: 'Long Sway',
    note: 'The longest, heaviest grass: slow to go over, swings past, then lies where it lands.',
    values: {
      ...SHARED,
      breeze: 0.55, gust: 0.95, gustCells: 1.7, gustCross: 0.7, gustTrips: 1, gustDetail: 0.26, gustEdge: 0.55,
      gustTurn: 1, pressAt: 0.72,
      stiffness: 6, damping: 1.6, coupling: 160, lagTime: 0.7, yield: 0.34, setRate: 0.12,
      lenScale: 1.3, rootTurn: 0.3, follow: 1.1,
      tuftMix: 0.85, tuftGain: 0.3, tuftLag: 0.6, clumpGain: 0.3, clumpLag: 0.45, flutter: 0.03, tuftSpread: 0.45,
      tilt: 0.55, relief: 0.9, shimmer: 0.12,
    },
  },
  {
    id: 'd',
    name: 'Flurry',
    note: 'Quick shifting gusts keep re-combing the field. Springier, so more of each gust relaxes.',
    values: {
      ...SHARED,
      breeze: 0.4, gust: 0.8, gustCells: 3, gustCross: 1.3, gustTrips: 3, gustDetail: 0.42, gustEdge: 0.38,
      gustTurn: 1.3, pressAt: 0.68,
      stiffness: 24, damping: 5, coupling: 120, lagTime: 0.3, yield: 0.42, setRate: 0.3,
      lenScale: 0.9, rootTurn: 0.5, follow: 1,
      tuftMix: 0.8, tuftGain: 0.35, tuftLag: 0.6, clumpGain: 0.25, clumpLag: 0.4, flutter: 0.07, tuftSpread: 0.5,
      tilt: 0.55, relief: 0.9, shimmer: 0.16,
    },
  },
];

export function findPreset(id: string | null | undefined) {
  return PRESETS.find((p) => p.id === id?.toLowerCase()) ?? null;
}

export function applyPreset(params: Params, preset: Preset) {
  Object.assign(params, preset.values);
  params.preset = preset.id;
}

/** Buttons and number keys to switch between the versions while it plays. */
export function createPresetBar(params: Params, onChange: () => void) {
  const bar = document.createElement('nav');
  bar.className = 'presets';
  bar.setAttribute('aria-label', 'Motion versions');
  const note = document.createElement('p');
  const buttons = PRESETS.map((preset, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<kbd>${i + 1}</kbd>${preset.name}`;
    button.addEventListener('click', () => choose(preset));
    return button;
  });
  bar.append(...buttons, note);
  document.body.append(bar);

  function show() {
    PRESETS.forEach((preset, i) => {
      const on = preset.id === params.preset;
      buttons[i].setAttribute('aria-pressed', String(on));
      if (on) note.textContent = preset.note;
    });
  }
  function choose(preset: Preset) {
    applyPreset(params, preset);
    show();
    onChange();
  }
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).tagName === 'INPUT') return;
    const preset = PRESETS[Number(e.key) - 1];
    if (preset) choose(preset);
  });
  show();
}
