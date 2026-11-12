// What's in the grass: me, napping, and a big red button. Both lie on the ground under the grass
// canvas, so the grass really does cover them, until wind lays the blades another way. Press the
// button (or pick a section from the quiet links at the top) and a book comes down on the spot
// where I was lying, so I get out of the way.

import './scene.css';
import buttonSvg from './art/button.svg?raw';
import snoreSvg from './art/snore.svg?raw';
import { Book } from './book/book';
import type { BookData } from './book/types';
import { Drop } from './drop';
import type { Hole } from './fallback';
import { inkify } from './ink';
import { Actor } from './me/actor';

const SAID_HELLO =
  'Hey there! welcome to my personal website. There’s a red button hiding somewhere in this grass. Find it and press it to learn more about me';
const SAID_AFTER_BOOK = 'That was close. The book’s for you, by the way';

/** Share of my face, or of me overall, the wind has to reach before I wake up. */
const FACE_FOUND = 0.6;
const BODY_FOUND = 0.4;
/** Share of the button the wind has to reach before it counts as found. */
const BUTTON_FOUND = 0.45;

const SWELL_SECONDS = 0.75;
const POP_SECONDS = 0.5;
const SPEAK_AFTER = 0.3;
const TYPE_PER_SECOND = 38;
/** Least time I stay up, then how long once the pointer has wandered off. */
const AWAKE_SECONDS = 9;
const LONGEST_AWAKE = 24;

/** How hard air lands around me when the bubble pops, then while I'm up. */
const POP_PUFF = 26;
const AWAKE_PUFF = 12;
/** Air that keeps the button clear while someone's at it. */
const BUTTON_PUFF = 11;

// ---- the book coming down ----
/** How far through the fall I notice the shadow. */
const NOTICE_AT = 0.3;
/** After the book has landed, how long I stand there before lying back down. */
const STARE_SECONDS = 2.1;
const SHOCK_PUFF = 13;
const RUN_PUFF = 7;
/** Air the book pushes ahead of it, the landing, and what's left as it dies away. */
const PUSH_PUFF = 5;
const LAND_PUFF = 15;
const LAND_DECAY = 0.5;
const LIFT_PUFF = 15;
/** Seconds for the grass to fall into its new lay. */
const LAY_SECONDS = 1.1;

/** Where things are, as a share of the window. */
const WIDE = { me: [0.5, 0.58], aside: [0.84, 0.72], book: [0.5, 0.55], button: [0.2, 0.33] };
const TALL = { me: [0.5, 0.53], aside: [0.7, 0.86], book: [0.5, 0.47], button: [0.27, 0.2] };

export interface Grass {
  hold(slot: number, hold: { x: number; y: number; radius: number; strength: number } | null): void;
  nests(nests: { x: number; y: number; rx: number; ry: number; pull: number }[]): void;
  outlines(paint: (ctx: CanvasRenderingContext2D) => void): void;
  /** CSS px: how far from the pointer its wind takes hold. */
  readonly reach: number;
}

/** Which air keeps which thing clear. */
const AIR = { me: 0, book: 1, button: 2 };

/** CSS px the grass keeps back from the outline of whatever lies in it. */
const OUTLINE_MARGIN = 4;

function html(markup: string) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as HTMLElement;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / Math.max(dx * dx + dy * dy, 1e-6)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** A patch of ground with something lying on it, and which parts of it the wind has reached. */
class Spot {
  x = 0;
  y = 0;
  w = 1;
  h = 1;
  private cols = 1;
  private rows = 1;
  private marks = new Uint8Array(1);

  set(box: { x: number; y: number; w: number; h: number }, reached: boolean) {
    Object.assign(this, box);
    this.cols = Math.max(3, Math.ceil(box.w / 12));
    this.rows = Math.max(3, Math.ceil(box.h / 12));
    this.marks = new Uint8Array(this.cols * this.rows).fill(reached ? 1 : 0);
  }

  fill(reached: boolean) {
    this.marks.fill(reached ? 1 : 0);
  }

  /** The pointer's wind went from a to b. */
  blow(ax: number, ay: number, bx: number, by: number, reach: number) {
    if (Math.max(ax, bx) < this.x - reach || Math.min(ax, bx) > this.x + this.w + reach) return;
    if (Math.max(ay, by) < this.y - reach || Math.min(ay, by) > this.y + this.h + reach) return;
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const k = j * this.cols + i;
        if (this.marks[k]) continue;
        const px = this.x + ((i + 0.5) / this.cols) * this.w;
        const py = this.y + ((j + 0.5) / this.rows) * this.h;
        if (distanceToSegment(px, py, ax, ay, bx, by) < reach) this.marks[k] = 1;
      }
    }
  }

  /** Share of a part of it the wind has reached; the part is given as shares of its box. */
  share(left = 0, right = 1, top = 0, bottom = 1) {
    const i0 = Math.floor(this.cols * left);
    const i1 = Math.ceil(this.cols * right);
    const j0 = Math.floor(this.rows * top);
    const j1 = Math.ceil(this.rows * bottom);
    let seen = 0;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) seen += this.marks[j * this.cols + i];
    }
    return seen / Math.max(1, (i1 - i0) * (j1 - j0));
  }

  near(p: { x: number; y: number } | null, margin: number) {
    return !!p && p.x > this.x - margin && p.x < this.x + this.w + margin && p.y > this.y - margin && p.y < this.y + this.h + margin;
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get cy() {
    return this.y + this.h / 2;
  }
}

// asleep → swelling → up (the speech) → asleep, and from then on up whenever someone comes by.
// When a book comes down: fleeing → staring → lying down → asleep, somewhere else.
type Mood = 'asleep' | 'swelling' | 'up' | 'fleeing' | 'staring' | 'lying down';

export class Scene {
  readonly book: Book;

  /** Things moved, so whatever keeps clear of them needs to know. */
  onMoved: (() => void) | null = null;

  private readonly actor: Actor;
  private readonly me = new Spot();
  private readonly bubble: HTMLElement;
  private readonly said: HTMLElement;
  private readonly unsaid: HTMLElement;
  private readonly zzz: HTMLElement;
  private readonly snore: HTMLElement;
  private readonly gasp: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly buttonSpot = new Spot();
  private readonly sign: HTMLElement;
  private readonly navButtons = new Map<string, HTMLButtonElement>();
  private readonly drop: Drop;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private speech = SAID_HELLO;

  private grass: Grass | null = null;
  private bare = false;
  private width = 1;
  private height = 1;
  private tall = 200; // my height, CSS px
  private pointerAt: { x: number; y: number } | null = null;

  private mood: Mood = 'asleep';
  private moodSeconds = 0;
  private greeted = false;
  private typed = 0;
  private lying = true;
  private aside = false; // I've moved out of the book's way

  private buttonFound = false;
  private buttonFocused = false;

  private bookDown = false; // the grass has to make room for it
  private bookLandedSeconds: number | null = null;
  private bookPull = 0;
  private myPull = 1;
  private oldNest: { x: number; y: number; rx: number; ry: number; pull: number } | null = null;
  private layChanging = false;
  private puff = 0;
  private openOnLanding = false;
  private quietDrop = false;

  constructor(ground: HTMLElement, notes: HTMLElement, reader: HTMLElement, nav: HTMLElement, data: BookData) {
    ground.append(html('<h1 class="sr">Benny Yuan</h1>'));

    this.button = html(`<button class="redbutton" type="button" aria-label="A big red button">${buttonSvg}</button>`) as HTMLButtonElement;
    ground.append(this.button);
    inkify(this.button.querySelector('svg') as SVGSVGElement);
    this.button.addEventListener('click', () => this.pressButton());
    this.button.addEventListener('focus', () => {
      // Someone tabbing to it should see what they're on.
      this.buttonFocused = this.button.matches(':focus-visible');
    });
    this.button.addEventListener('blur', () => (this.buttonFocused = false));

    this.bubble = html('<div class="bubble" role="status"><span class="said"></span><span class="unsaid"></span></div>');
    this.said = this.bubble.querySelector('.said')!;
    this.unsaid = this.bubble.querySelector('.unsaid')!;
    this.zzz = html('<div class="zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>');
    this.snore = html(`<div class="snore-holder" aria-hidden="true">${snoreSvg}</div>`);
    this.gasp = html('<div class="gasp" aria-hidden="true">!</div>');
    this.hint = html('<div class="book-hint" role="status"></div>');
    this.sign = html('<div class="button-sign" aria-hidden="true">press it!</div>');
    const upright = html('<div class="upright"></div>');
    const shadow = html(`<div class="book-shadow" aria-hidden="true"><svg viewBox="0 0 1460 1000" preserveAspectRatio="none">
      <path d="M0 16 C240 -8 520 -8 730 28 C940 -8 1220 -8 1460 16 L1460 1010 C1220 984 940 984 730 1020 C520 984 240 984 0 1010 Z"/>
    </svg></div>`);
    const thud = html(`<div class="thud" aria-hidden="true"><svg class="art" viewBox="0 0 400 280" preserveAspectRatio="none">
      <path d="M-14 -18 L-52 -46 M90 -22 L78 -66 M200 -24 L200 -74 M310 -22 L322 -66 M414 -18 L452 -46"/>
      <path d="M-24 140 L-74 140 M424 140 L474 140"/>
      <path d="M-14 298 L-52 326 M90 302 L78 346 M200 304 L200 354 M310 302 L322 346 M414 298 L452 326"/>
    </svg></div>`);
    notes.append(this.snore, this.zzz, shadow, upright, this.gasp, thud, this.sign, this.bubble, this.hint);
    this.snore.querySelectorAll('svg').forEach((s) => inkify(s as SVGSVGElement));
    this.actor = new Actor(ground, upright);

    const list = document.createElement('ul');
    for (const section of data.sections) {
      if (!section.tab) continue;
      const li = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.textContent = section.title;
      link.addEventListener('click', () => this.summon(this.book.startOf(section.id)));
      li.append(link);
      list.append(li);
      this.navButtons.set(section.id, link);
    }
    nav.setAttribute('aria-label', 'Sections');
    nav.append(list);

    this.book = new Book(ground, notes, reader, {
      lifting: () => this.bookLifting(),
      closing: () => (this.puff = LIFT_PUFF),
      closed: () => this.letGrassBack(),
      section: (id) => this.showSection(id),
    });
    this.book.setData(data);
    this.drop = new Drop(shadow, thud, this.book, {
      falling: (k) => this.bookFalling(k),
      landed: () => this.bookHit(),
      settled: () => this.bookSettled(),
    });
    this.layout();
  }

  /** The grass to work with, once it exists. */
  connect(grass: Grass) {
    this.grass = grass;
    this.settleIntoGrass();
  }

  /** There's no grass to blow aside: everything counts as uncovered from the start. */
  uncoverAll() {
    this.grass = null;
    this.bare = true;
    this.me.fill(true);
    this.buttonSpot.fill(true);
  }

  /** Where the grass must stay away from if it can't be blown aside. */
  holes(): Hole[] {
    const holes: Hole[] = [{ x: this.buttonSpot.cx, y: this.buttonSpot.cy, rx: this.buttonSpot.w * 0.8, ry: this.buttonSpot.h * 0.8 }];
    if (this.lying) holes.push({ x: this.me.cx, y: this.me.cy, rx: this.me.w * 0.7, ry: this.me.h * 0.7 });
    if (this.bookDown) {
      const { x, y } = this.book.restPose;
      const { w, h } = this.book.groundSize;
      holes.push({ x, y, rx: w * 0.72, ry: h * 0.8 });
    }
    return holes;
  }

  /** Tell the grass exactly which ground is lain on, and how it lies around that. */
  private settleIntoGrass() {
    this.nestUp();
    this.grass?.outlines((ctx) => {
      if (this.lying) this.actor.paintOutline(ctx, OUTLINE_MARGIN);
      ctx.beginPath();
      ctx.arc(this.buttonSpot.cx, this.buttonSpot.cy, this.buttonSpot.w * 0.5 + OUTLINE_MARGIN, 0, 7);
      ctx.fill();
      if (this.bookDown) {
        const { x, y, angle } = this.book.restPose;
        const { w, h } = this.book.groundSize;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 9);
        ctx.restore();
      }
    });
  }

  private myNest(pull: number) {
    return { x: this.me.cx, y: this.me.cy, rx: this.me.w * 0.44, ry: this.me.h * 0.46, pull };
  }

  /** How the grass lies around us right now. */
  private nestUp() {
    const nests = [this.myNest(this.myPull)];
    if (this.oldNest) nests.push(this.oldNest);
    const { x, y } = this.book.restPose;
    const { w, h } = this.book.groundSize;
    nests.push({ x, y, rx: w * 0.5, ry: h * 0.5, pull: -this.bookPull });
    nests.push({ x: this.buttonSpot.cx, y: this.buttonSpot.cy, rx: this.buttonSpot.w * 0.62, ry: this.buttonSpot.h * 0.62, pull: 1 });
    this.grass?.nests(nests);
  }

  layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.width = w;
    this.height = h;
    const wide = w >= h;
    const where = wide ? WIDE : TALL;
    // Sized from the reference photo: someone lying in a field takes up about a sixth of its width.
    const span = wide ? Math.max(170, Math.min(w * 0.17, h * 0.3, 300)) : Math.max(160, Math.min(w * 0.46, 250));
    this.tall = span * 0.86;
    this.actor.resize(this.tall);
    const [fx, fy] = this.aside ? where.aside : where.me;
    const at = this.keepOnScreen(fx * w, fy * h);
    if (this.lying) this.actor.place(at.x, at.y);
    this.me.set(this.actor.napBox, this.bare);

    const size = Math.max(64, Math.min(span * 0.46, 118));
    const bx = Math.max(size, Math.min(w - size, where.button[0] * w));
    const by = Math.max(size + 30, Math.min(h - size, where.button[1] * h));
    this.buttonSpot.set({ x: bx - size / 2, y: by - size / 2, w: size, h: size }, this.bare || this.buttonFound);
    Object.assign(this.button.style, { left: `${bx - size / 2}px`, top: `${by - size / 2}px`, width: `${size}px`, height: `${size}px` });
    Object.assign(this.sign.style, { left: `${bx}px`, top: `${by - size * 0.5 - 46}px` });

    this.placeNearMe();
    this.book.layout(w, h, where.book[0] * w, where.book[1] * h);
    const { x, y } = this.book.restPose;
    const { h: bookHeight } = this.book.groundSize;
    Object.assign(this.hint.style, { left: `${x}px`, top: `${y - bookHeight / 2 - 44}px` });
    this.settleIntoGrass();
  }

  /** The nearest place to a point where all of me fits in the window, lying down. */
  private keepOnScreen(x: number, y: number) {
    const H = this.tall;
    return {
      x: Math.max(H * 0.56 + 8, Math.min(this.width - H * 0.56 - 8, x)),
      y: Math.max(H * 0.66 + 8, Math.min(this.height - H * 0.52 - 8, y)),
    };
  }

  private placeNearMe() {
    const { x, y, w } = this.me;
    const mouth = this.actor.mouth;
    const bubbleSize = this.tall * 0.24;
    Object.assign(this.snore.style, {
      left: `${mouth.x - bubbleSize * 0.08}px`,
      top: `${mouth.y - bubbleSize * 0.92}px`,
      width: `${bubbleSize}px`,
      height: `${bubbleSize}px`,
    });
    Object.assign(this.zzz.style, { left: `${mouth.x + this.tall * 0.1}px`, top: `${mouth.y - this.tall * 0.3}px` });
    const bubbleWidth = Math.min(360, this.width - 28);
    const left = Math.max(14, Math.min(this.width - bubbleWidth - 14, x + w * 0.5 - 60));
    this.bubble.style.left = `${left}px`;
    this.bubble.style.width = `${bubbleWidth}px`;
    this.bubble.style.bottom = `${Math.min(this.height - 110, this.height - y + 20)}px`;
    this.bubble.style.setProperty('--tail', `${Math.max(24, Math.min(bubbleWidth - 40, x + w * 0.5 - left))}px`);
  }

  /** The pointer moved from one place to another (CSS px), or left (null). */
  pointer(x: number | null, y = 0) {
    if (x === null) {
      this.pointerAt = null;
      return;
    }
    const from = this.pointerAt ?? { x, y };
    this.pointerAt = { x, y };
    if (this.book.isReading) return;
    const reach = this.grass?.reach ?? 0;
    if (this.lying) this.me.blow(from.x, from.y, x, y, reach);
    this.buttonSpot.blow(from.x, from.y, x, y, reach);
  }

  /** Where the pointer is, if it's over the field and not over the open book. */
  private get over() {
    return this.book.isReading ? null : this.pointerAt;
  }

  tick(seconds: number) {
    this.moodSeconds += seconds;
    this.tickMe();
    this.actor.tick(seconds);
    this.tickButton();
    this.drop.tick(seconds);
    this.book.tick(seconds);
    this.tickLay(seconds);
    this.tickPuff(seconds);
  }

  // ---- the button ----

  private tickButton() {
    if (!this.buttonFound && this.buttonSpot.share() > BUTTON_FOUND) {
      this.buttonFound = true;
      this.button.classList.add('found');
    }
    // Once it's been found it stays easy to get at: air keeps the grass off while someone's near.
    const wanted = this.buttonFocused || (this.buttonFound && this.buttonSpot.near(this.over, 26));
    this.sign.classList.toggle('on', wanted && this.book.isAway);
    this.grass?.hold(AIR.button, wanted
      ? { x: this.buttonSpot.cx, y: this.buttonSpot.cy, radius: this.buttonSpot.w * 0.6, strength: BUTTON_PUFF }
      : null);
  }

  private pressButton() {
    this.buttonFound = true;
    this.button.classList.remove('pressed');
    void this.button.offsetWidth;
    this.button.classList.add('pressed');
    if (this.book.isAway) {
      this.summon(0);
    } else if (this.book.isLanded) {
      // It's already here: it gets a jolt.
      this.book.hop();
      this.puff = LAND_PUFF * 0.7;
    }
  }

  // ---- the book ----

  /** Bring the book down open at a sheet, or go to that sheet if it's already here. */
  private summon(sheet: number, quiet = false) {
    if (this.book.isAway) {
      this.quietDrop = quiet;
      this.book.prepare(Math.max(0, sheet));
      this.drop.start(quiet);
      this.showSection(null);
    } else if (this.book.isFalling) {
      this.book.show(sheet);
    } else {
      this.hint.classList.remove('on');
      this.book.go(sheet);
    }
  }

  /** Straight to a page of the book, without the show: someone followed a link to it. */
  openAt(pageId: string | null) {
    const sheet = pageId ? this.book.indexOf(pageId) : 0;
    if (sheet < 0) return;
    this.openOnLanding = true;
    this.summon(sheet, true);
  }

  private showSection(section: string | null) {
    for (const [id, link] of this.navButtons) {
      if (id === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  private bookFalling(progress: number) {
    if (progress >= NOTICE_AT && this.lying && !this.aside) this.startle();
    // The air under it has nowhere to go, so the grass below starts to part before it lands.
    if (progress > 0.5 && this.bookLandedSeconds === null) {
      const { x, y } = this.book.restPose;
      const push = ((progress - 0.5) / 0.5) ** 2;
      this.grass?.hold(AIR.book, { x, y, radius: this.book.groundSize.w * 0.34, strength: PUSH_PUFF * push });
    }
  }

  private bookHit() {
    this.bookDown = true;
    this.bookLandedSeconds = 0;
    this.puff = LAND_PUFF;
    this.layChanging = true;
    this.actor.flinch();
    this.settleIntoGrass();
    if (!this.quietDrop) {
      document.body.classList.remove('thudded');
      void document.body.offsetWidth;
      document.body.classList.add('thudded');
    }
    this.onMoved?.();
  }

  private bookSettled() {
    if (this.openOnLanding) {
      this.openOnLanding = false;
      this.book.open();
      return;
    }
    this.hint.textContent = 'go on, open me';
    this.hint.classList.add('on');
  }

  private bookLifting() {
    this.hint.classList.remove('on');
    this.puff = LIFT_PUFF;
  }

  /** Whatever is holding the grass off the book lets go. */
  private letGrassBack() {
    this.puff = Math.min(this.puff, LAND_PUFF * 0.4);
  }

  private tickPuff(seconds: number) {
    if (this.bookLandedSeconds !== null) this.bookLandedSeconds += seconds;
    if (this.puff <= 0) return;
    this.puff *= this.book.isMoving ? 1 : Math.exp(-seconds / LAND_DECAY);
    if (this.puff < 0.5) {
      this.puff = 0;
      this.grass?.hold(AIR.book, null);
      return;
    }
    const { x, y } = this.book.restPose;
    this.grass?.hold(AIR.book, { x, y, radius: this.book.groundSize.w * 0.46, strength: this.puff });
  }

  /** The grass falls into its new lay slowly, never all at once. */
  private tickLay(seconds: number) {
    if (!this.layChanging) return;
    const step = seconds / LAY_SECONDS;
    if (this.bookDown) this.bookPull = Math.min(1, this.bookPull + step);
    if (this.oldNest) {
      this.oldNest.pull = Math.max(0, this.oldNest.pull - step);
      if (this.oldNest.pull === 0) this.oldNest = null;
    }
    if (this.lying) this.myPull = Math.min(1, this.myPull + step);
    this.layChanging = (this.bookDown && this.bookPull < 1) || !!this.oldNest || (this.lying && this.myPull < 1);
    this.nestUp();
  }

  // ---- me ----

  private setMood(mood: Mood) {
    this.mood = mood;
    this.moodSeconds = 0;
  }

  private tickMe() {
    switch (this.mood) {
      case 'asleep': {
        const found = this.greeted
          ? this.me.near(this.over, 0)
          : this.me.share(0.3, 0.7, 0, 0.4) > FACE_FOUND || this.me.share() > BODY_FOUND;
        if (!found) return;
        this.zzz.classList.add('gone');
        if (this.greeted) {
          this.wake();
          this.showSpeech(this.speech.length);
        } else {
          this.setMood('swelling');
          this.snore.classList.add('swell');
        }
        break;
      }
      case 'swelling':
        if (this.moodSeconds >= SWELL_SECONDS || this.reducedMotion) {
          this.snore.classList.remove('swell');
          this.snore.classList.add('popped');
          this.wake();
        }
        break;
      case 'up': {
        this.tickSpeech();
        const t = this.moodSeconds;
        if (t > POP_SECONDS) this.snore.classList.remove('popped');
        this.keepAirOnMe(t);
        const typedOut = this.typed >= this.speech.length;
        // Once I've said there's a button, I point at it.
        if (typedOut && this.book.isAway && t > 1) this.actor.point(this.buttonSpot.cx, this.buttonSpot.cy);
        if (typedOut && !this.me.near(this.over, 40) && (t > AWAKE_SECONDS || this.greeted) && t > 2) this.doze();
        else if (t > LONGEST_AWAKE) this.doze();
        break;
      }
      case 'fleeing': {
        // Wherever I am, the grass feels me go through it.
        const running = this.moodSeconds > 0.5;
        this.grass?.hold(AIR.me, {
          x: this.actor.x,
          y: this.actor.y - this.tall * 0.1,
          radius: this.tall * (running ? 0.34 : 0.48),
          strength: running ? RUN_PUFF : SHOCK_PUFF,
        });
        if (this.moodSeconds > 0.45) this.gasp.classList.remove('on');
        if (this.actor.isWatching) {
          this.setMood('staring');
          this.grass?.hold(AIR.me, null);
        }
        break;
      }
      case 'staring':
        if ((this.bookLandedSeconds ?? 0) >= STARE_SECONDS) {
          this.setMood('lying down');
          this.actor.lieDown(() => this.settleDown());
        }
        break;
      case 'lying down':
        // The grass parts where I'm about to be.
        this.grass?.hold(AIR.me, { x: this.actor.x, y: this.actor.y - this.tall * 0.1, radius: this.tall * 0.42, strength: AWAKE_PUFF });
        break;
    }
  }

  private wake() {
    this.setMood('up');
    this.snore.classList.add('up');
    this.actor.wake();
    this.typed = 0;
  }

  private doze() {
    this.setMood('asleep');
    this.greeted = true;
    this.snore.classList.remove('up', 'popped');
    this.actor.sleep();
    this.me.fill(this.bare);
    this.bubble.classList.remove('on');
    this.zzz.classList.remove('gone');
    this.grass?.hold(AIR.me, null);
  }

  /** The pop blows the grass off me, and a gentler stream keeps it off while I'm talking. */
  private keepAirOnMe(t: number) {
    const fading = Math.min(1, t / POP_SECONDS);
    this.grass?.hold(AIR.me, {
      x: this.me.cx,
      y: this.me.cy,
      radius: this.me.w * 0.42,
      strength: this.greeted ? AWAKE_PUFF : POP_PUFF + (AWAKE_PUFF - POP_PUFF) * fading,
    });
  }

  private tickSpeech() {
    if (this.moodSeconds < SPEAK_AFTER && !this.greeted) return;
    const chars = this.reducedMotion || this.greeted
      ? this.speech.length
      : Math.floor((this.moodSeconds - SPEAK_AFTER) * TYPE_PER_SECOND);
    this.showSpeech(chars);
  }

  private showSpeech(chars: number) {
    const n = Math.min(chars, this.speech.length);
    if (n !== this.typed || !this.bubble.classList.contains('on')) {
      this.typed = n;
      this.said.textContent = this.speech.slice(0, n);
      this.unsaid.textContent = this.speech.slice(n);
      this.bubble.classList.add('on');
    }
  }

  // ---- getting out of the way ----

  private startle() {
    this.greeted = true;
    this.lying = false;
    this.aside = true;
    this.speech = SAID_AFTER_BOOK;
    this.bubble.classList.remove('on');
    this.snore.classList.remove('swell', 'up', 'popped');
    this.snore.classList.add('gone');
    this.zzz.classList.add('gone');
    // The grass I was lying on springs back, and the nest around it lets go.
    this.oldNest = this.myNest(this.myPull);
    this.myPull = 0;
    this.layChanging = true;

    const where = this.width >= this.height ? WIDE : TALL;
    const to = this.keepOnScreen(where.aside[0] * this.width, where.aside[1] * this.height);
    const book = this.book.restPose;
    if (this.reducedMotion || this.quietDrop) {
      this.actor.place(to.x, to.y);
      this.actor.drop();
      this.settleDown();
      return;
    }
    Object.assign(this.gasp.style, { left: `${this.actor.x}px`, top: `${this.actor.y - this.tall * 1.05}px` });
    this.gasp.classList.add('on');
    this.actor.flee(to.x, to.y, book.x, book.y);
    this.setMood('fleeing');
    this.settleIntoGrass();
    this.onMoved?.();
  }

  /** I'm lying down again, wherever I've ended up. */
  private settleDown() {
    this.lying = true;
    this.setMood('asleep');
    this.me.set(this.actor.napBox, this.bare);
    this.placeNearMe();
    this.snore.classList.remove('gone');
    this.zzz.classList.remove('gone');
    this.layChanging = true;
    this.settleIntoGrass();
    this.grass?.hold(AIR.me, null);
    this.onMoved?.();
  }
}
