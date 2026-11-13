// The book. It's one piece of DOM from start to finish: the pages you read are the pages that fall
// and lie in the grass, only further away. It's a scrapbook, so a page is a fixed sheet with things
// stuck on it, and only the two pages lying open exist at any moment. A page being turned is a
// stand-in that bends like paper (flipper.ts), carrying copies of the sides you can see.

import './fonts';
import './book.css';
import { Flipper } from './flipper';
import { FONTS, fontVars } from './fonts';
import { renderPage, type RenderContext } from './render';
import type { BookData, Page, Section } from './types';

export interface Pose {
  x: number; // center, CSS px
  y: number;
  angle: number; // radians
  scale: number;
}

type State = 'away' | 'falling' | 'landed' | 'lifting' | 'open' | 'closing';

const PAGE_RATIO = 1000 / 1370; // width / height
const GROUND_ANGLE = (-8 * Math.PI) / 180;
/** Grass gets blown off the book for this long before it lifts. */
const LIFT_AFTER = 0.2;
const ZOOM_SECONDS = 0.8;
const FLIP_SECONDS = 1;
const STRIPS = 8;
/** CSS px the pointer has to travel before a press counts as a drag. */
const DRAG_START = 8;
const SWIPE = 40;
/** CSS px kept clear on each side of the open book, for its tags. */
const SIDE = 58;

const NOWHERE: Section = { id: '', title: '', tab: null, color: '#888', pages: [] };

function div(className: string) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/** One side of one leaf. Sections always start on a left-hand page, so some sides are left blank. */
interface Sheet {
  page: Page | null;
  section: Section;
}

interface Tab {
  section: Section;
  /** The sheet its section starts on. */
  start: number;
  /** On the edge of the book, and in the row above a single page. */
  el: HTMLButtonElement;
  small: HTMLButtonElement;
}

interface Flip {
  from: number;
  to: number;
  /** Toward later pages: the page travels from the right to the left. */
  forward: boolean;
  /** 0 lying on the right .. 1 lying on the left. */
  p: number;
  goal: 0 | 1;
  /** Someone has hold of it. */
  held: boolean;
  seconds: number;
}

export interface BookHooks {
  /** About to lift: this is when to blow the grass off it. */
  lifting(): void;
  /** On its way down again. */
  closing(): void;
  /** It's back in the grass. */
  closed(): void;
  /** Which section is being read; null once it's shut. */
  section(id: string | null): void;
}

export class Book {
  readonly el = div('book away');
  /** While true, pages don't turn when they're pressed: they're being edited. */
  locked = false;
  /** CSS px kept clear on the left of the window while reading. */
  inset = 0;
  /** Called whenever the pages on show have been put in place. */
  onPresent: (() => void) | null = null;

  private readonly body = div('book-body');
  private readonly slots: [HTMLElement, HTMLElement] = [div('slot l'), div('slot r')];
  private readonly casts: [HTMLElement, HTMLElement] = [div('cast l'), div('cast r')];
  private readonly rails: [HTMLElement, HTMLElement] = [div('tabs l'), div('tabs r')];
  private readonly flipper = new Flipper(STRIPS);
  private readonly scrim = div('scrim');
  private readonly strip = div('tabstrip');
  private readonly where = document.createElement('span');
  private readonly closeButton = document.createElement('button');
  private readonly prevButton = document.createElement('button');
  private readonly nextButton = document.createElement('button');
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly ctx: RenderContext = {
    numberOf: (id) => {
      const index = this.indexOf(id);
      return index < 0 ? null : index + 1;
    },
    editing: false,
    base: import.meta.env.BASE_URL,
  };

  private data: BookData = { version: 1, sections: [] };
  private sheets: Sheet[] = [{ page: null, section: NOWHERE }, { page: null, section: NOWHERE }];
  private tabs: Tab[] = [];
  /** Pages already drawn, by id. */
  private readonly made = new Map<string, HTMLElement>();
  /** The sheet being read. With two pages showing, either of them. */
  private at = 0;
  private flip: Flip | null = null;

  private state: State = 'away';
  private stateSeconds = 0;
  private zoomSeconds = 0;
  /** Too narrow for two pages: while it's open, one page shows and every page turns. */
  private narrow = false;
  private single = false;
  private pageWidth = 1;
  private pageHeight = 1;
  private top = 0;
  private vw = 1;
  private groundWidth = 1;
  private rest: Pose = { x: 0, y: 0, angle: GROUND_ANGLE, scale: 1 };
  private press: { id: number; x: number; y: number; dragging: boolean; link: boolean } | null = null;
  /** A drag just ended on a link: the click that follows isn't one. */
  private swallowClick = false;

  constructor(
    private readonly ground: HTMLElement,
    private readonly sky: HTMLElement,
    private readonly reader: HTMLElement,
    private readonly hooks: BookHooks,
  ) {
    this.body.append(this.slots[0], this.slots[1], this.casts[0], this.casts[1], this.flipper.el);
    this.el.append(div('book-cover'), div('book-stack'), this.rails[0], this.rails[1], this.body);
    ground.append(this.el);

    const button = (el: HTMLButtonElement, className: string, label: string, text: string, act: () => void) => {
      el.type = 'button';
      el.className = className;
      el.setAttribute('aria-label', label);
      el.textContent = text;
      el.addEventListener('click', act);
      return el;
    };
    this.strip.setAttribute('role', 'navigation');
    this.strip.setAttribute('aria-label', 'Sections of the book');
    this.where.className = 'where';
    const bar = div('book-bar');
    bar.append(
      button(this.prevButton, 'turn prev', 'Previous page', '←', () => this.previous()),
      this.where,
      button(this.nextButton, 'turn next', 'Next page', '→', () => this.next()),
    );
    reader.append(this.scrim, this.strip, button(this.closeButton, 'book-close', 'Close the book', '× close', () => this.close()), bar);
    this.scrim.addEventListener('click', () => {
      if (!this.locked) this.close();
    });

    this.el.addEventListener('click', (e) => this.clicked(e));
    this.el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target as HTMLElement;
      if (this.state === 'landed' && target === this.el) {
        e.preventDefault();
        this.open();
      } else if (this.state === 'open' && !this.locked && target.dataset.goto) {
        e.preventDefault();
        this.goToId(target.dataset.goto);
      }
    });
    this.el.addEventListener('pointerdown', (e) => this.pressed(e));
    this.el.addEventListener('pointermove', (e) => this.dragged(e));
    this.el.addEventListener('pointerup', (e) => this.released(e));
    this.el.addEventListener('pointercancel', () => this.cancelled());
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'open' || this.locked) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowRight') this.next();
      else if (e.key === 'ArrowLeft') this.previous();
    });
    this.present();
  }

  // ---- what's in it ----

  /** Fill the book, or refill it after an edit. It stays open at the page it was on. */
  setData(data: BookData) {
    const here = this.sheets[this.at]?.page?.id;
    this.endFlip();
    this.data = data;
    this.applyFonts();
    this.sheets = [];
    for (const section of data.sections) {
      for (const page of section.pages) this.sheets.push({ page, section });
      if (section.pages.length % 2) this.sheets.push({ page: null, section });
    }
    if (!this.sheets.length) this.sheets.push({ page: null, section: NOWHERE }, { page: null, section: NOWHERE });
    this.made.clear();
    this.buildTabs();
    const kept = here ? this.indexOf(here) : -1;
    this.at = kept >= 0 ? kept : Math.min(this.at, this.sheets.length - 1);
    this.present();
  }

  /** The book-wide fonts for titles and headings. */
  applyFonts() {
    for (const kind of ['title', 'heading'] as const) {
      const key = this.data.fonts?.[kind];
      const vars = fontVars(kind, key && FONTS[key] ? key : 'architect');
      for (const [name, value] of Object.entries(vars)) this.el.style.setProperty(name, value);
    }
  }

  /** Draw empty photo slots and the like, for editing. */
  set editing(on: boolean) {
    this.ctx.editing = on;
    this.made.clear();
    this.present();
  }

  /** A page changed: draw it again. */
  redraw(pageId?: string) {
    if (pageId) this.made.delete(pageId);
    else this.made.clear();
    this.present();
  }

  indexOf(pageId: string) {
    return this.sheets.findIndex((sheet) => sheet.page?.id === pageId);
  }

  /** The sheet a section starts on, or -1. */
  startOf(sectionId: string) {
    return this.sheets.findIndex((sheet) => sheet.section.id === sectionId);
  }

  /** The pages lying open: where each is in the book, what it is, and its element. */
  get showing() {
    const out: { index: number; page: Page | null; section: Section; el: HTMLElement }[] = [];
    const indices = this.single ? [this.at] : [this.at & ~1, (this.at & ~1) + 1];
    for (const index of indices) {
      const sheet = this.sheets[index];
      const el = this.slots[this.single ? 1 : index & 1].firstElementChild as HTMLElement | null;
      if (sheet && el) out.push({ index, page: sheet.page, section: sheet.section, el });
    }
    return out;
  }

  get pageCount() {
    return this.sheets.length;
  }

  /** CSS px per page unit while it's open. */
  get unit() {
    return this.pageWidth / 1000;
  }

  private element(index: number, side: 'l' | 'r') {
    const sheet = this.sheets[index];
    let el: HTMLElement;
    if (!sheet?.page) {
      el = renderPage(null, null, this.ctx);
    } else {
      const id = sheet.page.id;
      el = this.made.get(id) ?? renderPage(sheet.page, index + 1, this.ctx);
      this.made.delete(id);
      this.made.set(id, el); // most recently used last
      if (this.made.size > 18) {
        for (const [key, old] of this.made) {
          if (this.made.size <= 12) break;
          if (!old.isConnected) this.made.delete(key);
        }
      }
    }
    el.classList.remove('l', 'r');
    el.classList.add(side);
    return el;
  }

  private setSlot(slot: 0 | 1, index: number | null) {
    const side = slot ? 'r' : 'l';
    const el = index === null ? this.element(-1, side) : this.element(index, side);
    if (this.slots[slot].firstElementChild !== el) this.slots[slot].replaceChildren(el);
  }

  /** Put the pages that should be lying open in place. */
  private present() {
    if (this.single) {
      this.setSlot(1, this.at);
      this.setSlot(0, null);
    } else {
      const left = this.at & ~1;
      this.setSlot(0, left);
      this.setSlot(1, left + 1);
    }
    this.el.classList.toggle('single', this.single);
    this.placeTabs();
    this.updateChrome();
    this.reach();
    // Draw the neighbors now, so their photos are loaded by the time a page turns.
    const around = this.single ? [this.at + 1, this.at - 1] : [(this.at & ~1) + 2, (this.at & ~1) + 3, (this.at & ~1) - 1, (this.at & ~1) - 2];
    for (const index of around) {
      if (this.sheets[index]?.page) this.element(index, index & 1 ? 'r' : 'l');
    }
    this.onPresent?.();
  }

  /** Only pages lying open and still can be reached. */
  private reach() {
    const reachable = this.state === 'open' && !this.flip;
    for (const slot of this.slots) {
      const page = slot.firstElementChild as HTMLElement | null;
      if (page) page.inert = !reachable;
    }
  }

  // ---- tags ----

  private buildTabs() {
    this.rails[0].replaceChildren();
    this.rails[1].replaceChildren();
    this.strip.replaceChildren();
    this.tabs = [];
    for (const section of this.data.sections) {
      if (!section.tab || !section.pages.length) continue;
      const start = this.sheets.findIndex((sheet) => sheet.section === section);
      const place = this.tabs.length;
      const make = () => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'tab';
        tab.title = section.title;
        tab.style.setProperty('--c', section.color);
        tab.style.setProperty('--i', `${place}`);
        const label = document.createElement('span');
        label.textContent = section.tab;
        tab.append(label);
        tab.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.state === 'landed') this.open(start);
          else if (this.state === 'open') this.goTo(start);
        });
        return tab;
      };
      const tab = { section, start, el: make(), small: make() };
      this.strip.append(tab.small);
      this.tabs.push(tab);
    }
    this.el.style.setProperty('--tabs', `${Math.max(1, this.tabs.length)}`);
  }

  /** A tag is stuck to the first page of its section, so it's on the left once that page is. */
  private placeTabs(at = this.at) {
    const left = at & ~1;
    const here = this.sheets[at]?.section;
    for (const tab of this.tabs) {
      const rail = this.rails[tab.start <= left ? 0 : 1];
      if (tab.el.parentElement !== rail) rail.append(tab.el);
      tab.el.style.visibility = '';
      for (const el of [tab.el, tab.small]) el.classList.toggle('here', tab.section === here);
    }
  }

  private updateChrome(at = this.at) {
    const n = this.sheets.length;
    const left = at & ~1;
    this.where.textContent = this.single ? `${at + 1} / ${n}` : `${left + 1}–${left + 2} / ${n}`;
    this.prevButton.disabled = this.single ? at === 0 : left === 0;
    this.nextButton.disabled = this.single ? at >= n - 1 : left + 2 >= n;
  }

  /** Let the rest of the site know where the reader is. */
  private announce(at = this.at) {
    const sheet = this.sheets[at];
    const reading = this.state === 'open' || this.state === 'lifting';
    this.hooks.section(reading ? sheet.section.id : null);
    if (reading && sheet.page && !this.ctx.editing) history.replaceState(null, '', `#${sheet.page.id}`);
  }

  // ---- where it is ----

  get isAway() {
    return this.state === 'away';
  }

  get isFalling() {
    return this.state === 'falling';
  }

  get isLanded() {
    return this.state === 'landed';
  }

  /** Up off the ground and being read, or on its way there or back. */
  get isReading() {
    return this.state === 'lifting' || this.state === 'open' || this.state === 'closing';
  }

  /** On its way up or back down. */
  get isMoving() {
    return this.state === 'lifting' || this.state === 'closing';
  }

  /** The size lying on the ground, CSS px. */
  get groundSize() {
    return { w: this.groundWidth, h: this.groundWidth / (2 * PAGE_RATIO) };
  }

  get restPose() {
    return this.rest;
  }

  /** vw, vh: the window. x, y: where it lands. */
  layout(vw: number, vh: number, x: number, y: number) {
    this.vw = vw;
    const room = vw - this.inset;
    const short = vh < 480;
    const top = short ? 10 : 56;
    const bottom = short ? 12 : 66;
    const both = Math.min((room - 2 * SIDE) / 2, (vh - top - bottom) * PAGE_RATIO);
    const narrow = both < 300 && room < vh;
    this.pageWidth = Math.max(120, Math.floor(narrow ? Math.min(room - 16, (vh - 58 - 58) * PAGE_RATIO) : both));
    this.pageHeight = Math.round(this.pageWidth / PAGE_RATIO);
    // A single page sits a little above the middle of whatever height is left over.
    this.top = narrow ? 58 + Math.max(0, Math.round((vh - 116 - this.pageHeight) * 0.4)) : top;
    this.el.style.setProperty('--page-w', `${this.pageWidth}px`);
    this.el.style.setProperty('--page-h', `${this.pageHeight}px`);
    this.reader.classList.toggle('narrow', narrow);
    this.reader.style.setProperty('--inset', `${this.inset}px`);
    this.reader.style.setProperty('--page-w', `${this.pageWidth}px`);
    this.reader.style.setProperty('--book-top', `${this.top}px`);
    if (narrow !== this.narrow) {
      this.narrow = narrow;
      this.endFlip();
      this.single = narrow && this.state === 'open';
      this.present();
    }

    this.groundWidth = vw >= vh ? Math.max(340, Math.min(vw * 0.34, vh * 0.6, 560)) : Math.min(vw * 0.84, 460);
    this.rest = { x, y, angle: GROUND_ANGLE, scale: this.groundWidth / (2 * this.pageWidth) };
    if (this.state === 'open' || this.state === 'lifting') this.apply(this.readingPose());
    else if (this.state !== 'away' && this.state !== 'falling') this.apply(this.rest);
  }

  private readingPose(): Pose {
    let x = this.inset + (this.vw - this.inset) / 2;
    if (this.narrow) {
      // One page fills the window. Lying open that's whichever page it is; while it's being read
      // it's always the right-hand one, so every page turns the same way.
      const onRight = this.single || this.at & 1;
      x += (onRight ? -0.5 : 0.5) * this.pageWidth;
    }
    return { x, y: this.top + this.pageHeight / 2, angle: 0, scale: 1 };
  }

  private apply({ x, y, angle, scale }: Pose) {
    // At reading size it has to sit on whole pixels, or the text goes soft.
    const snap = (v: number) => (scale === 1 ? Math.round(v) : v);
    this.el.style.transform =
      `translate(${snap(x - this.pageWidth)}px, ${snap(y - this.pageHeight / 2)}px) rotate(${angle}rad) scale(${scale})`;
  }

  private enter(state: State) {
    this.el.classList.remove(this.state);
    this.state = state;
    this.stateSeconds = 0;
    this.el.classList.add(state);
    const landed = state === 'landed';
    this.el.tabIndex = landed ? 0 : -1;
    if (landed) {
      this.el.setAttribute('role', 'button');
      this.el.setAttribute('aria-label', 'Open the book');
    } else {
      this.el.removeAttribute('role');
      this.el.removeAttribute('aria-label');
    }
  }

  // ---- falling, then lying in the grass ----

  /** Lie open at this sheet, and get ready to fall. */
  prepare(index: number) {
    this.show(index);
    this.sky.append(this.el);
    this.enter('falling');
    this.el.style.opacity = '0';
  }

  /** Lie open at a sheet without turning to it: nobody can read it yet. */
  show(index: number) {
    this.endFlip();
    this.at = Math.max(0, Math.min(this.sheets.length - 1, index));
    this.present();
  }

  /** Part of the way down: it's only just come into view from above the camera. */
  fall(pose: Pose, opacity: number) {
    this.apply(pose);
    this.el.style.opacity = `${opacity}`;
  }

  /** It's down, under the grass from now on. */
  settle() {
    this.ground.append(this.el);
    this.apply(this.rest);
    this.el.style.opacity = '';
    this.enter('landed');
    this.reach();
  }

  /** A little jump where it lies. */
  hop() {
    if (this.state !== 'landed' || this.reducedMotion) return;
    this.el.classList.remove('hop');
    void this.el.offsetWidth;
    this.el.classList.add('hop');
  }

  // ---- open and shut ----

  open(index?: number) {
    if (this.state !== 'landed') return;
    if (index !== undefined) this.show(index);
    this.enter('lifting');
    this.hooks.lifting();
  }

  private lift() {
    this.reader.classList.add('on');
    this.strip.after(this.el);
    this.apply(this.rest);
    void this.el.offsetWidth;
    this.zoom();
    this.apply(this.readingPose());
    this.announce();
  }

  private arrive() {
    this.enter('open');
    this.el.classList.remove('zoom');
    this.zoomSeconds = 0;
    this.single = this.narrow;
    this.present();
    this.apply(this.readingPose());
    this.closeButton.focus({ preventScroll: true });
  }

  /** Straight to being read, with no fall and no zoom. */
  openNow(index = this.at) {
    this.endFlip();
    this.at = Math.max(0, Math.min(this.sheets.length - 1, index));
    this.el.style.opacity = '';
    this.reader.classList.add('on');
    this.strip.after(this.el);
    this.enter('open');
    this.single = this.narrow;
    this.present();
    this.apply(this.readingPose());
    this.announce();
  }

  close() {
    if (this.state !== 'open') return;
    this.endFlip();
    if (this.single) {
      // Back to the two pages lying open, with the one being read where it was on screen.
      this.single = false;
      this.present();
      this.el.classList.remove('zoom');
      this.apply(this.readingPose());
      void this.el.offsetWidth;
    }
    this.enter('closing');
    this.reach();
    this.reader.classList.remove('on');
    this.zoom();
    this.apply(this.rest);
    this.hooks.section(null);
    if (!this.ctx.editing) history.replaceState(null, '', location.pathname + location.search);
    this.hooks.closing();
  }

  private land() {
    this.ground.append(this.el);
    this.el.classList.remove('zoom');
    this.apply(this.rest);
    this.enter('landed');
    this.reach();
    this.el.focus({ preventScroll: true });
    this.hooks.closed();
  }

  /** The next change of pose is a smooth one. */
  private zoom() {
    this.el.classList.add('zoom');
    this.zoomSeconds = ZOOM_SECONDS;
  }

  /** Go to a sheet: opening the book if it's lying shut in the grass, turning to it if it's open. */
  go(index: number) {
    if (this.state === 'landed') this.open(index);
    else if (this.state === 'lifting') this.show(index);
    else if (this.state === 'open') this.goTo(index);
  }

  // ---- turning ----

  next() {
    if (this.state !== 'open') return;
    const to = this.single ? this.at + 1 : (this.at & ~1) + 2;
    if (to < this.sheets.length) this.goTo(to);
  }

  previous() {
    if (this.state !== 'open') return;
    const to = this.single ? this.at - 1 : (this.at & ~1) - 2;
    if (to >= 0) this.goTo(to);
  }

  goToId(pageId: string) {
    const index = this.indexOf(pageId);
    if (index >= 0) this.goTo(index);
  }

  goTo(index: number) {
    this.begin(index, false);
  }

  /** Start turning to a sheet. However far away it is, the pages between go over together. */
  private begin(index: number, held: boolean) {
    this.endFlip();
    const to = Math.max(0, Math.min(this.sheets.length - 1, index));
    const from = this.at;
    const same = this.single ? to === from : to >> 1 === from >> 1;
    if (same || this.reducedMotion || this.state !== 'open') {
      this.at = to;
      this.present();
      this.announce();
      return false;
    }
    const forward = to > from;
    let thickness: number;
    if (this.single) {
      thickness = Math.abs(to - from);
      // Its other side is never seen: it turns away off the edge of the window.
      this.flipper.load(this.element(forward ? from : to, 'r'), this.element(-1, 'l'), thickness);
      if (forward) this.setSlot(1, to);
    } else {
      const low = Math.min(from >> 1, to >> 1);
      const high = Math.max(from >> 1, to >> 1);
      thickness = high - low;
      const tags: [HTMLElement, HTMLElement][] = [];
      for (const tab of this.tabs) {
        // The leaf a tag is stuck to goes over with the rest, and takes the tag with it.
        const leaf = tab.start / 2 - 1;
        if (leaf < low || leaf >= high) continue;
        tags.push([tab.el.cloneNode(true) as HTMLElement, tab.el.cloneNode(true) as HTMLElement]);
        tab.el.style.visibility = 'hidden';
      }
      // The leaves in the air show the old right-hand page on one side and the new left-hand page
      // on the other, or the other way about when turning back.
      this.flipper.load(this.element(2 * low + 1, 'r'), this.element(2 * high, 'l'), thickness, tags);
      if (forward) this.setSlot(1, 2 * (to >> 1) + 1);
      else this.setSlot(0, 2 * (to >> 1));
    }
    this.flip = {
      from,
      to,
      forward,
      p: forward ? 0 : 1,
      goal: forward ? 1 : 0,
      held,
      seconds: FLIP_SECONDS + Math.min(0.3, 0.05 * (thickness - 1)),
    };
    this.paintFlip();
    this.reach();
    for (const tab of this.tabs) {
      for (const el of [tab.el, tab.small]) el.classList.toggle('here', tab.section === this.sheets[to].section);
    }
    this.updateChrome(to);
    this.announce(to);
    return true;
  }

  private paintFlip() {
    const flip = this.flip;
    if (!flip) return;
    const middle = this.flipper.set(flip.p, flip.forward);
    // The page in the air shades whichever page it's over.
    const lift = Math.sin(middle);
    this.casts[1].style.opacity = `${(Math.max(0, Math.cos(middle)) * lift * 1.5).toFixed(3)}`;
    this.casts[0].style.opacity = `${(Math.max(0, -Math.cos(middle)) * lift * 1.5).toFixed(3)}`;
  }

  /** Whatever is in the air lands at once, wherever it was headed. */
  private endFlip() {
    const flip = this.flip;
    if (!flip) return;
    this.flip = null;
    const arrived = flip.goal === (flip.forward ? 1 : 0);
    this.at = arrived ? flip.to : flip.from;
    this.flipper.unload();
    this.casts[0].style.opacity = '0';
    this.casts[1].style.opacity = '0';
    this.present();
    if (!arrived) this.announce();
  }

  // ---- pressing, and dragging a page over ----

  private clicked(e: MouseEvent) {
    if (this.state === 'landed') {
      this.open();
      return;
    }
    if (this.state !== 'open' || this.locked) return;
    if (this.swallowClick) {
      this.swallowClick = false;
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement;
    const id =
      target.closest<HTMLElement>('[data-goto]')?.dataset.goto ??
      target.closest<HTMLAnchorElement>('a[href^="#"]')?.getAttribute('href')?.slice(1);
    if (!id) return;
    e.preventDefault();
    this.goToId(id);
  }

  private pressed(e: PointerEvent) {
    if (this.state !== 'open' || this.locked || e.button > 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    this.swallowClick = false;
    this.endFlip();
    // A press on a link stays a plain click unless it turns into a drag.
    const link = !!target.closest('a, [data-goto]');
    if (!link) this.el.setPointerCapture(e.pointerId);
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, link };
  }

  /** How far over a held page is, from where the pointer is. */
  private heldAt(clientX: number) {
    const spine = this.inset + (this.vw - this.inset) / 2 - (this.single ? this.pageWidth / 2 : 0);
    const across = (clientX - spine) / this.pageWidth;
    // With one page showing there's no left-hand side to drag onto, so the page's own width is the whole turn.
    if (this.single) return Math.max(0, Math.min(1, (1 - across) * 0.92));
    return Math.acos(Math.max(-1, Math.min(1, across))) / Math.PI;
  }

  private dragged(e: PointerEvent) {
    const press = this.press;
    if (!press || press.id !== e.pointerId) return;
    const dx = e.clientX - press.x;
    if (!press.dragging) {
      if (Math.abs(dx) < DRAG_START) return;
      press.dragging = true;
      if (press.link) this.el.setPointerCapture(press.id);
      const step = dx < 0 ? 1 : -1;
      const to = this.single ? this.at + step : (this.at & ~1) + 2 * step;
      if (to >= 0 && to < this.sheets.length) this.begin(to, true);
    }
    if (this.flip?.held) this.flip.p = this.heldAt(e.clientX);
  }

  private released(e: PointerEvent) {
    const press = this.press;
    if (!press || press.id !== e.pointerId) return;
    this.press = null;
    const dx = e.clientX - press.x;
    const flip = this.flip;
    if (press.dragging && press.link) this.swallowClick = true;
    if (flip?.held) {
      flip.held = false;
      const swiped = Math.abs(dx) >= SWIPE && dx < 0 === flip.forward;
      const far = flip.forward ? flip.p > 0.5 : flip.p < 0.5;
      // Not far enough, and not flicked: it falls back where it came from.
      flip.goal = (swiped || far) === flip.forward ? 1 : 0;
      flip.seconds *= 0.7;
    } else if (!press.dragging && !press.link) {
      // A plain press on a page turns it: forward on the right, back on the left.
      const middle = this.inset + (this.vw - this.inset) / 2;
      if (e.clientX > middle) this.next();
      else this.previous();
    }
  }

  private cancelled() {
    this.press = null;
    const flip = this.flip;
    if (flip?.held) {
      flip.held = false;
      flip.goal = flip.forward ? 0 : 1;
    }
  }

  tick(seconds: number) {
    this.stateSeconds += seconds;
    if (this.state === 'lifting') {
      const lifted = this.el.parentElement === this.reader;
      if (!lifted && (this.stateSeconds >= LIFT_AFTER || this.reducedMotion)) this.lift();
      if (this.stateSeconds >= LIFT_AFTER + ZOOM_SECONDS || this.reducedMotion) this.arrive();
    } else if (this.state === 'closing' && (this.stateSeconds >= ZOOM_SECONDS || this.reducedMotion)) {
      this.land();
    }
    if (this.zoomSeconds > 0) {
      this.zoomSeconds -= seconds;
      if (this.zoomSeconds <= 0) this.el.classList.remove('zoom');
    }

    const flip = this.flip;
    if (!flip) return;
    if (!flip.held) {
      const step = seconds / flip.seconds;
      flip.p = flip.goal ? Math.min(1, flip.p + step) : Math.max(0, flip.p - step);
    }
    this.paintFlip();
    if (!flip.held && flip.p === flip.goal) this.endFlip();
  }
}
