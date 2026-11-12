// Things to stick on a page: the doodles, plus the marks someone makes with a pen in the margin.
// They're authored as clean paths and redrawn with an unsteady hand the first time they're used.

import badge from '../art/badge.svg?raw';
import bee from '../art/bee.svg?raw';
import building from '../art/building.svg?raw';
import cap from '../art/cap.svg?raw';
import chart from '../art/chart.svg?raw';
import fish from '../art/fish.svg?raw';
import gelato from '../art/gelato.svg?raw';
import hanger from '../art/hanger.svg?raw';
import heart from '../art/heart.svg?raw';
import laptop from '../art/laptop.svg?raw';
import megaphone from '../art/megaphone.svg?raw';
import sax from '../art/sax.svg?raw';
import { inkify } from '../ink';

export interface Sticker {
  svg: string;
  label: string;
  /** Width over height, for a new one. */
  ratio: number;
  /** Marks stretch to whatever box they're given; doodles keep their shape. */
  stretch?: boolean;
}

function doodle(body: string, label: string, viewBox = '0 0 120 120'): Sticker {
  const [, , w, h] = viewBox.split(' ').map(Number);
  return { svg: `<svg class="art" viewBox="${viewBox}" aria-hidden="true">${body}</svg>`, label, ratio: w / h };
}

function mark(body: string, label: string, viewBox: string): Sticker {
  const [, , w, h] = viewBox.split(' ').map(Number);
  return {
    svg: `<svg class="art" viewBox="${viewBox}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`,
    label,
    ratio: w / h,
    stretch: true,
  };
}

const file = (svg: string, label: string): Sticker => ({ svg, label, ratio: 1 });

export const STICKERS: Record<string, Sticker> = {
  badge: file(badge, 'Badge'),
  hanger: file(hanger, 'Hanger'),
  fish: file(fish, 'Fish'),
  chart: file(chart, 'Chart'),
  building: file(building, 'Building'),
  heart: file(heart, 'Heart rate'),
  megaphone: file(megaphone, 'Megaphone'),
  cap: file(cap, 'Graduation cap'),
  gelato: file(gelato, 'Gelato'),
  laptop: file(laptop, 'Laptop'),
  bee: file(bee, 'Bee'),
  sax: file(sax, 'Saxophone'),
  phone: doodle(
    `<path class="w" d="M22 46 C22 26 40 18 60 18 C80 18 98 26 98 46 L98 52 C98 56 94 58 90 58 L80 58 C76 58 74 55 74 52 L74 44 C66 40 54 40 46 44 L46 52 C46 55 44 58 40 58 L30 58 C26 58 22 56 22 52 Z"/>
     <path class="w" d="M36 66 L84 66 L96 104 L24 104 Z"/>
     <circle cx="60" cy="85" r="11"/>
     <path class="t" d="M60 79 L60 85 L65 88"/>`,
    'Telephone',
  ),
  doc: doodle(
    `<path class="w" d="M30 14 L76 14 L94 32 L94 106 L30 106 Z"/>
     <path class="t" d="M76 14 L76 32 L94 32"/>
     <path class="t" d="M42 48 L80 48 M42 60 L80 60 M42 72 L62 72"/>
     <path d="M46 88 L56 97 L80 76"/>`,
    'Checked document',
  ),
  funnel: doodle(
    `<path class="w" d="M16 26 L104 26 L72 64 L72 98 L48 108 L48 64 Z"/>
     <path class="t" d="M30 42 L90 42"/>
     <circle class="k" cx="60" cy="12" r="3"/>
     <circle class="k" cx="42" cy="14" r="3"/>
     <circle class="k" cx="78" cy="14" r="3"/>`,
    'Funnel',
  ),
  nap: doodle(
    `<path d="M10 104 C16 84 14 70 8 58 M24 104 C26 80 34 64 44 54 M38 104 C40 88 38 76 34 66 M56 104 C58 82 66 70 78 62 M72 104 C72 90 70 80 66 72 M90 104 C92 84 100 70 112 64 M106 104 C106 90 104 82 100 74 M124 104 C126 86 134 74 146 70 M140 104 C140 92 138 86 136 80"/>
     <path class="t" d="M68 46 L82 46 L68 58 L82 58 M92 24 L110 24 L92 40 L110 40 M122 2 L146 2 L122 22 L146 22"/>`,
    'Grass and z z z',
    '0 0 160 112',
  ),
  star: doodle(`<path class="w" d="M60 10 L73 44 L110 46 L81 68 L91 104 L60 83 L29 104 L39 68 L10 46 L47 44 Z"/>`, 'Star'),
  love: doodle(
    `<path class="w" d="M60 102 C20 74 8 50 20 30 C32 12 54 18 60 38 C66 18 88 12 100 30 C112 50 100 74 60 102 Z"/>`,
    'Heart',
  ),
  sparkle: doodle(
    `<path d="M40 20 C42 40 46 46 64 50 C46 54 42 60 40 80 C38 60 34 54 16 50 C34 46 38 40 40 20 Z"/>
     <path class="t" d="M88 56 C89 68 92 72 102 74 C92 76 89 80 88 92 C87 80 84 76 74 74 C84 72 87 68 88 56 Z"/>
     <path class="t" d="M84 12 C85 20 87 22 94 24 C87 26 85 28 84 36 C83 28 81 26 74 24 C81 22 83 20 84 12 Z"/>`,
    'Sparkles',
  ),
  pin: doodle(
    `<path d="M60 70 L60 112"/>
     <circle class="red" cx="60" cy="44" r="26"/>
     <path class="t" d="M46 36 C50 28 58 24 66 26"/>`,
    'Push pin',
  ),
  clip: doodle(
    `<path d="M44 40 L44 104 C44 124 14 124 14 104 L14 30 C14 10 38 10 38 30 L38 96 C38 108 22 108 22 96 L22 46"/>`,
    'Paper clip',
    '0 0 60 132',
  ),
  check: mark(`<path d="M10 62 L42 96 L112 14"/>`, 'Tick', '0 0 120 110'),
  cross: mark(`<path d="M14 14 L106 96 M106 14 L14 96"/>`, 'Cross', '0 0 120 110'),
  arrow: mark(`<path d="M8 30 C60 4 132 10 176 66"/><path d="M148 60 L178 68 L178 36"/>`, 'Arrow', '0 0 190 80'),
  underline: mark(
    `<path d="M6 16 C60 6 120 26 180 12 C220 4 262 20 294 10"/><path class="t" d="M34 30 C96 22 190 32 268 24"/>`,
    'Underline',
    '0 0 300 40',
  ),
  circle: mark(
    `<path d="M150 12 C60 8 12 44 14 84 C16 128 80 150 156 148 C236 146 288 118 286 76 C284 34 216 6 128 16"/>`,
    'Circle',
    '0 0 300 160',
  ),
  bracket: mark(`<path d="M34 6 C14 8 22 60 6 70 C22 80 14 132 34 134"/>`, 'Bracket', '0 0 40 140'),
};

/** Strips of tape, drawn with CSS so they can be any length. */
export const TAPES: Record<string, string> = {
  'tape-cream': 'Masking tape',
  'tape-green': 'Green tape',
  'tape-red': 'Red tape',
  'tape-blue': 'Blue tape',
  'tape-kraft': 'Kraft tape',
};

let bench: HTMLElement | null = null;
const inked = new Map<string, string>();

/** The drawing for a sticker, in a shaky hand. */
export function stickerMarkup(key: string) {
  const ready = inked.get(key);
  if (ready !== undefined) return ready;
  const sticker = STICKERS[key];
  if (!sticker) return '';
  if (!bench) {
    // Path lengths can only be measured on something that's in the page.
    bench = document.createElement('div');
    bench.setAttribute('aria-hidden', 'true');
    bench.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    document.body.append(bench);
  }
  bench.innerHTML = sticker.svg;
  inkify(bench.firstElementChild as SVGSVGElement);
  const markup = bench.innerHTML;
  bench.replaceChildren();
  inked.set(key, markup);
  return markup;
}
