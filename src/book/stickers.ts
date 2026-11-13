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

/** 400 dots, one a phone call: 240 that got a full quote, 80 a partial one, 80 nothing usable. */
function callDots() {
  let out = '';
  for (let i = 0; i < 400; i++) {
    const row = Math.floor(i / 20);
    const col = i % 20;
    // A dot put down by hand lands a little off.
    const dx = Math.sin(i * 12.9898) * 0.9;
    const dy = Math.cos(i * 78.233) * 0.9;
    const kind = i < 240 ? 'k' : i < 320 ? 'k soft' : 't';
    out += `<circle class="${kind}" cx="${(8 + col * 10 + dx).toFixed(1)}" cy="${(8 + row * 10 + dy).toFixed(1)}" r="${i < 320 ? 3.3 : 2.9}"/>`;
  }
  return out;
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
  // ---- figures: small drawings of the thing itself, with the real numbers on them ----
  'bars-ab': doodle(
    `<path d="M18 8 L18 112 L152 112"/>
     <path class="w" d="M40 112 L40 86 L70 86 L70 112"/>
     <path class="w" d="M96 112 L96 23 L126 23 L126 112"/>
     <path class="t" d="M96 50 L126 28 M96 66 L126 44 M96 82 L126 60 M96 98 L126 76 M100 112 L126 92"/>
     <text x="55" y="78" font-size="17" text-anchor="middle">27%</text>
     <text class="redink" x="111" y="16" font-size="19" text-anchor="middle">93%</text>
     <text x="55" y="129" font-size="12" text-anchor="middle">before</text>
     <text x="111" y="129" font-size="12" text-anchor="middle">popup</text>`,
    'Chart: 27% to 93%',
    '0 0 160 134',
  ),
  'bars-ret': doodle(
    `<path d="M18 8 L18 112 L152 112"/>
     <path class="w" d="M40 112 L40 43 L70 43 L70 112"/>
     <path class="t" d="M40 68 L70 46 M40 84 L70 62 M40 100 L70 78 M44 112 L70 94"/>
     <path class="w" d="M96 112 L96 81 L126 81 L126 112"/>
     <text x="55" y="36" font-size="18" text-anchor="middle">72%</text>
     <text class="redink" x="111" y="73" font-size="18" text-anchor="middle">32%</text>
     <text x="55" y="129" font-size="12" text-anchor="middle">US</text>
     <text x="111" y="129" font-size="12" text-anchor="middle">China</text>
     <text x="150" y="18" font-size="11" text-anchor="end">day 1</text>`,
    'Chart: 72% and 32%',
    '0 0 160 134',
  ),
  calls: doodle(callDots(), '400 calls, dot by dot', '0 0 206 206'),
  blocks: doodle(
    `<path class="w" d="M10 12 L42 10 L43 38 L11 40 Z"/>
     <path class="red" d="M50 10 L78 9 L79 37 L51 38 Z"/>
     <path class="w" d="M86 9 L118 8 L119 36 L87 37 Z"/>
     <path class="k soft" d="M126 8 L150 8 L150 35 L127 36 Z"/>
     <path class="w" d="M11 48 L30 47 L31 78 L12 79 Z"/>
     <path class="k soft" d="M38 47 L79 45 L80 76 L39 78 Z"/>
     <path class="red" d="M88 45 L112 44 L113 75 L89 76 Z"/>
     <path class="w" d="M120 44 L150 43 L150 74 L121 75 Z"/>
     <path class="w" d="M12 88 L52 86 L53 118 L13 120 Z"/>
     <path class="w" d="M60 86 L92 85 L93 116 L61 118 Z"/>
     <path class="k soft" d="M100 85 L150 83 L150 114 L101 116 Z"/>
     <path class="t" d="M20 58 L24 58 M20 68 L24 68 M68 96 L84 96 M68 106 L84 106 M22 98 L44 98 M22 108 L44 108 M94 18 L110 18 M94 27 L110 27"/>`,
    'City blocks, coloured by risk',
    '0 0 160 130',
  ),
  'flow-kyc': doodle(
    `<path class="w" d="M8 12 L88 12 L88 44 L8 44 Z"/>
     <path d="M92 28 L112 28 M105 22 L113 28 L105 34"/>
     <path class="w" d="M116 12 L178 12 L178 44 L116 44 Z"/>
     <path d="M132 46 L100 82 M100 71 L99 83 L111 81"/>
     <path d="M164 46 L178 82 M168 77 L179 83 L183 71"/>
     <path class="w" d="M24 88 L116 88 L116 120 L24 120 Z"/>
     <path class="w redline" d="M140 88 L214 88 L214 120 L140 120 Z"/>
     <text x="48" y="33" font-size="11" text-anchor="middle">email + PDF</text>
     <text x="147" y="33" font-size="12" text-anchor="middle">rules</text>
     <text x="70" y="109" font-size="11" text-anchor="middle">auto-match</text>
     <text class="redink" x="177" y="109" font-size="11" text-anchor="middle">a person</text>
     <text x="92" y="64" font-size="10" text-anchor="end">clear</text>
     <text class="redink" x="182" y="62" font-size="10">unclear</text>
     <text class="redink" x="177" y="138" font-size="9" text-anchor="middle">(the LLM only helps here)</text>`,
    'Flow: rules first, a person for the rest',
    '0 0 222 146',
  ),
  siri: doodle(
    `<path class="w" d="M12 20 C12 10 20 8 30 8 L96 8 C106 8 112 12 112 22 L112 52 C112 62 106 66 96 66 L48 66 L28 86 L33 66 L28 66 C18 66 12 62 12 52 Z"/>
     <text x="62" y="31" font-size="14" text-anchor="middle">“Hey Siri…”</text>
     <path class="t" d="M30 49 L36 49 M42 43 L42 55 M50 39 L50 59 M58 45 L58 53 M66 37 L66 61 M74 44 L74 54 M82 47 L82 51 M88 49 L96 49"/>
     <path d="M120 34 C132 22 146 22 156 32 M146 22 L158 33 L144 36"/>
     <g transform="translate(118 38) scale(0.7)">
       <path class="w" d="M22 46 C22 26 40 18 60 18 C80 18 98 26 98 46 L98 52 C98 56 94 58 90 58 L80 58 C76 58 74 55 74 52 L74 44 C66 40 54 40 46 44 L46 52 C46 55 44 58 40 58 L30 58 C26 58 22 56 22 52 Z"/>
       <path class="w" d="M36 66 L84 66 L96 104 L24 104 Z"/>
       <circle cx="60" cy="85" r="11"/>
     </g>`,
    'Siri to a phone call',
    '0 0 200 116',
  ),
  splat: doodle(
    `<circle class="k" cx="40" cy="42" r="10"/><circle class="k" cx="72" cy="104" r="7"/>
     <circle class="k" cx="58" cy="26" r="2.2"/><circle class="k" cx="84" cy="52" r="1.6"/><circle class="k" cx="30" cy="78" r="1.8"/>
     <circle class="k" cx="92" cy="124" r="2"/><circle class="k" cx="50" cy="132" r="1.2"/><circle class="k" cx="20" cy="20" r="1.3"/>
     <path class="t" d="M28 118 L98 66"/>`,
    'Ink spots',
    '0 0 110 150',
  ),
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
  smile: doodle(
    `<path class="w" d="M60 14 C86 14 106 34 106 60 C106 86 86 106 60 106 C34 106 14 86 14 60 C14 34 34 14 60 14 Z"/>
     <path d="M38 68 C46 86 74 86 82 68"/><path class="thick" d="M45 44 L45 51 M75 44 L75 51"/>`,
    'Smiley',
  ),
  sun: doodle(
    `<path class="w" d="M60 34 C74 34 86 46 86 60 C86 74 74 86 60 86 C46 86 34 74 34 60 C34 46 46 34 60 34 Z"/>
     <path d="M92 60 L110 60 M82.6 82.6 L95.4 95.4 M60 92 L60 110 M37.4 82.6 L24.6 95.4 M28 60 L10 60 M37.4 37.4 L24.6 24.6 M60 28 L60 10 M82.6 37.4 L95.4 24.6"/>`,
    'Sun',
  ),
  flower: doodle(
    `<path class="w" d="M53.3 47.7 C29.7 10.6 90.3 10.6 66.7 47.7 M69.6 49.8 C97.7 15.9 116.4 73.6 73.8 62.6 M72.7 66 C113.6 82.2 64.5 117.8 61.8 73.9 M58.2 73.9 C55.5 117.8 6.4 82.2 47.3 66 M46.2 62.6 C3.6 73.6 22.3 15.9 50.4 49.8"/>
     <path class="k" d="M60 50 C66 50 70 54 70 60 C70 66 66 70 60 70 C54 70 50 66 50 60 C50 54 54 50 60 50 Z"/>`,
    'Flower',
  ),
  note: doodle(
    `<path d="M42 92 L42 30 L94 18 L94 80"/><path class="thick" d="M42 34 L94 22"/>
     <path class="k" d="M42 92 C42 102 24 106 20 98 C16 88 38 82 42 92 Z M94 80 C94 90 76 94 72 86 C68 76 90 70 94 80 Z"/>`,
    'Music note',
  ),
  coffee: doodle(
    `<path class="w" d="M22 50 L88 50 L82 100 C80 108 30 108 28 100 Z"/>
     <path d="M86 60 C108 58 108 86 82 84"/><path class="t" d="M42 38 C36 30 48 24 42 14 M58 38 C52 30 64 24 58 14 M74 38 C68 30 80 24 74 14"/>`,
    'Coffee',
  ),
  camera: doodle(
    `<path class="w" d="M14 40 L40 40 L48 28 L74 28 L82 40 L106 40 L106 96 L14 96 Z"/>
     <path d="M60 50 C72 50 80 58 80 68 C80 78 72 86 60 86 C48 86 40 78 40 68 C40 58 48 50 60 50 Z"/><path class="k" d="M88 48 L96 48 L96 54 L88 54 Z"/>`,
    'Camera',
  ),
  hi: doodle(
    `<path class="w" d="M20 22 L100 22 C106 22 110 26 110 32 L110 74 C110 80 106 84 100 84 L54 84 L32 104 L38 84 L20 84 C14 84 10 80 10 74 L10 32 C10 26 14 22 20 22 Z"/>
     <text x="60" y="66" text-anchor="middle" font-size="34">hi!</text>`,
    'Speech bubble',
  ),
  cloud: doodle(
    `<path class="w" d="M28 92 C10 92 6 66 24 62 C20 42 44 34 54 46 C60 26 90 26 94 50 C112 50 116 74 102 82 C104 92 96 94 90 92 Z"/>`,
    'Cloud',
  ),
  bolt: doodle(`<path class="w" d="M68 8 L28 66 L56 66 L44 112 L94 46 L64 46 L78 8 Z"/>`, 'Lightning'),
  plane: doodle(
    `<path class="w" d="M8 58 L112 14 L82 104 L58 72 Z"/><path d="M58 72 L112 14"/><path class="t" d="M58 72 L54 96 L68 84"/>`,
    'Paper plane',
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
  'tape-black': 'Black tape',
  'tape-pink': 'Pink washi',
  'tape-mustard': 'Mustard washi',
  'tape-dots': 'Polka-dot washi',
  'tape-stripes': 'Striped washi',
  'tape-check': 'Gingham washi',
  'tape-grid': 'Grid washi',
  'tape-stars': 'Starry washi',
  'tape-print': 'Newsprint tape',
  'tape-ruler': 'Ruler tape',
  'tape-clear': 'Clear tape',
  'tape-duct': 'Duct tape',
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
