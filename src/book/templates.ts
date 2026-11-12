// Ready-made pages: what "add a page" offers in the editor, and what the first copy of the book was
// laid out with (tools/seed-book.ts). They only build data, so they run anywhere.

import type { Item, Page, PhotoItem, StickerItem, TextItem, TextStyle } from './types';

export type MakeId = () => string;

/** Something done, with enough to fill two facing pages. */
export interface Entry {
  id: string;
  kind: string;
  title: string;
  role: string;
  when: string;
  summary: string;
  did: string[];
  stack: string[];
  /** A few words or a number worth circling, and what it means. */
  big: string;
  bigNote: string;
  /** Handwritten asides: one by the doodle, one on a sticky note. */
  note: string;
  sticky: string;
  art: string;
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

/** Roughly how tall a marker title comes out, in page units. */
function titleHeight(words: string, size: number, width: number) {
  const fontSize = 104 * size;
  const perLine = Math.max(4, Math.floor(width / (fontSize * 0.6)));
  let lines = 1;
  let used = 0;
  for (const word of words.split(' ')) {
    if (used && used + 1 + word.length > perLine) {
      lines++;
      used = word.length;
    } else {
      used += (used ? 1 : 0) + word.length;
    }
  }
  return lines * fontSize * 0.98;
}

function titleSize(words: string) {
  const n = words.length;
  return n <= 10 ? 1.2 : n <= 16 ? 1 : n <= 24 ? 0.82 : 0.68;
}

/** Label-maker strips, set out in rows. Returns them and where the last row ends. */
function labels(k: ReturnType<typeof kit>, words: string[], x0: number, y0: number, right: number, seed: number) {
  const items: Item[] = [];
  let x = x0;
  let y = y0;
  const inks = ['ink', 'red', 'ink', 'green', 'ink', 'blue'] as const;
  words.forEach((word, i) => {
    const w = Math.round(word.length * 20.5 + 52);
    if (x + w > right && x > x0) {
      x = x0 + 26;
      y += 82;
    }
    items.push(k.text('label', word, x, y, w + 30, { backing: 'dymo', ink: inks[(i + seed) % inks.length], rot: tilt(seed * 7 + i, 3) }));
    x += w + 16;
  });
  return { items, bottom: y + 64 };
}

/** Roughly how tall typed lines come out in a box this wide, in page units. */
function typedHeight(lines: string[], size: number, width: number) {
  const fontSize = 34 * size;
  const perLine = Math.floor(width / (fontSize * 0.6));
  const rows = lines.reduce((n, line) => n + Math.ceil(line.length / perLine), 0);
  return rows * fontSize * 1.3 + (lines.length - 1) * fontSize * 0.42;
}

/** Two facing pages about one thing: what it was on the left, what was done on the right. */
export function entrySpread(id: MakeId, e: Entry, number: number, backTo: string): [Page, Page] {
  const k = kit(id);
  const mirror = number % 2 === 0;
  /** Lay things out one way on odd entries and the other way on even ones. */
  const side = <T extends Item>(item: T, width = item.w): T => (mirror ? { ...item, x: 1000 - item.x - width, rot: item.rot ? -item.rot : item.rot } : item);

  const size = titleSize(e.title);
  const afterTitle = 132 + titleHeight(e.title, size, 860) + 26;
  const roleRows = Math.ceil((e.role.length * 20.5 + 52) / 860);
  const afterRole = afterTitle + 44 + roleRows * 48 + 30;
  const summaryHeight = typedHeight([e.summary], 0.9, 632) + 70;
  // Whatever room is left goes around the card, so the page doesn't look top-heavy.
  const spare = Math.max(0, 880 - (afterRole + 100 + summaryHeight));
  const left: Item[] = [
    k.text('label', `${e.kind} · ${String(number).padStart(2, '0')}`, 72, 78, 600),
    k.text('title', e.title, 68, 132, 864, { size, rot: -1.2 }),
    k.sticker('underline', 70, afterTitle - 16, 500, 34, { ink: 'red', rot: -1 }),
    k.text('label', e.role, 72, afterTitle + 44, 860, { backing: 'dymo', rot: tilt(number, 1.2) }),
    side(k.text('stamp', e.when, 540, afterRole + 4, 400, { ink: 'red', rot: 5, size: 0.86, align: 'center' })),
    side(k.text('body', e.summary, 80, afterRole + 100 + spare * 0.45, 700, { backing: 'card', size: 0.9, rot: -1.2 })),
    side(k.sticker(e.art, 580, 900, 340, 340, { rot: 6, card: true })),
    side(k.text('note', e.note, 96, 1000, 400, { rot: -3 })),
    side(k.sticker('arrow', 370, 1130, 180, 72, { rot: mirror ? 150 : -8 }), 180),
    k.text('caption', '← back to the list', 72, 1262, 420, { goto: backTo }),
  ];

  // Fewer words get a bigger typewriter, then the groups share out whatever room is left.
  const chars = e.did.reduce((n, line) => n + line.length, 0);
  const didSize = chars < 260 ? 1.04 : chars < 390 ? 0.94 : 0.86;
  const didHeight = typedHeight(e.did, didSize, 788) + 98;
  const strips = labels(k, e.stack, 78, 0, 930, number);
  const free = Math.max(0, 1020 - (190 + didHeight + 40 + strips.bottom));
  const didY = 190 + free * 0.22;
  const stripsY = didY + didHeight + 40 + free * 0.34;
  const right: Item[] = [
    k.text('heading', 'What I did', 78, 80, 700, { rot: -1.2 }),
    k.sticker('tape-cream', 400, didY - 22, 210, 50, { rot: 3 }),
    k.text('body', `<ul>${e.did.map((line) => `<li>${line}</li>`).join('')}</ul>`, 66, didY, 868, { backing: 'torn', size: didSize, rot: 0.6 }),
    ...strips.items.map((item) => ({ ...item, y: item.y + stripsY })),
    side(k.text('title', e.big, 520, 1066, 420, { size: e.big.length > 7 ? 0.5 : e.big.length > 4 ? 0.72 : 0.95, ink: 'red', align: 'center', rot: -4 })),
    side(k.sticker('circle', 510, 1030, 440, 190, { ink: 'red', rot: -3 })),
    side(k.text('caption', e.bigNote, 510, 1232, 440, { align: 'center' })),
    side(k.text('note', e.sticky, 76, 1058, 380, { backing: 'sticky', rot: -3, size: 0.86 })),
  ];

  return [
    { id: e.id, name: e.title, items: left },
    { id: `${e.id}-2`, name: `${e.title}, what I did`, items: right },
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
  const size = titleSize(title) * 0.9;
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
        role: 'What I was',
        when: 'when',
        summary: 'One or two sentences on what this was.',
        did: ['The first thing I did.', 'The second thing.', 'The third.'],
        stack: ['Tool', 'Another tool'],
        big: '100',
        bigNote: 'a number worth circling',
        note: 'a note about the doodle',
        sticky: 'something to remember',
        art: 'star',
      }, 1, home ?? pageId),
  },
];
