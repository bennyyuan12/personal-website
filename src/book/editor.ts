// Editing the book, in the browser, on the page itself: `npm run edit`.
// Drag things about, double-click text to rewrite it, drop photos in, add and remove pages, then
// save. Saving writes public/book/book.json (and photos into public/book/photos) through the dev
// server, so this only exists while developing and none of it ships with the site.

import './editor.css';
import type { Scene } from '../scene';
import type { Book } from './book';
import { FONTS } from './fonts';
import { clean, COLLAGE_PADS, collageGrid } from './render';
import { STICKERS, TAPES, stickerMarkup } from './stickers';
import { cutBounds, simplify } from './tear';
import { TEMPLATES } from './templates';
import type { BackPaper, Backing, BookData, CollageItem, CollageLayout, Frame, Ink, Item, Page, Paper, PhotoItem, Scrap, Section, Shape, StickerItem, TextItem, TextStyle, Tone } from './types';

const PANEL_WIDTH = 296;

const TEXT_KINDS: { label: string; make: Partial<TextItem> & { style: TextStyle; html: string; w: number } }[] = [
  { label: 'Title', make: { style: 'title', html: 'A title', w: 800, rot: -1.5 } },
  { label: 'Heading', make: { style: 'heading', html: 'A heading', w: 700, rot: -1 } },
  { label: 'Writing', make: { style: 'body', html: '<p>Double-click to write.</p>', w: 800 } },
  { label: 'Note', make: { style: 'note', html: 'a note in pen', w: 460, rot: -3 } },
  { label: 'Caption', make: { style: 'caption', html: 'a caption', w: 420 } },
  { label: 'Label', make: { style: 'label', html: 'Label', w: 320, backing: 'dymo' } },
  { label: 'Stamp', make: { style: 'stamp', html: 'Stamp', w: 340, ink: 'red', rot: 5, align: 'center' } },
  { label: 'Sticky note', make: { style: 'note', html: 'remember this', w: 380, backing: 'sticky', rot: -3, size: 0.86 } },
  { label: 'Index card', make: { style: 'body', html: '<p>Written on a card.</p>', w: 640, backing: 'card', size: 0.9, rot: -1 } },
  { label: 'Torn paper (typed)', make: { style: 'body', html: '<ul><li>One thing.</li><li>Another.</li></ul>', w: 820, backing: 'torn', size: 0.9 } },
  { label: 'Boxed words', make: { style: 'label', html: 'Boxed', w: 320, backing: 'boxed' } },
  { label: 'Code', make: { style: 'code', html: 'const grass = true;', w: 820 } },
];
const STYLES: [TextStyle, string][] = [
  ['title', 'Title'], ['heading', 'Heading'], ['body', 'Writing'], ['note', 'Note'], ['caption', 'Caption'],
  ['label', 'Label'], ['stamp', 'Stamp'], ['code', 'Code'],
];
const BACKINGS: [Backing, string][] = [
  ['none', 'Nothing'], ['sticky', 'Sticky note'], ['card', 'Index card'], ['torn', 'Torn paper (typed)'], ['kraft', 'Kraft label'], ['dymo', 'Label tape'], ['boxed', 'A drawn box'],
];
const INKS: Ink[] = ['ink', 'red', 'blue', 'green', 'white'];
const INK_COLORS: Record<Ink, string> = { ink: '#26221b', red: '#b23a2a', blue: '#2c4a86', green: '#3d6b35', white: '#fbf7ea' };
/** Every font, for one piece of writing: the first keeps whatever its style uses. */
const FONT_CHOICES: [string, string][] = [['', 'Same as its style'], ...Object.entries(FONTS).map(([key, font]) => [key, font.label] as [string, string])];
const BOOK_FONTS: [string, string][] = Object.entries(FONTS).map(([key, font]) => [key, font.label]);
const PAPERS: [Paper, string][] = [['plain', 'Plain'], ['lined', 'Lined'], ['grid', 'Squared'], ['dots', 'Dotted'], ['kraft', 'Kraft']];
const SCRAPS: [Scrap, string][] = [['white', 'White paper'], ['kraft', 'Kraft paper'], ['graph', 'Graph paper']];
const FRAMES: [Frame, string][] = [
  ['polaroid', 'Polaroid'], ['taped', 'Taped print'], ['print', 'Print'], ['sticker', 'Peel-off sticker'],
  ['stamp', 'Postage stamp'], ['torn', 'Torn-out print'], ['none', 'No border'],
];
const SHAPES: [Shape, string][] = [
  ['rect', 'As it is'], ['rounded', 'Rounded'], ['circle', 'Circle'], ['heart', 'Heart'], ['star', 'Star'], ['arch', 'Arch'], ['scallop', 'Scalloped'],
];
const PAPERS_BEHIND: [BackPaper | '', string][] = [
  ['', 'Nothing'], ['pink', 'Pink paper'], ['cream', 'Cream paper'], ['kraft', 'Kraft paper'], ['blue', 'Blue paper'],
  ['mustard', 'Mustard paper'], ['grid', 'Graph paper'], ['print', 'Old newsprint'],
];
const TONES: [Tone | '', string][] = [['', 'Color'], ['mono', 'Black and white'], ['old', 'Old print'], ['sepia', 'Sepia'], ['faded', 'Faded']];
const LAYOUTS: [CollageLayout, string][] = [['grid', 'Grid'], ['mosaic', 'One big, the rest small'], ['strip', 'Photo-booth strip'], ['film', 'Film strip']];
/** A new collage's width, by layout. */
const COLLAGE_WIDTH: Record<CollageLayout, (count: number) => number> = {
  grid: () => 640,
  mosaic: () => 680,
  strip: () => 300,
  film: (count) => clamp(44 + count * 250, 420, 960),
};

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
/** Whether a picture has see-through parts worth keeping: a cut-out, not just a photo saved as PNG. */
function seeThrough(canvas: HTMLCanvasElement) {
  const small = document.createElement('canvas');
  small.width = small.height = 48;
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, 48, 48);
  const pixels = ctx.getImageData(0, 0, 48, 48).data;
  let clear = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 200) clear++;
  return clear > 48 * 48 * 0.02;
}
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
  /** While the scissors are out, they get the keys. */
  private cutterKey: ((e: KeyboardEvent) => boolean) | null = null;

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
      const collageEl = (e.target as HTMLElement).closest<HTMLElement>('.slot .collage');
      const collage = page?.items.find((item) => item.id === collageEl?.dataset.id);
      if (collage?.type === 'collage') {
        void this.addToCollage(collage, files);
      } else if (page && pageEl) {
        const box = pageEl.getBoundingClientRect();
        void this.addPhotos(files, page, { x: (e.clientX - box.left) / this.book.unit, y: (e.clientY - box.top) / this.book.unit });
      } else if (page) {
        void this.addPhotos(files, page);
      }
    });
    // A picture copied from anywhere, like a subject lifted out of a photo on a Mac or iPhone.
    window.addEventListener('paste', (e) => {
      if (this.typing || (e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length || !this.target) return;
      e.preventDefault();
      const chosen = this.selected?.item;
      if (chosen?.type === 'collage') void this.addToCollage(chosen, files);
      else void this.addPhotos(files, this.target);
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
    const restored = JSON.parse(json) as BookData;
    this.data.sections = restored.sections;
    if (restored.fonts) this.data.fonts = restored.fonts;
    else delete this.data.fonts;
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
        const startHeight = (start as PhotoItem | StickerItem | CollageItem).h;
        // Drawings and peel-off stickers keep their shape unless shift says otherwise; photos the other way round.
        const fixed =
          item.type === 'sticker' ? !STICKERS[item.art]?.stretch && !item.art.startsWith('tape')
          : item.type === 'photo' && item.frame === 'sticker' ? !e.shiftKey
          : e.shiftKey;
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
    else if (item.type === 'collage') {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('.cell');
      if (cell) this.pickPhotos((files) => void this.replaceInCollage(item, Number(cell.dataset.n), files[0]));
      else this.pickPhotos((files) => void this.addToCollage(item, files), true);
    }
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
    let name = file.name || 'pasted.png';
    let ratio = 1;
    let alpha = false;
    if (/svg|gif/.test(file.type)) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
      URL.revokeObjectURL(img.src);
      alpha = file.type.includes('svg');
    } else {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      const canvas = h('canvas', { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      ratio = canvas.width / canvas.height;
      alpha = /png|webp|avif/.test(file.type) && seeThrough(canvas);
      const encode = (type: string) => new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not read the photo'))), type, 0.86));
      blob = alpha || file.type === 'image/png' ? await encode('image/png') : await encode('image/jpeg');
      // A cut-out has to keep its see-through parts, so a big one goes to WebP rather than JPEG.
      if (blob.type === 'image/png' && blob.size > 1.5e6) blob = await encode(alpha ? 'image/webp' : 'image/jpeg');
      name = name.replace(/\.[^.]+$/, '') + ({ 'image/png': '.png', 'image/webp': '.webp' }[blob.type] ?? '.jpg');
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
    return { src, ratio, alpha };
  }

  private async addPhotos(files: File[], page: Page, at?: { x: number; y: number }) {
    this.showStatus('Adding photos…');
    try {
      for (const [i, file] of files.entries()) {
        const { src, ratio, alpha } = await this.upload(file);
        if (alpha) {
          // Something cut out of its background: that's a sticker, not a print.
          this.add(this.imageSticker(src, ratio, i, at, undefined), page);
          continue;
        }
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

  private imageSticker(src: string, ratio: number, i: number, at: { x: number; y: number } | undefined, shape: Shape | undefined): PhotoItem {
    const w = Math.round(ratio >= 1 ? 340 : 340 * Math.max(0.5, ratio));
    const h = Math.round(w / ratio);
    return {
      id: uid(), type: 'photo', src, frame: 'sticker', shape, w, h,
      x: Math.round(clamp((at?.x ?? 500) - w / 2 + i * 50, 20, 980 - w)),
      y: Math.round(clamp((at?.y ?? 600) - h / 2 + i * 50, 20, 1350 - h)),
      rot: [-6, 5, -3, 7][i % 4],
    };
  }

  /** Any picture, made into a peel-off sticker: cut-outs keep their outline, the rest get rounded corners. */
  private async addImageStickers(files: File[], page: Page) {
    this.showStatus('Making stickers…');
    try {
      for (const [i, file] of files.entries()) {
        const { src, ratio, alpha } = await this.upload(file);
        this.add(this.imageSticker(src, ratio, i, undefined, alpha ? undefined : 'rounded'), page);
      }
    } catch (err) {
      this.showStatus(`Couldn’t make the sticker: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ---- collages ----

  /** Make a collage's height fit its photos at its width. */
  private fitCollage(item: CollageItem) {
    const { cols, rows } = collageGrid(item.layout, item.photos.length);
    const pad = COLLAGE_PADS[item.layout];
    const ratios = item.photos.map((photo) => photo.ratio).filter((r) => Number.isFinite(r) && r > 0);
    const average = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 4 / 3;
    // Film frames and photo-booth shots come out one shape whatever the photo.
    const shape = item.layout === 'film' ? 1.42 : item.layout === 'strip' ? 1.3 : clamp(average, 0.7, 1.6);
    const cellW = (item.w - pad.side * 2 - pad.gap * (cols - 1)) / cols;
    item.h = Math.round(pad.top + pad.bottom + rows * (cellW / shape) + pad.gap * (rows - 1));
  }

  private async addCollage(files: File[], page: Page) {
    this.showStatus('Making a collage…');
    try {
      const photos = [];
      for (const file of files) {
        const { src, ratio } = await this.upload(file);
        photos.push({ src, ratio: Math.round(ratio * 1000) / 1000 });
      }
      const layout: CollageLayout = photos.length === 3 ? 'mosaic' : 'grid';
      const w = COLLAGE_WIDTH[layout](photos.length);
      const item: CollageItem = { id: uid(), type: 'collage', layout, photos, x: Math.round((1000 - w) / 2), y: 300, w, h: 0, rot: -1.5 };
      this.fitCollage(item);
      item.y = Math.round(clamp(600 - item.h / 2, 20, Math.max(20, 1350 - item.h)));
      this.add(item, page);
    } catch (err) {
      this.showStatus(`Couldn’t make the collage: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async addToCollage(item: CollageItem, files: File[]) {
    this.showStatus('Adding photos…');
    try {
      for (const file of files) {
        const { src, ratio } = await this.upload(file);
        item.photos.push({ src, ratio: Math.round(ratio * 1000) / 1000 });
      }
      if (item.layout === 'film') item.w = COLLAGE_WIDTH.film(item.photos.length);
      this.fitCollage(item);
      this.keepOnPage(item);
      this.commit();
    } catch (err) {
      this.showStatus(`Couldn’t add the photo: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async replaceInCollage(item: CollageItem, index: number, file: File) {
    if (!item.photos[index]) return;
    try {
      const { src, ratio } = await this.upload(file);
      item.photos[index] = { src, ratio: Math.round(ratio * 1000) / 1000 };
      this.commit();
    } catch (err) {
      this.showStatus(`Couldn’t add the photo: ${err instanceof Error ? err.message : err}`);
    }
  }

  private setLayout(item: CollageItem, layout: CollageLayout) {
    item.layout = layout;
    item.w = COLLAGE_WIDTH[layout](item.photos.length);
    this.fitCollage(item);
    this.keepOnPage(item);
    this.commit();
  }

  /** Grown or reshaped: pull it back onto the page, and shrink it if it's taller than the page. */
  private keepOnPage(item: CollageItem) {
    if (item.h > 1300) {
      item.w = Math.round((item.w * 1300) / item.h);
      this.fitCollage(item);
    }
    item.x = Math.round(clamp(item.x, 10, Math.max(10, 990 - item.w)));
    item.y = Math.round(clamp(item.y, 10, Math.max(10, 1360 - item.h)));
  }

  // ---- scissors ----

  /**
   * Cut a piece out of a photo: drag around it like a lasso, or click from point to point and back
   * to the first. The photo's shown whole, with any cut it already has.
   */
  private scissors(opts: {
    src: string;
    cut?: [number, number][];
    edge?: 'torn';
    /** A new photo nothing's been cut from yet: every cut is a new piece. */
    fresh: boolean;
    done: (cut: [number, number][], edge: 'torn' | undefined, ratio: number, again: boolean) => void;
  }) {
    this.stopTyping();
    const NS = 'http://www.w3.org/2000/svg';
    const img = h('img', { src: import.meta.env.BASE_URL + opts.src, alt: '', draggable: false });
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'cutter-draw');
    svg.setAttribute('viewBox', '0 0 1 1');
    svg.setAttribute('preserveAspectRatio', 'none');
    const shade = document.createElementNS(NS, 'path');
    shade.setAttribute('class', 'shade');
    shade.setAttribute('fill-rule', 'evenodd');
    const under = document.createElementNS(NS, 'path');
    under.setAttribute('class', 'line under');
    const over = document.createElementNS(NS, 'path');
    over.setAttribute('class', 'line over');
    // The first point, as a dot that stays round however the photo's stretched.
    const start = document.createElementNS(NS, 'path');
    start.setAttribute('class', 'start');
    svg.append(shade, under, over, start);
    const stage = h('div', { class: 'cutter-stage' }, img, svg);
    const hint = h('p', { class: 'cutter-hint' });
    const torn = h('input', { type: 'checkbox', checked: opts.edge === 'torn' });
    const button = (label: string, act: () => void, props: Props = {}) => h('button', { type: 'button', onclick: act, ...props }, label);

    let points: [number, number][] = opts.cut ? opts.cut.map((p) => [p[0], p[1]] as [number, number]) : [];
    let closed = points.length > 2;
    let pressing = false;
    let dragged = false;
    let fromEmpty = false;
    let last = { x: 0, y: 0 };
    let hover: [number, number] | null = null;

    const box = () => img.getBoundingClientRect();
    const at = (e: PointerEvent): [number, number] => {
      const r = box();
      return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
    };
    const nearFirst = (e: PointerEvent) => {
      if (points.length < 3) return false;
      const r = box();
      return Math.hypot(e.clientX - (r.left + points[0][0] * r.width), e.clientY - (r.top + points[0][1] * r.height)) < 14;
    };
    const draw = () => {
      const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(4)} ${y.toFixed(4)}`).join('');
      const open = !closed && hover && points.length ? `L${hover[0].toFixed(4)} ${hover[1].toFixed(4)}` : '';
      const d = line + (closed ? 'Z' : open);
      under.setAttribute('d', d);
      over.setAttribute('d', d);
      shade.setAttribute('d', closed ? `M0 0H1V1H0Z${line}Z` : '');
      start.style.display = !closed && points.length > 1 ? '' : 'none';
      if (points.length) start.setAttribute('d', `M${points[0][0]} ${points[0][1]}l0 0`);
      hint.textContent = closed
        ? 'Cut along the dotted line? Draw again to start over.'
        : points.length
          ? 'Keep going. Click the first point (or let go of a drag) to close the shape.'
          : 'Drag around what you want, like a lasso, or click from point to point.';
      cutButton.disabled = againButton.disabled = points.length < 3;
    };

    svg.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      if (closed) {
        points = [];
        closed = false;
      }
      if (nearFirst(e)) {
        closed = true;
        draw();
        return;
      }
      pressing = true;
      dragged = false;
      fromEmpty = points.length === 0;
      last = { x: e.clientX, y: e.clientY };
      points.push(at(e));
      draw();
    });
    svg.addEventListener('pointermove', (e) => {
      hover = at(e);
      if (pressing && Math.hypot(e.clientX - last.x, e.clientY - last.y) > 3) {
        last = { x: e.clientX, y: e.clientY };
        points.push(hover);
        dragged = true;
      }
      draw();
    });
    svg.addEventListener('pointerup', () => {
      if (!pressing) return;
      pressing = false;
      // A lasso closes itself when it's let go.
      if (dragged && fromEmpty && points.length > 8) closed = true;
      draw();
    });
    svg.addEventListener('pointerleave', () => {
      hover = null;
      draw();
    });

    const close = () => {
      overlay.remove();
      this.cutterKey = null;
    };
    const cut = (again: boolean) => {
      if (points.length < 3) return;
      const r = box();
      // Thin out a hand-drawn line to what its shape needs, measured on screen.
      const kept = simplify(points.map(([x, y]) => [x * r.width, y * r.height] as [number, number]), 0.9)
        .map(([x, y]) => [Math.round((x / r.width) * 1e4) / 1e4, Math.round((y / r.height) * 1e4) / 1e4] as [number, number]);
      if (kept.length < 3) return;
      const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
      opts.done(kept, torn.checked ? 'torn' : undefined, ratio, again);
      if (again) {
        points = [];
        closed = false;
        draw();
        this.showStatus('Cut out. Draw around the next piece.');
      } else {
        close();
      }
    };
    const cutButton = button('Cut it out', () => cut(false), { class: 'primary' });
    const againButton = button(opts.fresh ? 'Cut it out, and keep cutting' : 'Cut out a copy', () => cut(true), {
      title: opts.fresh ? 'Make this piece, then cut another from the same photo' : 'Leave this photo as it is and make a new piece',
    });
    const overlay = h('div', { class: 'cutter', role: 'dialog', ariaLabel: 'Scissors' },
      h('div', { class: 'cutter-bar' },
        h('b', {}, '✂ Scissors'),
        hint,
        h('label', { class: 'cutter-torn' }, torn, ' Torn by hand'),
        button('Undo point', () => { closed = false; points.pop(); draw(); }),
        button('Start again', () => { points = []; closed = false; draw(); }),
        h('span', { class: 'cutter-gap' }),
        button(opts.fresh ? 'Done' : 'Cancel', close),
        againButton,
        cutButton,
      ),
      stage,
    );
    this.cutterKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter') cut(false);
      else if (e.key === 'Backspace' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        closed = false;
        points.pop();
        draw();
      } else return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' ? false : true;
      return true;
    };
    document.body.append(overlay);
    img.decode().then(draw, draw);
    draw();
  }

  /** Cut a photo on the page down to a piece of itself, or cut a new piece from it, where that part of it was. */
  private applyCut(page: Page, item: PhotoItem, cut: [number, number][], edge: 'torn' | undefined, ratio: number, copy: boolean) {
    const was = item.cut && item.cut.length > 2 ? cutBounds(item.cut) : { x0: 0, y0: 0, x1: 1, y1: 1 };
    // How wide the whole photo is on the page now.
    const whole = item.w / Math.max(1e-3, was.x1 - was.x0);
    const b = cutBounds(cut);
    const piece: PhotoItem = copy ? { ...structuredClone(item), id: uid() } : item;
    piece.cut = cut;
    piece.edge = edge;
    if (!edge) delete piece.edge;
    piece.w = Math.max(24, Math.round(whole * (b.x1 - b.x0)));
    piece.h = Math.max(24, Math.round((whole * (b.y1 - b.y0)) / ratio));
    piece.x = Math.round(item.x + (b.x0 - was.x0) * whole + (copy ? 36 : 0));
    piece.y = Math.round(item.y + ((b.y0 - was.y0) * whole) / ratio + (copy ? 36 : 0));
    if (piece.frame !== 'none' && piece.frame !== 'sticker') piece.frame = 'none';
    delete piece.shape;
    delete piece.focus;
    if (copy) page.items.push(piece);
    this.selected = { page, item: piece };
    this.target = page;
    this.commit();
  }

  private cutPhoto(page: Page, item: PhotoItem) {
    if (!item.src) return;
    this.scissors({
      src: item.src, cut: item.cut, edge: item.edge, fresh: false,
      done: (cut, edge, ratio, again) => this.applyCut(page, item, cut, edge, ratio, again),
    });
  }

  /** Put a cut photo back whole, the size it was. */
  private async uncut(item: PhotoItem) {
    if (!item.cut) return;
    const probe = new Image();
    probe.src = import.meta.env.BASE_URL + item.src;
    await probe.decode().catch(() => {});
    const ratio = probe.naturalWidth / Math.max(1, probe.naturalHeight) || 1;
    const was = cutBounds(item.cut);
    const whole = item.w / Math.max(1e-3, was.x1 - was.x0);
    item.x = Math.round(item.x - was.x0 * whole);
    item.y = Math.round(item.y - (was.y0 * whole) / ratio);
    item.w = Math.round(whole);
    item.h = Math.round(whole / ratio);
    delete item.cut;
    this.commit();
  }

  /** A photo to cut pieces from: only the pieces go on the page. */
  private async cutFromNew(file: File, page: Page) {
    this.showStatus('Getting the photo…');
    try {
      const { src, ratio } = await this.upload(file);
      this.showStatus();
      const whole = Math.round(Math.min(760, 1000 * ratio));
      const sheet: PhotoItem = {
        id: uid(), type: 'photo', src, frame: 'none', w: whole, h: Math.round(whole / ratio),
        x: Math.round((1000 - whole) / 2), y: Math.round(Math.max(20, (1370 - whole / ratio) / 2)),
      };
      let n = 0;
      this.scissors({
        src, fresh: true,
        done: (cut, edge, r, again) => {
          this.applyCut(page, { ...sheet, x: sheet.x - 36 + n * 24, y: sheet.y - 36 + n * 24 }, cut, edge, r, true);
          n++;
          void again;
        },
      });
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
    if (this.cutterKey?.(e)) return;
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

    // Fonts for every title and heading at once.
    const setBookFont = (kind: 'title' | 'heading', value: string) => {
      this.data.fonts = { ...this.data.fonts, [kind]: value === 'architect' ? undefined : value };
      if (!this.data.fonts.title && !this.data.fonts.heading) delete this.data.fonts;
      this.book.applyFonts();
      this.commit('none');
    };
    const bookFonts = group('Whole book',
      field('Titles', select(BOOK_FONTS, this.data.fonts?.title ?? 'architect', (value) => setBookFont('title', value))),
      field('Headings', select(BOOK_FONTS, this.data.fonts?.heading ?? 'architect', (value) => setBookFont('heading', value))),
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
            button('Collage…', () => this.pickPhotos((files) => void this.addCollage(files, page), true), { title: 'Pick a few photos to lay out together' }),
            button('Your own sticker…', () => this.pickPhotos((files) => void this.addImageStickers(files, page), true), { title: 'Any picture, as a peel-off sticker' }),
            button('✂ Cut from a photo…', () => this.pickPhotos((files) => void this.cutFromNew(files[0], page)), { title: 'Cut pieces out of a photo with scissors, and stick just those in' }),
          ),
          h('p', { class: 'ed-hint' }, 'You can also drop pictures on the page, or paste one with ⌘V. A see-through PNG (on a Mac, right-click a photo and Copy Subject) becomes a cut-out sticker.'),
          stickers,
        )
      : null;

    this.panel.replaceChildren(head, pages, bookFonts, thisPage);
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
        field('Font', select(FONT_CHOICES, item.font ?? '', (value) => { item.font = value || undefined; change(); })),
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
        item.src ? row(
          button(item.cut ? '✂ Cut again…' : '✂ Cut out…', () => this.cutPhoto(this.selected!.page, item), { class: 'primary', title: 'Cut a piece out of it with scissors' }),
          item.cut ? button('Make it whole', () => void this.uncut(item), { title: 'Undo the cutting' }) : null,
        ) : null,
        field('Edge', select([['', 'Clean'], ['torn', 'Torn by hand']] as [string, string][], item.edge ?? '', (value) => { item.edge = value ? 'torn' : undefined; change(); })),
        item.cut || item.edge ? null : field('Cut to', select(SHAPES, item.shape ?? 'rect', (value) => { item.shape = value === 'rect' ? undefined : value; change(); })),
        item.frame === 'none' || item.frame === 'sticker'
          ? field('Stuck on', select(PAPERS_BEHIND, item.paper ?? '', (value) => { item.paper = value || undefined; change(); }))
          : null,
        item.frame === 'taped'
          ? field('Tape', select(Object.entries(TAPES) as [string, string][], item.tape ?? 'tape-cream', (value) => { item.tape = value === 'tape-cream' ? undefined : value; change(); }))
          : null,
        field('Printed', select(TONES, item.tone ?? '', (value) => { item.tone = value || undefined; change(); })),
        field('Caption', text(item.caption ?? '', (value) => { item.caption = value || undefined; change(); })),
        field('Describes', text(item.alt ?? '', (value) => { item.alt = value || undefined; change(); }, { placeholder: 'for people who can’t see it' })),
        field('In view', row(
          number(item.focus?.[0] ?? 50, (value) => { item.focus = [clamp(value, 0, 100), item.focus?.[1] ?? 50]; change(); }, 5),
          number(item.focus?.[1] ?? 50, (value) => { item.focus = [item.focus?.[0] ?? 50, clamp(value, 0, 100)]; change(); }, 5),
        )),
        row(button(item.src ? 'Change photo…' : 'Choose photo…', () => this.pickPhotos((files) => void this.replacePhoto(item, files[0])), { class: 'primary' })),
      );
    } else if (item.type === 'collage') {
      const thumbs = h('div', { class: 'ed-thumbs' });
      item.photos.forEach((photo, i) => {
        const last = item.photos.length - 1;
        thumbs.append(h('div', { class: 'ed-thumb' },
          h('img', { src: import.meta.env.BASE_URL + photo.src, alt: '' }),
          button('←', () => { item.photos.splice(i - 1, 0, ...item.photos.splice(i, 1)); change(); }, { disabled: i === 0, title: 'Earlier' }),
          button('→', () => { item.photos.splice(i + 1, 0, ...item.photos.splice(i, 1)); change(); }, { disabled: i === last, title: 'Later' }),
          button('↻', () => this.pickPhotos((files) => void this.replaceInCollage(item, i, files[0])), { title: 'Change this photo' }),
          button('×', () => {
            item.photos.splice(i, 1);
            if (item.layout === 'film') item.w = COLLAGE_WIDTH.film(item.photos.length);
            this.fitCollage(item);
            change();
          }, { title: 'Take it out' }),
        ));
      });
      parts.push(
        field('Layout', select(LAYOUTS, item.layout, (value) => this.setLayout(item, value))),
        field('Caption', text(item.caption ?? '', (value) => { item.caption = value || undefined; change(); })),
        thumbs,
        row(
          button('+ Photos…', () => this.pickPhotos((files) => void this.addToCollage(item, files), true), { class: 'primary' }),
          button('Fit height', () => { this.fitCollage(item); change(); }, { title: 'Make it as tall as its photos need' }),
        ),
        h('p', { class: 'ed-hint' }, 'Double-click a photo in it to change that one. Drop photos on it to add them.'),
      );
    } else {
      const arts: [string, string][] = [...Object.entries(STICKERS).map(([key, s]) => [key, s.label] as [string, string]), ...Object.entries(TAPES)];
      parts.push(
        field('Drawing', select(arts, item.art, (value) => { item.art = value; change(); })),
        field('Ink', inks(item.ink, (ink) => { item.ink = ink === 'ink' ? undefined : ink; })),
        field('On a scrap', h('input', { type: 'checkbox', checked: !!item.card, onchange: (e: Event) => { item.card = (e.target as HTMLInputElement).checked || undefined; change(); } })),
        field('Scrap of', select(SCRAPS, item.on ?? 'white', (value) => { item.on = value === 'white' ? undefined : value; change(); })),
        field('Peel-off', h('input', { type: 'checkbox', checked: !!item.cut, title: 'A white die-cut edge all the way round', onchange: (e: Event) => { item.cut = (e.target as HTMLInputElement).checked || undefined; change(); } })),
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
    const title = { text: 'Selected: writing', photo: 'Selected: photo', sticker: 'Selected: sticker', collage: 'Selected: collage' }[item.type];
    return group(title, ...parts);
  }
}
