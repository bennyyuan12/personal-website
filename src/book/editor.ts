// Editing the book, in the browser, on the page itself: `npm run edit`.
// Drag things about, double-click text to rewrite it, drop photos in, add and remove pages, then
// save. Saving writes public/book/book.json (and photos into public/book/photos) through the dev
// server, so this only exists while developing and none of it ships with the site.

import './editor.css';
import type { Scene } from '../scene';
import type { Book } from './book';
import { clean } from './render';
import { STICKERS, TAPES, stickerMarkup } from './stickers';
import { TEMPLATES } from './templates';
import type { Backing, BookData, Frame, Ink, Item, Page, Paper, PhotoItem, Section, StickerItem, TextItem, TextStyle } from './types';

const PANEL_WIDTH = 296;

const TEXT_KINDS: { label: string; make: Partial<TextItem> & { style: TextStyle; html: string; w: number } }[] = [
  { label: 'Title', make: { style: 'title', html: 'A title', w: 800, rot: -1.5 } },
  { label: 'Heading', make: { style: 'heading', html: 'A heading', w: 700, rot: -1 } },
  { label: 'Typed text', make: { style: 'body', html: '<p>Double-click to write.</p>', w: 800 } },
  { label: 'Note', make: { style: 'note', html: 'a note in pen', w: 460, rot: -3 } },
  { label: 'Caption', make: { style: 'caption', html: 'a caption', w: 420 } },
  { label: 'Label', make: { style: 'label', html: 'Label', w: 320, backing: 'dymo' } },
  { label: 'Stamp', make: { style: 'stamp', html: 'Stamp', w: 340, ink: 'red', rot: 5, align: 'center' } },
  { label: 'Sticky note', make: { style: 'note', html: 'remember this', w: 380, backing: 'sticky', rot: -3, size: 0.86 } },
  { label: 'Index card', make: { style: 'body', html: '<p>Typed on a card.</p>', w: 640, backing: 'card', size: 0.9, rot: -1 } },
  { label: 'Torn paper', make: { style: 'body', html: '<ul><li>One thing.</li><li>Another.</li></ul>', w: 820, backing: 'torn', size: 0.9 } },
  { label: 'Code', make: { style: 'code', html: 'const grass = true;', w: 820 } },
];
const STYLES: [TextStyle, string][] = [
  ['title', 'Title'], ['heading', 'Heading'], ['body', 'Typed'], ['note', 'Note'], ['caption', 'Caption'],
  ['label', 'Label'], ['stamp', 'Stamp'], ['code', 'Code'],
];
const BACKINGS: [Backing, string][] = [
  ['none', 'Nothing'], ['sticky', 'Sticky note'], ['card', 'Index card'], ['torn', 'Torn paper'], ['kraft', 'Kraft label'], ['dymo', 'Label tape'],
];
const INKS: Ink[] = ['ink', 'red', 'blue', 'green', 'white'];
const INK_COLORS: Record<Ink, string> = { ink: '#26221b', red: '#b23a2a', blue: '#2c4a86', green: '#3d6b35', white: '#fbf7ea' };
const PAPERS: [Paper, string][] = [['plain', 'Plain'], ['lined', 'Lined'], ['grid', 'Squared'], ['dots', 'Dotted'], ['kraft', 'Kraft']];
const FRAMES: [Frame, string][] = [['polaroid', 'Polaroid'], ['taped', 'Taped print'], ['print', 'Print'], ['none', 'No border']];

type Props = Record<string, unknown>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: (Node | string | null)[]) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') el.className = value as string;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'style') el.style.cssText = value as string;
    else if (value !== undefined && value !== false) (el as unknown as Props)[key] = value;
  }
  for (const child of children) if (child !== null) el.append(child);
  return el;
}

const uid = () => `i${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
const slug = (words: string) => words.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

interface Drag {
  handle: string;
  x: number;
  y: number;
  /** The item as it was when the drag began. */
  start: Item;
  /** Its middle on screen, for turning it. */
  cx: number;
  cy: number;
  moved: boolean;
  el: HTMLElement;
}

export function startEditor(scene: Scene, data: BookData) {
  return new Editor(scene, data);
}

class Editor {
  private readonly book: Book;
  private readonly panel = h('aside', { class: 'ed', 'ariaLabel': 'Scrapbook editor' });
  private readonly status = h('span', { class: 'ed-status' });
  private selected: { page: Page; item: Item } | null = null;
  /** The page new things go on. */
  private target: Page | null = null;
  private typing: HTMLElement | null = null;
  private drag: Drag | null = null;
  private past: string[] = [];
  private future: string[] = [];
  private saved: string;
  private now: string;
  private busy = false;

  constructor(
    scene: Scene,
    private readonly data: BookData,
  ) {
    this.book = scene.book;
    this.saved = this.now = JSON.stringify(data);
    document.body.classList.add('editing');
    document.body.append(this.panel);
    this.book.locked = true;
    this.book.inset = PANEL_WIDTH;
    this.book.editing = true;
    scene.layout();
    this.book.onPresent = () => this.sync();

    const el = this.book.el;
    el.addEventListener('pointerdown', (e) => this.down(e), true);
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', () => this.up());
    el.addEventListener('dblclick', (e) => this.doubleClicked(e));
    el.addEventListener('focusout', (e) => {
      if (this.typing && e.target === this.typing) this.stopTyping();
    });
    el.addEventListener('paste', (e) => {
      if (!this.typing) return;
      // Whatever was copied arrives as plain words, or it drags its own fonts and colors in.
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
    });
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      const pageEl = (e.target as HTMLElement).closest<HTMLElement>('.slot .page');
      const page = pageEl ? this.pageFor(pageEl) : this.target;
      if (page && pageEl) {
        const box = pageEl.getBoundingClientRect();
        void this.addPhotos(files, page, { x: (e.clientX - box.left) / this.book.unit, y: (e.clientY - box.top) / this.book.unit });
      } else if (page) {
        void this.addPhotos(files, page);
      }
    });
    window.addEventListener('beforeunload', (e) => {
      if (this.now !== this.saved) e.preventDefault();
    });
    this.sync();
  }

  // ---- finding things ----

  private pageFor(pageEl: HTMLElement) {
    return this.book.showing.find((shown) => shown.el === pageEl)?.page ?? null;
  }

  private sectionOf(page: Page) {
    return this.data.sections.find((section) => section.pages.includes(page)) ?? null;
  }

  private elementOf(item: Item) {
    return this.book.el.querySelector<HTMLElement>(`.slot [data-id="${CSS.escape(item.id)}"]`);
  }

  private allPages() {
    return this.data.sections.flatMap((section) => section.pages);
  }

  // ---- keeping the page and the panel in step ----

  /** The pages on show were put in place again: mark what's selected, and redraw the panel. */
  private sync() {
    const showing = this.book.showing.map((shown) => shown.page).filter((page): page is Page => !!page);
    if (this.selected && !showing.includes(this.selected.page)) this.selected = null;
    if (this.selected && !this.selected.page.items.includes(this.selected.item)) this.selected = null;
    if (!this.target || !showing.includes(this.target)) this.target = this.selected?.page ?? showing[0] ?? null;
    this.decorate();
    this.renderPanel();
  }

  private decorate() {
    for (const old of this.book.el.querySelectorAll('.slot .item.sel')) {
      old.classList.remove('sel');
      old.querySelectorAll('.h').forEach((handle) => handle.remove());
    }
    for (const page of this.book.el.querySelectorAll('.slot .page')) {
      page.classList.toggle('target', this.pageFor(page as HTMLElement) === this.target && this.target !== null);
    }
    if (!this.selected) return;
    const el = this.elementOf(this.selected.item);
    if (!el) return;
    el.classList.add('sel');
    const { item } = this.selected;
    const handles = item.type === 'text' ? ['rot', 'e', 'se'] : ['rot', 'se'];
    for (const name of handles) {
      const handle = document.createElement('i');
      handle.className = `h h-${name}`;
      handle.dataset.h = name;
      handle.title = name === 'rot' ? 'Turn' : name === 'e' ? 'Width' : item.type === 'text' ? 'Size of the writing' : 'Size';
      el.append(handle);
    }
  }

  private select(next: { page: Page; item: Item } | null) {
    this.selected = next;
    if (next) this.target = next.page;
    this.decorate();
    this.renderPanel();
  }

  /** Something changed: remember it for undo, and draw it. */
  private commit(redraw: 'page' | 'book' | 'none' = 'page') {
    const now = JSON.stringify(this.data);
    if (now !== this.now) {
      this.past.push(this.now);
      if (this.past.length > 120) this.past.shift();
      this.future = [];
      this.now = now;
    }
    if (redraw === 'book') this.book.setData(this.data);
    else if (redraw === 'page') this.book.redraw();
    else this.sync();
    this.showStatus();
  }

  private restore(json: string) {
    this.now = json;
    const kept = this.target?.id;
    this.data.sections = (JSON.parse(json) as BookData).sections;
    this.selected = null;
    this.target = this.allPages().find((page) => page.id === kept) ?? null;
    this.book.setData(this.data);
    this.showStatus();
  }

  private undo() {
    const previous = this.past.pop();
    if (previous === undefined) return;
    this.future.push(this.now);
    this.restore(previous);
  }

  private redo() {
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(this.now);
    this.restore(next);
  }

  private showStatus(message?: string) {
    this.status.textContent = message ?? (this.now === this.saved ? 'Saved' : 'Not saved yet');
    this.status.classList.toggle('dirty', this.now !== this.saved);
  }

  private async save() {
    this.stopTyping();
    if (this.busy) return;
    this.busy = true;
    this.showStatus('Saving…');
    const json = JSON.stringify(this.data);
    try {
      const response = await fetch('/__book/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Book-Edit': '1' },
        body: json,
      });
      if (!response.ok) throw new Error(await response.text());
      this.saved = json;
      this.showStatus();
    } catch (err) {
      this.showStatus(`Couldn’t save: ${err instanceof Error ? err.message : err}`);
    }
    this.busy = false;
  }

  // ---- moving, sizing and turning things on the page ----

  private down(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (e.button > 0 || target.closest('.tab, button')) return;
    const pageEl = target.closest<HTMLElement>('.slot .page');
    if (!pageEl) return;
    const page = this.pageFor(pageEl);
    if (!page) return;
    const itemEl = target.closest<HTMLElement>('.item');
    const item = itemEl ? page.items.find((candidate) => candidate.id === itemEl.dataset.id) : undefined;
    if (!itemEl || !item) {
      this.stopTyping();
      this.target = page;
      this.select(null);
      return;
    }
    if (this.typing && this.selected?.item === item) return; // a click in the words being written
    this.stopTyping();
    if (this.selected?.item !== item) this.select({ page, item });
    e.preventDefault();
    const box = itemEl.getBoundingClientRect();
    this.drag = {
      handle: target.closest<HTMLElement>('.h')?.dataset.h ?? 'move',
      x: e.clientX,
      y: e.clientY,
      start: structuredClone(item),
      cx: box.left + box.width / 2,
      cy: box.top + box.height / 2,
      moved: false,
      el: this.elementOf(item) ?? itemEl,
    };
  }

  private move(e: PointerEvent) {
    const drag = this.drag;
    if (!drag || !this.selected) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return;
    drag.moved = true;
    const unit = this.book.unit;
    const dx = (e.clientX - drag.x) / unit;
    const dy = (e.clientY - drag.y) / unit;
    const { item } = this.selected;
    const start = drag.start;
    // Handles move along the thing's own sides, however it's been turned.
    const angle = ((start.rot ?? 0) * Math.PI) / 180;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const down = -dx * Math.sin(angle) + dy * Math.cos(angle);
    if (drag.handle === 'move') {
      item.x = Math.round(start.x + dx);
      item.y = Math.round(start.y + dy);
    } else if (drag.handle === 'e') {
      item.w = Math.max(40, Math.round(start.w + along));
    } else if (drag.handle === 'se') {
      if (item.type === 'text') {
        const from = (start as TextItem).size ?? 1;
        item.size = clamp(Math.round(from * (1 + down / 260) * 100) / 100, 0.3, 4);
      } else {
        const startHeight = (start as PhotoItem | StickerItem).h;
        const fixed = item.type === 'sticker' ? !STICKERS[item.art]?.stretch && !item.art.startsWith('tape') : e.shiftKey;
        item.w = Math.max(24, Math.round(start.w + along));
        item.h = fixed ? Math.round((item.w * startHeight) / start.w) : Math.max(16, Math.round(startHeight + down));
      }
    } else if (drag.handle === 'rot') {
      let turned = (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180) / Math.PI + 90;
      turned = ((turned + 540) % 360) - 180;
      if (e.shiftKey) turned = Math.round(turned / 15) * 15;
      else if (Math.abs(turned) < 2) turned = 0;
      item.rot = Math.round(turned * 10) / 10 || undefined;
    }
    this.paint(item, drag.el);
  }

  /** Show an item where its numbers now say it is, without redrawing the page. */
  private paint(item: Item, el: HTMLElement) {
    el.style.setProperty('--x', `${item.x}`);
    el.style.setProperty('--y', `${item.y}`);
    el.style.setProperty('--w', `${item.w}`);
    if ('h' in item) el.style.setProperty('--h', `${item.h}`);
    el.style.setProperty('--r', `${item.rot ?? 0}deg`);
    if (item.type === 'text') el.style.setProperty('--k', `${item.size ?? 1}`);
  }

  private up() {
    const drag = this.drag;
    this.drag = null;
    if (!drag?.moved || !this.selected) return;
    const { page, item } = this.selected;
    if (drag.handle === 'move') {
      // Dragged across the spine: it belongs to the facing page now.
      const showing = this.book.showing;
      const here = showing.findIndex((shown) => shown.page === page);
      const middle = item.x + item.w / 2;
      const other = middle > 1000 ? showing[here + 1] : middle < 0 ? showing[here - 1] : undefined;
      if (other?.page) {
        page.items.splice(page.items.indexOf(item), 1);
        item.x += middle > 1000 ? -1000 : 1000;
        other.page.items.push(item);
        this.selected = { page: other.page, item };
        this.target = other.page;
      }
    }
    this.commit();
  }

  // ---- writing ----

  private doubleClicked(e: MouseEvent) {
    const itemEl = (e.target as HTMLElement).closest<HTMLElement>('.slot .item');
    if (!itemEl || !this.selected || itemEl.dataset.id !== this.selected.item.id) return;
    const { item } = this.selected;
    if (item.type === 'text') this.startTyping();
    else if (item.type === 'photo') this.pickPhotos((files) => void this.replacePhoto(item, files[0]));
  }

  private startTyping() {
    if (!this.selected || this.selected.item.type !== 'text' || this.typing) return;
    const el = this.elementOf(this.selected.item);
    const inner = el?.querySelector<HTMLElement>('.inner');
    if (!el || !inner) return;
    // The words as they're stored, so a page number stays a placeholder and isn't frozen in.
    inner.innerHTML = clean(this.selected.item.html);
    inner.contentEditable = 'true';
    el.classList.add('typing');
    this.typing = inner;
    inner.focus();
    const range = document.createRange();
    range.selectNodeContents(inner);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.renderPanel();
  }

  private stopTyping() {
    const inner = this.typing;
    if (!inner) return;
    this.typing = null;
    inner.contentEditable = 'false';
    const item = this.selected?.item;
    if (item?.type === 'text') item.html = clean(inner.innerHTML).trim() || '…';
    this.commit();
  }

  /** Bold and the like, on whatever words are selected while writing. */
  private format(command: string, value?: string) {
    if (!this.typing) return;
    if (command === 'mark') {
      const words = getSelection()?.toString();
      if (words) document.execCommand('insertHTML', false, `<mark>${words.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)}</mark>`);
    } else if (command === 'createLink') {
      const url = prompt('Link to (https://…)');
      if (url) document.execCommand('createLink', false, url);
    } else {
      document.execCommand(command, false, value);
    }
  }

  // ---- adding and removing ----

  private add(item: Item, page = this.target) {
    if (!page) return;
    this.stopTyping();
    page.items.push(item);
    this.selected = { page, item };
    this.commit();
  }

  private addText(kind: (typeof TEXT_KINDS)[number]) {
    const { w } = kind.make;
    this.add({ id: uid(), type: 'text', x: Math.round((1000 - w) / 2), y: 560, ...kind.make });
  }

  private addSticker(art: string) {
    const tape = art.startsWith('tape');
    const ratio = tape ? 4.4 : (STICKERS[art]?.ratio ?? 1);
    const w = tape ? 220 : ratio > 2 ? 360 : 220;
    this.add({ id: uid(), type: 'sticker', art, x: Math.round((1000 - w) / 2), y: 600, w, h: Math.round(w / ratio), rot: tape ? -4 : undefined });
  }

  private pickPhotos(then: (files: File[]) => void, many = false) {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: many });
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])];
      if (files.length) then(files);
    });
    input.click();
  }

  /** Shrink a photo to a sensible size, send it to be kept with the site, and get back where it lives. */
  private async upload(file: File) {
    let blob: Blob = file;
    let name = file.name;
    let ratio = 1;
    if (/svg|gif/.test(file.type)) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
      URL.revokeObjectURL(img.src);
    } else {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = h('canvas', { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      ratio = canvas.width / canvas.height;
      const encode = (type: string) => new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not read the photo'))), type, 0.86));
      blob = file.type === 'image/png' ? await encode('image/png') : await encode('image/jpeg');
      if (blob.type === 'image/png' && blob.size > 1.5e6) blob = await encode('image/jpeg');
      name = name.replace(/\.[^.]+$/, '') + (blob.type === 'image/png' ? '.png' : '.jpg');
    }
    const response = await fetch(`/__book/photo?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream', 'X-Book-Edit': '1' },
      body: blob,
    });
    if (!response.ok) throw new Error(await response.text());
    const { src } = (await response.json()) as { src: string };
    // The dev server takes a moment to notice a new file; until it has, it answers with the page.
    for (let tries = 0; tries < 30; tries++) {
      const check = await fetch(import.meta.env.BASE_URL + src, { cache: 'reload' });
      if (check.ok && check.headers.get('content-type')?.startsWith('image/')) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { src, ratio };
  }

  private async addPhotos(files: File[], page: Page, at?: { x: number; y: number }) {
    this.showStatus('Adding photos…');
    try {
      for (const [i, file] of files.entries()) {
        const { src, ratio } = await this.upload(file);
        const w = 440;
        // A polaroid has a wide bottom edge; the picture itself keeps its shape.
        const h = Math.round((w - 48) / ratio + 128);
        this.add({
          id: uid(), type: 'photo', src, frame: 'polaroid', w, h,
          x: Math.round(clamp((at?.x ?? 500) - w / 2 + i * 40, 20, 980 - w)),
          y: Math.round(clamp((at?.y ?? 600) - h / 2 + i * 40, 20, 1350 - h)),
          rot: [-3, 4, -2, 3][i % 4],
        }, page);
      }
    } catch (err) {
      this.showStatus(`Couldn’t add the photo: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async replacePhoto(item: PhotoItem, file: File) {
    try {
      item.src = (await this.upload(file)).src;
      this.commit();
    } catch (err) {
      this.showStatus(`Couldn’t add the photo: ${err instanceof Error ? err.message : err}`);
    }
  }

  private remove() {
    if (!this.selected) return;
    const { page, item } = this.selected;
    page.items.splice(page.items.indexOf(item), 1);
    this.selected = null;
    this.commit();
  }

  private duplicate() {
    if (!this.selected) return;
    const { page, item } = this.selected;
    const copy = { ...structuredClone(item), id: uid(), x: item.x + 30, y: item.y + 30 };
    page.items.push(copy);
    this.selected = { page, item: copy };
    this.commit();
  }

  /** Further up or down the pile of things on the page. */
  private restack(by: number) {
    if (!this.selected) return;
    const { page, item } = this.selected;
    const from = page.items.indexOf(item);
    const to = clamp(from + by, 0, page.items.length - 1);
    page.items.splice(from, 1);
    page.items.splice(to, 0, item);
    this.commit();
  }

  private key(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void this.save();
      return;
    }
    if (this.typing) {
      if (e.key === 'Escape') this.stopTyping();
      return;
    }
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.duplicate();
    } else if (!this.selected) {
      if (e.key === 'ArrowRight' && !mod) this.book.next();
      else if (e.key === 'ArrowLeft' && !mod) this.book.previous();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.remove();
    } else if (e.key === 'Escape') {
      this.select(null);
    } else if (e.key === 'Enter' && this.selected.item.type === 'text') {
      e.preventDefault();
      this.startTyping();
    } else if (e.key === ']') {
      this.restack(1);
    } else if (e.key === '[') {
      this.restack(-1);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 20 : 2;
      const { item } = this.selected;
      if (e.key === 'ArrowLeft') item.x -= step;
      if (e.key === 'ArrowRight') item.x += step;
      if (e.key === 'ArrowUp') item.y -= step;
      if (e.key === 'ArrowDown') item.y += step;
      this.commit();
    }
  }

  // ---- pages and sections ----

  private freshId(wanted: string) {
    const taken = new Set(this.allPages().map((page) => page.id));
    const base = slug(wanted) || 'page';
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
  }

  private addPages(templateKey: string) {
    const template = TEMPLATES.find((candidate) => candidate.key === templateKey);
    const section = (this.target && this.sectionOf(this.target)) ?? this.data.sections[this.data.sections.length - 1];
    if (!template || !section) return;
    const home = section.pages[0]?.id ?? null;
    const pages = template.make(uid, this.freshId(template.key === 'post' ? 'post' : template.key === 'entry' ? 'entry' : 'page'), home);
    let at = this.target ? section.pages.indexOf(this.target) + 1 : section.pages.length;
    // Two facing pages go in after a whole spread, so they stay facing each other.
    if (pages.length % 2 === 0 && at % 2 === 1) at = Math.min(section.pages.length, at + 1);
    // Their second page may have taken a name that's in use.
    for (const page of pages.slice(1)) page.id = this.freshId(page.id);
    section.pages.splice(at, 0, ...pages);
    this.target = pages[0];
    this.selected = null;
    this.commit('book');
    this.book.goToId(pages[0].id);
  }

  private removePage(page: Page) {
    const section = this.sectionOf(page);
    if (!section || !confirm(`Delete the page “${page.name ?? page.id}” and everything on it?`)) return;
    section.pages.splice(section.pages.indexOf(page), 1);
    // Nothing should still point at it.
    for (const other of this.allPages()) {
      for (const item of other.items) if (item.goto === page.id) delete item.goto;
    }
    this.selected = null;
    this.target = null;
    this.commit('book');
  }

  private movePage(page: Page, by: number) {
    const section = this.sectionOf(page);
    if (!section) return;
    const from = section.pages.indexOf(page);
    const to = from + by;
    if (to < 0 || to >= section.pages.length) return;
    section.pages.splice(from, 1);
    section.pages.splice(to, 0, page);
    this.commit('book');
    this.book.goToId(page.id);
  }

  private duplicatePage(page: Page) {
    const section = this.sectionOf(page);
    if (!section) return;
    const copy: Page = structuredClone(page);
    copy.id = this.freshId(page.id);
    copy.name = page.name ? `${page.name} (copy)` : undefined;
    for (const item of copy.items) item.id = uid();
    section.pages.splice(section.pages.indexOf(page) + 1, 0, copy);
    this.target = copy;
    this.commit('book');
    this.book.goToId(copy.id);
  }

  /** A page's id is its address, and other pages point at it by that. */
  private renamePage(page: Page, wanted: string) {
    const id = slug(wanted);
    if (!id || id === page.id) return;
    if (this.allPages().some((other) => other.id === id)) {
      this.showStatus(`Another page is already called “${id}”.`);
      this.renderPanel();
      return;
    }
    for (const other of this.allPages()) {
      for (const item of other.items) if (item.goto === page.id) item.goto = id;
    }
    page.id = id;
    this.commit('book');
  }

  private addSection() {
    const title = prompt('What is the new section called?');
    if (!title) return;
    const section: Section = {
      id: slug(title) || uid(),
      title,
      tab: title.length > 12 ? title.slice(0, 12) : title,
      color: '#3d5a80',
      pages: [{ id: this.freshId(title), name: title, items: [] }],
    };
    if (this.data.sections.some((other) => other.id === section.id)) section.id = `${section.id}-${uid()}`;
    this.data.sections.push(section);
    this.target = section.pages[0];
    this.commit('book');
    this.book.goToId(section.pages[0].id);
  }

  private removeSection(section: Section) {
    if (!confirm(`Delete the section “${section.title}” and its ${section.pages.length} pages?`)) return;
    const gone = new Set(section.pages.map((page) => page.id));
    this.data.sections.splice(this.data.sections.indexOf(section), 1);
    for (const page of this.allPages()) {
      for (const item of page.items) if (item.goto && gone.has(item.goto)) delete item.goto;
    }
    this.selected = null;
    this.target = null;
    this.commit('book');
  }

  private moveSection(section: Section, by: number) {
    const from = this.data.sections.indexOf(section);
    const to = from + by;
    if (to < 0 || to >= this.data.sections.length) return;
    this.data.sections.splice(from, 1);
    this.data.sections.splice(to, 0, section);
    this.commit('book');
  }

  // ---- the panel ----

  private renderPanel() {
    // Leave it alone while someone is typing into one of its own boxes.
    if (this.panel.contains(document.activeElement) && document.activeElement?.matches('input:not([type=color]), textarea')) return;
    const scroll = this.panel.scrollTop;
    const button = (label: string, act: () => void, props: Props = {}) =>
      h('button', { type: 'button', onclick: act, onmousedown: (e: Event) => e.preventDefault(), ...props }, label);
    const field = (label: string, control: HTMLElement) => h('label', { class: 'ed-field' }, h('span', {}, label), control);
    const select = <T extends string>(options: [T, string][], value: T, change: (value: T) => void) => {
      const el = h('select', { onchange: () => change(el.value as T) });
      for (const [key, label] of options) el.append(h('option', { value: key, selected: key === value }, label));
      return el;
    };
    const text = (value: string, change: (value: string) => void, props: Props = {}) => {
      const el = h('input', { type: 'text', value, ...props });
      el.addEventListener('change', () => {
        el.blur();
        change(el.value);
      });
      return el;
    };
    const number = (value: number, change: (value: number) => void, step = 1) => {
      const el = h('input', { type: 'number', value: `${value}`, step: `${step}` });
      el.addEventListener('change', () => {
        el.blur();
        if (el.value !== '' && Number.isFinite(Number(el.value))) change(Number(el.value));
      });
      return el;
    };
    const group = (title: string, ...children: (Node | null)[]) => h('section', { class: 'ed-group' }, h('h3', {}, title), ...children);
    const row = (...children: (Node | null)[]) => h('div', { class: 'ed-row' }, ...children);

    this.showStatus();
    const head = h('header', { class: 'ed-head' },
      h('h2', {}, 'Scrapbook editor'),
      row(button('Save', () => void this.save(), { class: 'primary', title: '⌘S' }), this.status),
      row(
        button('Undo', () => this.undo(), { disabled: !this.past.length, title: '⌘Z' }),
        button('Redo', () => this.redo(), { disabled: !this.future.length, title: '⇧⌘Z' }),
        h('a', { href: `/#${this.target?.id ?? ''}`, target: '_blank', class: 'ed-link' }, 'See it live ↗'),
      ),
    );

    // Every page, by section.
    const showing = new Set(this.book.showing.map((shown) => shown.page));
    const list = h('div', { class: 'ed-pages' });
    let number_ = 0;
    for (const section of this.data.sections) {
      const sectionIndex = this.data.sections.indexOf(section);
      list.append(h('div', { class: 'ed-section' },
        h('i', { class: 'ed-chip', style: `background:${section.color}` }),
        text(section.title, (value) => { section.title = value || section.title; this.commit('book'); }, { title: 'Section name', class: 'ed-section-name' }),
        button('↑', () => this.moveSection(section, -1), { disabled: sectionIndex === 0, title: 'Move this section earlier' }),
        button('↓', () => this.moveSection(section, 1), { disabled: sectionIndex === this.data.sections.length - 1, title: 'Move this section later' }),
        button('×', () => this.removeSection(section), { title: 'Delete this section' }),
      ));
      list.append(h('div', { class: 'ed-section-more' },
        field('Tag', text(section.tab ?? '', (value) => { section.tab = value.trim() || null; this.commit('book'); }, { placeholder: 'no tag', maxLength: 14 })),
        field('Color', h('input', { type: 'color', value: section.color, onchange: (e: Event) => { section.color = (e.target as HTMLInputElement).value; this.commit('book'); } })),
      ));
      for (const page of section.pages) {
        number_++;
        list.append(h('button', {
          type: 'button',
          class: `ed-page${showing.has(page) ? ' showing' : ''}${page === this.target ? ' target' : ''}`,
          onclick: () => { this.target = page; this.selected = null; this.book.goToId(page.id); this.sync(); },
        }, h('b', {}, `${number_}`), page.name ?? page.id));
      }
      if (section.pages.length % 2) number_++;
    }
    const template = select(TEMPLATES.map((t) => [t.key, t.label] as [string, string]), 'blank', () => {});
    const pages = group('Pages', list,
      row(template, button('+ Add', () => this.addPages(template.value), { title: 'Add after the page you’re on' })),
      row(button('+ New section', () => this.addSection())),
    );

    const page = this.target;
    const thisPage = page
      ? group('This page',
          field('Name', text(page.name ?? '', (value) => { page.name = value || undefined; this.commit('none'); }, { placeholder: page.id })),
          field('Address', text(page.id, (value) => this.renamePage(page, value), { title: 'The site’s URL ends in #this while the page is open' })),
          field('Paper', select(PAPERS, page.paper ?? 'plain', (value) => { page.paper = value === 'plain' ? undefined : value; this.commit(); })),
          row(
            button('← Earlier', () => this.movePage(page, -1)),
            button('Later →', () => this.movePage(page, 1)),
            button('Copy', () => this.duplicatePage(page)),
            button('Delete', () => this.removePage(page), { class: 'danger' }),
          ),
        )
      : group('This page', h('p', { class: 'ed-hint' }, 'This side is the blank back of the last page in its section. Add a page to use it.'));

    const stickers = h('div', { class: 'ed-stickers' });
    for (const [key, sticker] of Object.entries(STICKERS)) {
      const pick = button('', () => this.addSticker(key), { title: sticker.label, 'ariaLabel': sticker.label });
      pick.innerHTML = stickerMarkup(key);
      stickers.append(pick);
    }
    for (const [key, label] of Object.entries(TAPES)) {
      stickers.append(button('', () => this.addSticker(key), { title: label, 'ariaLabel': label, class: `ed-tape ${key}` }));
    }
    const adding = page
      ? group('Add to this page',
          h('div', { class: 'ed-kinds' }, ...TEXT_KINDS.map((kind) => button(kind.label, () => this.addText(kind)))),
          row(
            button('Photos…', () => this.pickPhotos((files) => void this.addPhotos(files, page), true), { class: 'primary' }),
            h('span', { class: 'ed-hint' }, 'or drop them on the page'),
          ),
          stickers,
        )
      : null;

    this.panel.replaceChildren(head, pages, thisPage);
    if (adding) this.panel.append(adding);
    if (this.selected) this.panel.append(this.selectedGroup(this.selected.item, { button, field, select, text, number, group, row }));
    this.panel.append(h('p', { class: 'ed-hint ed-help' },
      'Click to select. Drag to move, and use the dots to turn or resize. Double-click words to rewrite them. Delete removes, ⌘D copies, [ and ] change what’s on top, arrows nudge.'));
    this.panel.scrollTop = scroll;
  }

  private selectedGroup(
    item: Item,
    ui: {
      button: (label: string, act: () => void, props?: Props) => HTMLButtonElement;
      field: (label: string, control: HTMLElement) => HTMLElement;
      select: <T extends string>(options: [T, string][], value: T, change: (value: T) => void) => HTMLSelectElement;
      text: (value: string, change: (value: string) => void, props?: Props) => HTMLInputElement;
      number: (value: number, change: (value: number) => void, step?: number) => HTMLInputElement;
      group: (title: string, ...children: (Node | null)[]) => HTMLElement;
      row: (...children: (Node | null)[]) => HTMLElement;
    },
  ) {
    const { button, field, select, text, number, group, row } = ui;
    const change = () => this.commit();
    const inks = (current: Ink | undefined, set: (ink: Ink) => void) =>
      h('div', { class: 'ed-inks' }, ...INKS.map((ink) =>
        button('', () => { set(ink); change(); }, { class: ink === (current ?? 'ink') ? 'on' : '', style: `background:${INK_COLORS[ink]}`, title: ink, 'ariaLabel': ink })));
    const parts: (Node | null)[] = [];

    if (item.type === 'text') {
      parts.push(
        field('Looks like', select(STYLES, item.style, (value) => { item.style = value; change(); })),
        field('Written on', select(BACKINGS, item.backing ?? 'none', (value) => { item.backing = value === 'none' ? undefined : value; change(); })),
        field('Ink', inks(item.ink, (ink) => { item.ink = ink === 'ink' ? undefined : ink; })),
        field('Lines up', select([['left', 'Left'], ['center', 'Middle'], ['right', 'Right']], item.align ?? 'left', (value) => { item.align = value === 'left' ? undefined : value; change(); })),
        field('Size', number(item.size ?? 1, (value) => { item.size = clamp(value, 0.3, 4); change(); }, 0.05)),
        row(
          button(this.typing ? 'Done writing' : 'Rewrite', () => (this.typing ? this.stopTyping() : this.startTyping()), { class: 'primary' }),
          button('B', () => this.format('bold'), { disabled: !this.typing, title: 'Bold', style: 'font-weight:700' }),
          button('I', () => this.format('italic'), { disabled: !this.typing, title: 'Italic', style: 'font-style:italic' }),
          button('Mark', () => this.format('mark'), { disabled: !this.typing, title: 'Highlighter' }),
          button('List', () => this.format('insertUnorderedList'), { disabled: !this.typing }),
          button('Link', () => this.format('createLink'), { disabled: !this.typing }),
        ),
      );
    } else if (item.type === 'photo') {
      parts.push(
        field('Frame', select(FRAMES, item.frame, (value) => { item.frame = value; change(); })),
        field('Caption', text(item.caption ?? '', (value) => { item.caption = value || undefined; change(); })),
        field('Describes', text(item.alt ?? '', (value) => { item.alt = value || undefined; change(); }, { placeholder: 'for people who can’t see it' })),
        field('In view', row(
          number(item.focus?.[0] ?? 50, (value) => { item.focus = [clamp(value, 0, 100), item.focus?.[1] ?? 50]; change(); }, 5),
          number(item.focus?.[1] ?? 50, (value) => { item.focus = [item.focus?.[0] ?? 50, clamp(value, 0, 100)]; change(); }, 5),
        )),
        row(button(item.src ? 'Change photo…' : 'Choose photo…', () => this.pickPhotos((files) => void this.replacePhoto(item, files[0])), { class: 'primary' })),
      );
    } else {
      const arts: [string, string][] = [...Object.entries(STICKERS).map(([key, s]) => [key, s.label] as [string, string]), ...Object.entries(TAPES)];
      parts.push(
        field('Drawing', select(arts, item.art, (value) => { item.art = value; change(); })),
        field('Ink', inks(item.ink, (ink) => { item.ink = ink === 'ink' ? undefined : ink; })),
        field('On a card', h('input', { type: 'checkbox', checked: !!item.card, onchange: (e: Event) => { item.card = (e.target as HTMLInputElement).checked || undefined; change(); } })),
      );
    }

    const pages: [string, string][] = [['', 'Nowhere'], ...this.allPages().map((page) => [page.id, page.name ?? page.id] as [string, string])];
    parts.push(
      field('Flips to', select(pages, item.goto ?? '', (value) => { item.goto = value || undefined; change(); })),
      field('Place', row(
        number(item.x, (value) => { item.x = value; change(); }),
        number(item.y, (value) => { item.y = value; change(); }),
      )),
      field('Width', number(item.w, (value) => { item.w = Math.max(20, value); change(); })),
      'h' in item ? field('Height', number(item.h, (value) => { item.h = Math.max(10, value); change(); })) : null,
      field('Turned', number(item.rot ?? 0, (value) => { item.rot = value || undefined; change(); }, 0.5)),
      row(
        button('To front', () => this.restack(999)),
        button('To back', () => this.restack(-999)),
        button('Copy', () => this.duplicate()),
        button('Delete', () => this.remove(), { class: 'danger' }),
      ),
    );
    const title = item.type === 'text' ? 'Selected: writing' : item.type === 'photo' ? 'Selected: photo' : 'Selected: sticker';
    return group(title, ...parts);
  }
}
