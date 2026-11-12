// Turns a page of the book into DOM. Everything is sized in page units, so a page looks the same
// lying small in the grass as it does open for reading.

import { STICKERS, stickerMarkup } from './stickers';
import type { Item, Page } from './types';

export interface RenderContext {
  /** The number printed on a page, for anything that points at it. */
  numberOf(pageId: string): number | null;
  /** While editing, empty photo slots are drawn so they can be filled. */
  editing: boolean;
  /** Where the site lives: photos are kept under it. */
  base: string;
}

const KEPT = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'MARK', 'CODE', 'PRE', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'A', 'SPAN', 'SMALL',
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
    const inner = document.createElement('div');
    inner.className = 'inner';
    inner.innerHTML = shownHtml(item, ctx);
    el.append(inner);
  } else if (item.type === 'photo') {
    if (!item.src && !ctx.editing) return null;
    el = document.createElement('figure');
    el.className = `item photo f-${item.frame}${item.src ? '' : ' empty'}`;
    const shot = document.createElement('div');
    shot.className = 'shot';
    if (item.src) {
      const img = new Image();
      img.src = ctx.base + item.src;
      img.alt = item.alt ?? item.caption ?? '';
      img.draggable = false;
      img.decoding = 'async';
      if (item.focus) img.style.objectPosition = `${item.focus[0]}% ${item.focus[1]}%`;
      shot.append(img);
    }
    el.append(shot);
    if (item.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = item.caption;
      el.append(caption);
    }
  } else {
    el = document.createElement('div');
    el.className = `item sticker i-${item.ink ?? 'ink'}`;
    if (item.art.startsWith('tape')) {
      el.classList.add('tape', item.art);
    } else {
      el.innerHTML = stickerMarkup(item.art);
      if (STICKERS[item.art]?.stretch) el.classList.add('stretch');
      if (item.card) el.classList.add('carded');
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
