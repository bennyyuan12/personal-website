// A dev-only bench for choosing a pen: one real spread of the book, written out again in each
// candidate hand. Open /font-lab.html while the dev server runs. Add ?spread=<page id> for another
// spread. Fonts come straight from Google Fonts here, so nothing is installed until one is chosen.

import './fonts';
import '../scene.css';
import './book.css';
import { renderPage, type RenderContext } from './render';
import type { BookData, Page } from './types';

interface Pen {
  name: string;
  says: string;
  /** Google Fonts families to load, as they're spelled in a css2 URL. */
  load: string[];
  /** The hand for everything, and another for titles, headings and boxed words if they differ. */
  body: string;
  display?: string;
  caps?: boolean;
  /** Extra room between letters, in em. */
  spacing?: number;
  leading: number;
  /** Nudges on top of the automatic fit, where a face looks small or large for its width. */
  size?: number;
  titleSize?: number;
}

// Block capitals, the direction picked: the same neat upper-case print, in different hands.
const PENS: Pen[] = [
  {
    name: 'A · Architects Daughter',
    says: 'the reference: even, neat, a fine felt-tip',
    load: ['Architects+Daughter'],
    body: "'Architects Daughter'",
    caps: true,
    spacing: 0.02,
    leading: 1.5,
  },
  {
    name: 'B · Patrick Hand SC',
    says: 'cleaner and rounder; small capitals keep a hint of upper and lower case',
    load: ['Patrick+Hand+SC'],
    body: "'Patrick Hand SC'",
    spacing: 0.03,
    leading: 1.38,
    size: 0.86,
  },
  {
    name: 'C · Shadows Into Light Two',
    says: 'taller and lighter, more elegant',
    load: ['Shadows+Into+Light+Two'],
    body: "'Shadows Into Light Two'",
    caps: true,
    spacing: 0.03,
    leading: 1.5,
  },
  {
    name: 'D · Walter Turncoat',
    says: 'blockier and rougher, a thicker pen',
    load: ['Walter+Turncoat'],
    body: "'Walter Turncoat'",
    caps: true,
    spacing: 0.01,
    leading: 1.42,
  },
  {
    name: 'E · Annie Use Your Telescope',
    says: 'thin and quick, written in a hurry',
    load: ['Annie+Use+Your+Telescope'],
    body: "'Annie Use Your Telescope'",
    caps: true,
    spacing: 0.04,
    leading: 1.3,
  },
  {
    name: 'F · Sedgwick Ave',
    says: 'bolder, with a marker’s swing: the loudest of the six',
    load: ['Sedgwick+Ave'],
    body: "'Sedgwick Ave'",
    caps: true,
    spacing: 0.02,
    leading: 1.4,
  },
];

/** What the layout was drawn for: how wide the current pen writes, as a share of its size. */
const FITS = 0.512;
const FITS_TITLE = 0.504;
const SAMPLE = 'I thought this job was building forms. Most of it turned out to be finding the spot where people give up on them.';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

async function main() {
  const query = new URLSearchParams(location.search);
  const families = [...new Set(PENS.flatMap((pen) => pen.load))];
  // One stylesheet per family, so one that fails to load doesn't take the rest with it.
  await Promise.all(families.map((family) => new Promise((done) => {
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
    sheet.onload = done;
    sheet.onerror = done;
    document.head.append(sheet);
  })));
  await Promise.all(PENS.flatMap((pen) => [pen.body, pen.display ?? pen.body]).map((family) => document.fonts.load(`40px ${family}`, SAMPLE).catch(() => [])));

  const book: BookData = await fetch(`${import.meta.env.BASE_URL}book/book.json`, { cache: 'no-cache' }).then((r) => r.json());
  const pages = book.sections.flatMap((section) => section.pages);
  const at = Math.max(0, pages.findIndex((page) => page.id === (query.get('spread') ?? 'bgmc')));
  const spread: [Page, Page] = [pages[at], pages[at + 1]];
  const ctx: RenderContext = { numberOf: (id) => pages.findIndex((page) => page.id === id) + 1 || null, editing: false, base: import.meta.env.BASE_URL };

  const lab = document.querySelector<HTMLElement>('#lab')!;
  const measure = document.createElement('canvas').getContext('2d')!;
  const widthOf = (family: string, text: string, spacing = 0) => {
    measure.font = `100px ${family}`;
    return measure.measureText(text).width / text.length / 100 + spacing;
  };

  const strip = h('section', 'lab-strip');
  lab.append(strip);

  for (const pen of PENS) {
    const card = h('div', 'lab-card');
    card.style.fontFamily = `${pen.body}, cursive`;
    card.style.letterSpacing = pen.spacing ? `${pen.spacing}em` : 'normal';
    if (pen.caps) card.style.textTransform = 'uppercase';
    const cardScale = (FITS / widthOf(pen.body, pen.caps ? SAMPLE.toUpperCase() : SAMPLE, pen.spacing)) * (pen.size ?? 1);
    card.style.setProperty('--s', `${cardScale.toFixed(3)}`);
    card.style.lineHeight = `${pen.leading}`;
    const tag = h('span', 'lab-tag', pen.name);
    const big = h('div', 'lab-big', 'The Refitting Room');
    const small = h('p', '', 'I talked to about a hundred people. They kept saying the same two things: I bought new clothes too early, and I don’t know what’s worth keeping. 27% → 93%, 400 calls, $15M.');
    const boxed = h('span', 'lab-boxed', 'don’t argue about it. test it.');
    card.append(tag, big, small, boxed);
    strip.append(card);
  }

  for (const pen of PENS) {
    const display = pen.display ?? pen.body;
    const sample = pen.caps ? SAMPLE.toUpperCase() : SAMPLE;
    // Sized so a line holds about as many words as it does now, and the spread still fits.
    const scale = (FITS / widthOf(pen.body, sample, pen.spacing)) * (pen.size ?? 1);
    const titleScale = (FITS_TITLE / widthOf(display, 'THE REFITTING ROOM', pen.spacing)) * (pen.titleSize ?? 1);
    const headingScale = ((FITS * 0.88) / widthOf(display, pen.caps ? 'WHAT I TOOK AWAY' : 'what I took away', pen.spacing)) * (pen.titleSize ?? 1);

    const el = h('div', 'book open lab-book');
    const vars: Record<string, string> = {
      '--hand': `${pen.body}, cursive`,
      '--hand-scale': `${scale.toFixed(3)}`,
      '--hand-leading': `${pen.leading}`,
      '--hand-case': pen.caps ? 'uppercase' : 'none',
      '--hand-spacing': pen.spacing ? `${pen.spacing}em` : 'normal',
      '--title-family': `${display}, cursive`,
      '--title-scale': `${titleScale.toFixed(3)}`,
      '--title-leading': pen.display ? '1.5' : '1.12',
      '--title-case': 'uppercase',
      '--heading-family': `${display}, cursive`,
      '--heading-scale': `${headingScale.toFixed(3)}`,
      '--heading-leading': pen.display ? '1.5' : '1.12',
      '--heading-case': pen.caps ? 'uppercase' : 'none',
      '--display': `${display}, cursive`,
    };
    for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
    if (pen.display) el.classList.add('two-pens');
    const body = h('div', 'book-body');
    spread.forEach((page, i) => {
      const slot = h('div', `slot ${i ? 'r' : 'l'}`);
      const made = renderPage(page, at + i + 1, ctx);
      made.classList.add(i ? 'r' : 'l');
      slot.append(made);
      body.append(slot);
    });
    el.append(h('div', 'book-cover'), h('div', 'book-stack'), body);

    const block = h('section', 'lab-block');
    const head = h('header', 'lab-head');
    head.append(h('h2', '', pen.name), h('p', '', `${pen.says} · ${[...new Set([pen.display, pen.body])].filter(Boolean).map((family) => family!.replaceAll("'", '')).join(' + ')}`));
    block.append(head, el);
    lab.append(block);
  }
}

const style = document.createElement('style');
style.textContent = `
  html, body { margin: 0; background: #1a2414; color: #f4f0df; }
  body { user-select: text; -webkit-user-select: text; }
  #lab { padding: 28px 24px 80px; }
  .lab-block { margin: 0 auto 72px; width: fit-content; }
  .lab-head { margin: 0 0 30px; font: 14px/1.4 ui-monospace, Menlo, monospace; }
  .lab-head h2 { margin: 0 0 4px; font: 600 20px/1.2 system-ui, sans-serif; }
  .lab-head p { margin: 0; opacity: 0.75; }
  .lab-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 18px; max-width: 1240px; margin: 0 auto 72px; }
  .lab-card { position: relative; padding: 46px 26px 26px; background: var(--fleck), var(--grain), var(--fibre), var(--mottle), #f4eedc; color: #1f1b16; font-size: calc(17px * var(--s)); box-shadow: 0 8px 20px #0008; }
  .lab-card p { margin: 10px 0 14px; }
  .lab-tag { position: absolute; left: 0; top: 0; padding: 5px 10px; background: #1f1b16; color: #f4eedc; font: 600 12px/1.3 system-ui, sans-serif; letter-spacing: 0; text-transform: none; }
  .lab-big { font-size: 2.1em; line-height: 1.1; text-transform: uppercase; }
  .lab-boxed { display: inline-block; padding: 0.3em 0.7em; border: 2px solid currentColor; border-radius: 255px 14px 225px 16px / 14px 225px 18px 255px; }
  .lab-book { --page-w: min(620px, (100vw - 60px) / 2); --page-h: calc(var(--page-w) * 1.37); position: relative; cursor: default; }
  /* Titles, headings and boxed words take the second pen when a direction has two. */
  .two-pens .b-boxed.s-note { font-family: var(--display); font-size: calc(var(--fs) * var(--k, 1) * 0.66 * var(--u)); line-height: 1.75; }
`;
document.head.append(style);

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88">${String(err)}</pre>`);
});
