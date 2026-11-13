// Turns a page of the book into DOM. Everything is sized in page units, so a page looks the same
// lying small in the grass as it does open for reading.

import { fontVars } from './fonts';
import { STICKERS, stickerMarkup } from './stickers';
import { cutBounds, cutPolygon, scrapAround, tear, WHOLE } from './tear';
import type { CollageLayout, Item, Page } from './types';

export interface RenderContext {
  /** The number printed on a page, for anything that points at it. */
  numberOf(pageId: string): number | null;
  /** While editing, empty photo slots are drawn so they can be filled. */
  editing: boolean;
  /** Where the site lives: photos are kept under it. */
  base: string;
}

const KEPT = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'MARK', 'CODE', 'PRE', 'BR', 'HR', 'P', 'DIV', 'UL', 'OL', 'LI', 'A', 'SPAN', 'SMALL',
]);
const DROPPED = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'LINK', 'META']);

/** Text comes out of an editor, so only plain formatting gets through. */
export function clean(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }
      const el = child as HTMLElement;
      if (DROPPED.has(el.tagName)) {
        el.remove();
        continue;
      }
      walk(el);
      if (!KEPT.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        continue;
      }
      for (const { name, value } of [...el.attributes]) {
        const href = el.tagName === 'A' && name === 'href' && /^(https?:|mailto:|#)/i.test(value);
        if (!href) el.removeAttribute(name);
      }
      if (el.tagName === 'A' && /^https?:/i.test(el.getAttribute('href') ?? '')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noreferrer');
      }
    }
  };
  walk(template.content);
  return template.innerHTML;
}

/** How a collage is laid out, in page units: its border, the bottom edge, and the gaps between photos. */
export const COLLAGE_PADS: Record<CollageLayout, { side: number; top: number; bottom: number; gap: number }> = {
  grid: { side: 18, top: 18, bottom: 18, gap: 10 },
  mosaic: { side: 18, top: 18, bottom: 18, gap: 10 },
  strip: { side: 22, top: 22, bottom: 96, gap: 14 },
  film: { side: 22, top: 58, bottom: 58, gap: 18 },
};

/** Columns and rows for `count` photos, and how many of each every photo spans. */
export function collageGrid(layout: CollageLayout, count: number) {
  const n = Math.max(1, count);
  const spans: [number, number][] = Array.from({ length: n }, () => [1, 1]);
  if (layout === 'strip') return { cols: 1, rows: n, spans };
  if (layout === 'film') return { cols: n, rows: 1, spans };
  if (layout === 'mosaic' && n > 1) {
    // One big, the rest down its side and then along underneath.
    spans[0] = [2, 2];
    if (n === 2) {
      spans[1] = [1, 2];
      return { cols: 3, rows: 2, spans };
    }
    const under = Math.max(0, n - 3);
    const rows = 2 + Math.ceil(under / 3);
    const spare = under % 3 ? 3 - (under % 3) : 0;
    if (spare) spans[n - 1] = [1 + spare, 1];
    return { cols: 3, rows, spans };
  }
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  // A short row: its first photo is wider.
  const spare = cols * rows - n;
  if (spare) spans[0] = [1 + spare, 1];
  return { cols, rows, spans };
}

/** A cut's line, from the photo's terms into the box the piece now fills. */
function cutOutline(cut: [number, number][]): [number, number][] {
  const { x0, y0, x1, y1 } = cutBounds(cut);
  const bw = Math.max(1e-3, x1 - x0);
  const bh = Math.max(1e-3, y1 - y0);
  return cut.map(([x, y]) => [(x - x0) / bw, (y - y0) / bh]);
}

function place(el: HTMLElement, item: Item) {
  el.dataset.id = item.id;
  el.style.setProperty('--x', `${item.x}`);
  el.style.setProperty('--y', `${item.y}`);
  el.style.setProperty('--w', `${item.w}`);
  if ('h' in item) el.style.setProperty('--h', `${item.h}`);
  if (item.rot) el.style.setProperty('--r', `${item.rot}deg`);
  if (item.goto) {
    el.dataset.goto = item.goto;
    el.tabIndex = 0;
    el.setAttribute('role', 'link');
  }
}

/** The words of a text item as they're shown, with page numbers filled in. */
export function shownHtml(item: Item & { type: 'text' }, ctx: RenderContext) {
  const html = clean(item.html);
  return item.goto ? html.replaceAll('{{page}}', `${ctx.numberOf(item.goto) ?? '?'}`) : html;
}

export function renderItem(item: Item, ctx: RenderContext): HTMLElement | null {
  let el: HTMLElement;
  if (item.type === 'text') {
    el = document.createElement('div');
    el.className = `item text s-${item.style} b-${item.backing ?? 'none'} i-${item.ink ?? 'ink'} a-${item.align ?? 'left'}`;
    if (item.size && item.size !== 1) el.style.setProperty('--k', `${item.size}`);
    if (item.font) {
      el.classList.add('own-font');
      for (const [name, value] of Object.entries(fontVars('own', item.font))) el.style.setProperty(name, value);
    }
    const inner = document.createElement('div');
    inner.className = 'inner';
    inner.innerHTML = shownHtml(item, ctx);
    el.append(inner);
  } else if (item.type === 'photo') {
    if (!item.src && !ctx.editing) return null;
    el = document.createElement('figure');
    const cut = item.cut && item.cut.length > 2 ? item.cut : null;
    // A cut or a tear decides the outline, so a shape doesn't come into it.
    const shape = cut || item.edge ? 'rect' : (item.shape ?? 'rect');
    el.className = `item photo f-${item.frame} sh-${shape}${item.src ? '' : ' empty'}`;
    if (cut) el.classList.add('cut');
    if (item.edge) el.classList.add(`edge-${item.edge}`);
    if (item.tone) el.classList.add(`tone-${item.tone}`);
    if (item.frame === 'taped' && item.tape) el.classList.add(item.tape);
    const loose = item.frame === 'none' || item.frame === 'sticker';
    if (item.paper && loose) {
      const at = scrapAround(item.w, item.h, item.id);
      const scrap = document.createElement('div');
      scrap.className = `scrap p-${item.paper}`;
      scrap.style.cssText = `left:calc(var(--u) * ${-at.left});top:calc(var(--u) * ${-at.top});width:calc(var(--u) * ${at.w});height:calc(var(--u) * ${at.h});rotate:${at.turn}deg;clip-path:${at.core}`;
      const face = document.createElement('i');
      face.style.clipPath = at.edge;
      scrap.append(face);
      el.append(scrap);
      el.classList.add('on-scrap');
    }
    const shot = document.createElement('div');
    shot.className = 'shot';
    const outline = cut ? cutOutline(cut) : WHOLE;
    if (item.edge === 'torn') {
      const torn = tear(outline, item.w, item.h, item.id);
      const core = document.createElement('div');
      core.className = 'core';
      core.style.clipPath = torn.core;
      el.append(core);
      shot.style.clipPath = torn.edge;
    } else if (cut) {
      shot.style.clipPath = cutPolygon(outline);
    }
    if (item.src) {
      const img = new Image();
      img.src = ctx.base + item.src;
      img.alt = item.alt ?? item.caption ?? '';
      img.draggable = false;
      img.decoding = 'async';
      if (cut) {
        // The whole photo, placed so the piece cut out of it fills the box.
        const { x0, y0, x1, y1 } = cutBounds(cut);
        const bw = Math.max(1e-3, x1 - x0);
        const bh = Math.max(1e-3, y1 - y0);
        img.style.cssText = `position:absolute;max-width:none;object-fit:fill;width:${(100 / bw).toFixed(3)}%;height:${(100 / bh).toFixed(3)}%;left:${((-x0 / bw) * 100).toFixed(3)}%;top:${((-y0 / bh) * 100).toFixed(3)}%`;
      } else if (item.focus) {
        img.style.objectPosition = `${item.focus[0]}% ${item.focus[1]}%`;
      }
      shot.append(img);
    }
    el.append(shot);
    if (item.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = item.caption;
      el.append(caption);
    }
  } else if (item.type === 'collage') {
    if (!item.photos.length && !ctx.editing) return null;
    el = document.createElement('figure');
    el.className = `item collage l-${item.layout}${item.photos.length ? '' : ' empty'}`;
    const { cols, rows, spans } = collageGrid(item.layout, item.photos.length);
    const pad = COLLAGE_PADS[item.layout];
    el.style.setProperty('--cols', `${cols}`);
    el.style.setProperty('--rows', `${rows}`);
    el.style.setProperty('--side', `${pad.side}`);
    el.style.setProperty('--top', `${pad.top}`);
    el.style.setProperty('--bottom', `${pad.bottom}`);
    el.style.setProperty('--gap', `${pad.gap}`);
    const cells = document.createElement('div');
    cells.className = 'cells';
    item.photos.forEach((photo, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.n = `${i}`;
      const [across, down] = spans[i];
      if (across > 1) cell.style.gridColumn = `span ${across}`;
      if (down > 1) cell.style.gridRow = `span ${down}`;
      const img = new Image();
      img.src = ctx.base + photo.src;
      img.alt = photo.alt ?? '';
      img.draggable = false;
      img.decoding = 'async';
      if (photo.focus) img.style.objectPosition = `${photo.focus[0]}% ${photo.focus[1]}%`;
      cell.append(img);
      cells.append(cell);
    });
    el.append(cells);
    if (item.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = item.caption;
      el.append(caption);
    }
  } else {
    el = document.createElement('div');
    el.className = `item sticker i-${item.ink ?? 'ink'}${item.cut ? ' cut' : ''}`;
    if (item.art.startsWith('tape')) {
      el.classList.add('tape', item.art);
    } else {
      el.innerHTML = stickerMarkup(item.art);
      if (STICKERS[item.art]?.stretch) el.classList.add('stretch');
      if (item.card) el.classList.add('carded', `on-${item.on ?? 'white'}`);
    }
    el.setAttribute('aria-hidden', 'true');
  }
  place(el, item);
  return el;
}

/** A page, or a blank sheet for `null`. `number` is what's printed in its corner. */
export function renderPage(page: Page | null, number: number | null, ctx: RenderContext) {
  const el = document.createElement('section');
  el.className = `page paper-${page?.paper ?? 'plain'}`;
  const items = document.createElement('div');
  items.className = 'items';
  if (page) {
    el.dataset.page = page.id;
    for (const item of page.items) {
      const node = renderItem(item, ctx);
      if (node) items.append(node);
    }
  }
  el.append(items);
  if (number !== null) {
    const folio = document.createElement('span');
    folio.className = 'folio';
    folio.textContent = `${number}`;
    el.append(folio);
  }
  return el;
}
