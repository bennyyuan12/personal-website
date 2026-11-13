// Ready-made pages: what "add a page" offers in the editor, and what the first copy of the book was
// laid out with (tools/seed-book.ts). They only build data, so they run anywhere.

import type { Item, Page, PhotoItem, Scrap, StickerItem, TextItem, TextStyle } from './types';

export type MakeId = () => string;

/** Something done, with enough to fill two facing pages: the story by hand, the summary typed. */
export interface Entry {
  id: string;
  kind: string;
  /** Short enough to sit on one line in big letters. */
  title: string;
  /** Its full name, or what it is in a few words. */
  sub?: string;
  role: string;
  when: string;
  where?: string;
  /** What the story is: "why I built it" for a project, "what I took away" for a job. */
  storyTitle: string;
  /** In my own words, a short paragraph each. Written by hand. */
  story: string[];
  /** The one line worth drawing a box round. */
  lesson: string;
  /** For someone in a hurry: what a resume would say. Typed. */
  tldr: string[];
  /** What the list of tools is called: not every job has a stack. */
  stackTitle?: string;
  stack: string[];
  /** A few words or a number worth circling, and what it means. */
  big: string;
  bigNote: string;
  /** A drawing of the thing, the scrap it's on, and the note beside it. */
  art: string;
  artOn?: Scrap;
  /** Width and height of the scrap, in page units. */
  artSize?: [number, number];
  artNote: string;
  /** A remark in the margin of the typed page. */
  aside: string;
}

/** A steady wobble: the same thing always sits at the same slight angle. */
export function tilt(seed: number, most: number) {
  const r = Math.sin(seed * 12.9898 + 4.1) * 43758.5453;
  return Math.round((r - Math.floor(r) - 0.5) * 2 * most * 10) / 10;
}

export function kit(id: MakeId) {
  return {
    text: (style: TextStyle, html: string, x: number, y: number, w: number, more: Partial<TextItem> = {}): TextItem => ({
      id: id(), type: 'text', style, html, x, y, w, ...more,
    }),
    sticker: (art: string, x: number, y: number, w: number, h: number, more: Partial<StickerItem> = {}): StickerItem => ({
      id: id(), type: 'sticker', art, x, y, w, h, ...more,
    }),
    photo: (x: number, y: number, w: number, h: number, more: Partial<PhotoItem> = {}): PhotoItem => ({
      id: id(), type: 'photo', src: '', frame: 'polaroid', x, y, w, h, ...more,
    }),
  };
}

// Nothing here can measure text, so these are how wide a letter comes out, as a share of its size.
const HAND = 0.512;
/** Capitals vary a lot more than that, and titles are short, so those are added up letter by letter. */
const CAPS: Record<string, number> = {
  A: 0.64, B: 0.71, C: 0.71, D: 0.65, E: 0.59, F: 0.69, G: 0.69, H: 0.61, I: 0.15, J: 0.53, K: 0.61, L: 0.69, M: 0.83,
  N: 0.63, O: 0.67, P: 0.64, Q: 0.71, R: 0.71, S: 0.64, T: 0.62, U: 0.56, V: 0.63, W: 0.94, X: 0.6, Y: 0.53, Z: 0.78,
  0: 0.63, 1: 0.13, 2: 0.57, 3: 0.51, 4: 0.68, 5: 0.71, 6: 0.63, 7: 0.62, 8: 0.65, 9: 0.57,
  ' ': 0.4, '&': 0.67, '+': 0.52, ',': 0.18, '.': 0.14, '-': 0.31, $: 0.56, '%': 0.52, '→': 0.8, '·': 0.3,
};
/** Labels are small capitals with air between them. */
const LABEL = 22 * 0.885;
/** Line heights of a note and a caption, as a share of their size. */
const NOTE_LEADING = 1.365;
const CAPTION_LEADING = 1.35;
const TYPED = 0.6;
/** Sizes in page units, as book.css sets them. */
const TITLE = 104 * 0.89;
const HEADING = 58 * 0.89;
const NOTE = 33;
const CAPTION = 25;
const TYPED_BODY = 31;

const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');

/** How wide some words come out in capitals, in units of their size. */
function capsWidth(words: string, spacing = 0.01) {
  let width = 0;
  for (const letter of plain(words).toUpperCase()) width += (CAPS[letter] ?? 0.62) + spacing;
  return width;
}

/** How many lines some words take when a line holds this many letters. */
function rows(words: string, perLine: number) {
  let lines = 1;
  let used = 0;
  for (const word of plain(words).split(/\s+/)) {
    if (used && used + 1 + word.length > perLine) {
      lines++;
      used = word.length;
    } else {
      used += (used ? 1 : 0) + word.length;
    }
  }
  return lines;
}

/** Roughly how tall a title comes out, in page units. */
function titleHeight(words: string, size: number, width: number) {
  const fontSize = TITLE * size;
  return Math.max(1, Math.ceil((capsWidth(words) * fontSize) / (width * 0.94))) * fontSize * 1.14;
}

/** The biggest a title can be and still sit on one line this wide. */
function titleSize(words: string, width = 820) {
  for (const size of [1.35, 1.15, 1, 0.86, 0.74]) {
    if (capsWidth(words) * TITLE * size <= width) return size;
  }
  return 0.74;
}

const TAPE_KINDS = ['tape-black', 'tape-red', 'tape-kraft'];

/** Two facing pages about one thing: the story by hand on the left, the typed summary on the right. */
export function entrySpread(id: MakeId, e: Entry, number: number, backTo: string): [Page, Page] {
  const k = kit(id);
  const mirror = number % 2 === 0;
  /** Lay things out one way on odd entries and the other way on even ones. */
  const side = <T extends Item>(item: T, width = item.w): T => (mirror ? { ...item, x: 1000 - item.x - width, rot: item.rot ? -item.rot : item.rot } : item);
  const tape = TAPE_KINDS[number % TAPE_KINDS.length];

  // ---- left: what it was, and the story, by hand ----
  const size = titleSize(e.title);
  const left: Item[] = [
    k.text('label', `${e.kind} · ${String(number).padStart(2, '0')}`, 72, 58, 380),
    k.text('caption', e.when, 500, 54, 430, { align: 'right', ink: 'red' }),
    k.text('title', e.title, 66, 98, 868, { size, rot: -0.8 }),
  ];
  let y = 98 + titleHeight(e.title, size, 868);
  left.push(k.sticker('underline', 68, y + 8, Math.min(600, Math.max(220, capsWidth(e.title) * TITLE * size * 0.86)), 30, { ink: 'red', rot: -0.8 }));
  y += 46;
  if (e.sub) {
    left.push(k.text('caption', e.sub, 72, y, 856));
    y += rows(e.sub, Math.floor(856 / (CAPTION * HAND))) * CAPTION * CAPTION_LEADING + 16;
  }
  const roleWidth = capsWidth(e.role, 0.14) * LABEL + 44;
  left.push(k.text('label', e.role, 72, y, 860, { backing: 'boxed', rot: tilt(number, 0.8) }));
  if (e.where) left.push(k.text('caption', e.where, 72 + roleWidth + 22, y + 9, Math.max(160, 856 - roleWidth - 22)));
  y += 92;

  // The drawing on its scrap. Beside it, a note about it and the one line worth a box.
  const [figW, figH] = e.artSize ?? [400, 300];
  const colX = 64 + figW + 74;
  const colW = 930 - colX;
  const noteSize = 0.92;
  const noteHeight = rows(e.artNote, Math.floor(colW / (NOTE * noteSize * HAND))) * NOTE * noteSize * NOTE_LEADING;
  const lessonSize = 0.9;
  const lessonRows = rows(e.lesson, Math.floor((colW - 56) / (NOTE * lessonSize * HAND)));
  const lessonHeight = lessonRows * NOTE * lessonSize * NOTE_LEADING + 30;
  const bandH = Math.max(figH, noteHeight + lessonHeight + 44);
  if (number % 3 !== 1) left.push(side(k.sticker('splat', 64 + figW - 118, y + figH - 128, 122, 166, { card: true, on: 'kraft', rot: 7 }), 122));
  left.push(
    side(k.sticker(e.art, 64, y, figW, figH, { card: true, on: e.artOn, rot: -1.4 }), figW),
    side(k.sticker(tape, 64 + figW / 2 - 84, y - 24, 168, 44, { rot: tilt(number + 3, 5) }), 168),
    { ...side(k.sticker('bracket', colX - 44, y + 14, 26, noteHeight + 4), 26), rot: mirror ? 180 : 0 },
    side(k.text('note', e.artNote, colX, y + 12, colW, { ink: 'blue', rot: 1.2, size: noteSize }), colW),
    side(k.text('note', e.lesson, colX, y + bandH - lessonHeight - 6, colW, { backing: 'boxed', size: lessonSize, rot: -1.4 }), colW),
  );
  // A strip of red tape down the edge of the scrap: turned on end, so it's placed by its middle.
  if (number % 3 === 1) left.push(side(k.sticker('tape-red', 64 + figW - 75, y + figH * 0.42, 150, 34, { rot: 90 }), 150));
  y += bandH + 50;

  const storyTitleWidth = capsWidth(e.storyTitle) * HEADING * 0.66;
  left.push(
    k.text('heading', e.storyTitle, 72, y, 760, { size: 0.66, rot: -0.6 }),
    k.sticker('underline', 72, y + 50, storyTitleWidth + 16, 22, { rot: -0.6 }),
  );
  y += 82;
  left.push(
    k.text('body', e.story.map((words) => `<p>${words}</p>`).join(''), 72, y, 856),
    k.text('caption', '← back to the list', 72, 1276, 420, { goto: backTo }),
  );

  // ---- right: the typed version, for someone in a hurry ----
  // The sheet is typed as large as leaves room under it for the stack, the number and the aside.
  const sheetWidth = 888;
  const sheetY = 172;
  const stackSize = 0.8;
  const stackWidth = 470;
  const stackLine = e.stack.join(' · ');
  const stackRows = 1 + rows(stackLine, Math.floor((stackWidth - 92) / (TYPED_BODY * stackSize * TYPED)));
  const stackHeight = 104 + stackRows * TYPED_BODY * stackSize * 1.34;
  const asideHeight = rows(e.aside, Math.floor(440 / (NOTE * 0.8 * HAND))) * NOTE * 0.8 * NOTE_LEADING;
  const sheetHeightAt = (typedSize: number) => {
    const typed = TYPED_BODY * typedSize;
    const perLine = Math.floor((sheetWidth - 92) / (typed * TYPED));
    const perBullet = Math.floor((sheetWidth - 92 - typed * 1.5) / (typed * TYPED));
    const headRows = rows(e.title, perLine) + rows(e.role, perLine) + rows(`${e.when} ${e.where ?? ''}`, Math.floor(perLine / 0.86));
    const bulletRows = e.tldr.reduce((n, line) => n + rows(line, perBullet), 0);
    return 104 + (headRows + bulletRows) * typed * 1.34 + typed * 1.5 + (e.tldr.length - 1) * typed * 0.42;
  };
  const typedSize = [0.92, 0.88, 0.84, 0.8, 0.76].find((size) => sheetY + sheetHeightAt(size) + 30 + stackHeight + 18 + asideHeight <= 1296) ?? 0.76;
  const sheetHeight = sheetHeightAt(typedSize);
  const sheet = [
    `<b>${e.title.toUpperCase()}</b><br>${e.role}<br>`,
    `<small>${e.when}${e.where ? ` · ${e.where}` : ''}</small><hr>`,
    `<ul>${e.tldr.map((line) => `<li>${line}</li>`).join('')}</ul>`,
  ].join('');

  const right: Item[] = [
    k.text('heading', 'TL;DR', 72, 50, 250, { size: 1.5, rot: -1.6 }),
    k.sticker('underline', 76, 138, 210, 26, { ink: 'red', rot: -1.6 }),
    k.text('caption', 'the typed-up version, for anyone in a hurry', 330, 72, 400, { rot: -1 }),
    k.sticker('arrow', 742, 76, 118, 50, { rot: 34 }),
    k.text('body', sheet, 56, sheetY, sheetWidth, { backing: 'torn', size: typedSize, rot: mirror ? -0.5 : 0.5 }),
  ];
  if (number % 3 === 0) {
    right.push(k.sticker('tape-black', 20, sheetY + 4, 150, 40, { rot: -38 }), k.sticker('tape-black', 830, sheetY + 2, 150, 40, { rot: 36 }));
  } else if (number % 3 === 1) {
    right.push(k.sticker('tape-black', 400, sheetY - 20, 190, 46, { rot: 2.5 }));
  } else {
    right.push(k.sticker('clip', 820, sheetY - 54, 50, 110, { rot: 8 }), k.sticker('tape-red', 30, sheetY + 10, 140, 36, { rot: -40 }));
  }

  // Whatever is left over goes between the sheet and what's under it, and under that again.
  const spare = Math.max(0, 1296 - (sheetY + sheetHeight + 30 + stackHeight + 18 + asideHeight));
  y = sheetY + sheetHeight + 30 + spare * 0.4;
  const bigSize = Math.min(1.2, 340 / (capsWidth(e.big) * TITLE));
  const bigHeight = TITLE * bigSize * 1.14;
  right.push(
    side(k.text('body', `<b>${(e.stackTitle ?? 'Stack').toUpperCase()}</b><br>${stackLine}`, 60, y, stackWidth, { backing: 'torn', size: stackSize, rot: -1.6 }), stackWidth),
    side(k.sticker(tape === 'tape-black' ? 'tape-kraft' : 'tape-black', 60 + stackWidth / 2 - 70, y - 16, 140, 38, { rot: -4 }), 140),
    side(k.text('title', e.big, 540, y + 34, 400, { size: bigSize, ink: 'red', align: 'center', rot: -3 }), 400),
    side(k.sticker('circle', 530, y + 6, 420, bigHeight + 62, { ink: 'red', rot: -2 }), 420),
    side(k.text('caption', e.bigNote, 540, y + bigHeight + 82, 400, { align: 'center' }), 400),
    side(k.text('note', e.aside, 76, y + stackHeight + 18 + spare * 0.2, 440, { ink: 'blue', size: 0.8, rot: -2 }), 440),
  );

  return [
    { id: e.id, name: e.title, items: left },
    { id: `${e.id}-2`, name: `${e.title}: the TL;DR`, items: right },
  ];
}

/** One row of a list of things to flip to: a doodle and a card. */
export function listRow(id: MakeId, row: { title: string; line: string; art: string; goto: string }, y: number, seed: number): Item[] {
  const k = kit(id);
  return [
    k.text('body', `<b>${row.title}</b><br><small>${row.line} · p. {{page}}</small>`, 196, y, 730, {
      backing: 'card', size: 0.88, rot: tilt(seed, 0.9), goto: row.goto,
    }),
    k.sticker(row.art, 62, y + 14, 118, 118, { rot: tilt(seed + 3, 6), goto: row.goto }),
  ];
}

/** A blog post: two facing pages to start with. */
export function postSpread(id: MakeId, pageId: string, title: string, backTo: string | null): [Page, Page] {
  const k = kit(id);
  const size = Math.min(1, titleSize(title, 1500));
  const after = 138 + titleHeight(title, size, 850) + 30;
  const back: Item[] = backTo ? [k.text('caption', '← all posts', 72, 1262, 420, { goto: backTo })] : [];
  return [
    {
      id: pageId,
      name: title,
      items: [
        k.text('label', 'Post', 72, 78, 400),
        k.text('title', title, 68, 138, 860, { size, rot: -1 }),
        k.sticker('underline', 70, after - 18, 460, 34, { ink: 'red' }),
        k.text('stamp', 'month year', 600, after + 6, 340, { ink: 'blue', size: 0.7, rot: 4, align: 'center' }),
        k.text('body', '<p>Start writing here. Double-click this text to edit it.</p><p>Drag it to move it, and use the handles to resize or turn it.</p>', 80, after + 110, 840),
        ...back,
      ],
    },
    {
      id: `${pageId}-2`,
      name: `${title}, continued`,
      items: [
        k.text('body', '<p>Keep going on this page.</p>', 80, 110, 840),
        k.photo(250, 620, 500, 560, { rot: 3, caption: 'a caption' }),
      ],
    },
  ];
}

export interface Template {
  key: string;
  label: string;
  /**
   * New pages, named from `pageId`. An even number keeps facing pages facing each other.
   * home: the first page of the section they're going into, for a link back to it.
   */
  make(id: MakeId, pageId: string, home: string | null): Page[];
}

export const TEMPLATES: Template[] = [
  {
    key: 'blank',
    label: 'Blank page',
    make: (_id, pageId) => [{ id: pageId, items: [] }],
  },
  {
    key: 'writing',
    label: 'Page of writing',
    make: (id, pageId) => {
      const k = kit(id);
      return [{ id: pageId, items: [k.text('heading', 'A heading', 78, 90, 800, { rot: -1 }), k.text('body', '<p>Double-click to write.</p>', 80, 210, 840)] }];
    },
  },
  {
    key: 'photos',
    label: 'Page of photos',
    make: (id, pageId) => {
      const k = kit(id);
      return [{
        id: pageId,
        items: [
          k.photo(90, 110, 460, 520, { rot: -4, caption: 'caption' }),
          k.photo(470, 520, 440, 500, { rot: 5, caption: 'caption' }),
          k.text('note', 'what was happening here?', 110, 1090, 520, { rot: -2 }),
          k.sticker('tape-green', 380, 86, 200, 48, { rot: -8 }),
        ],
      }];
    },
  },
  {
    key: 'post',
    label: 'Blog post (2 pages)',
    make: (id, pageId, home) => postSpread(id, pageId, 'A new post', home),
  },
  {
    key: 'entry',
    label: 'Experience entry (2 pages)',
    make: (id, pageId, home) =>
      entrySpread(id, {
        id: pageId,
        kind: 'Work',
        title: 'Where it was',
        sub: 'What it is, in a few words.',
        role: 'What I was',
        when: 'when',
        storyTitle: 'what I took away',
        story: ['A few sentences, the way I would say them out loud.', 'And one more thought.'],
        lesson: 'the line worth keeping',
        tldr: ['The first thing I did.', 'The second thing.', 'The third.'],
        stack: ['Tool', 'Another tool'],
        big: '100',
        bigNote: 'a number worth circling',
        art: 'star',
        artNote: 'a note about the drawing',
        aside: 'something to remember',
      }, 1, home ?? pageId),
  },
];
