// What's in the grass: me, napping, and a drawing for each thing on my resume. These are plain DOM
// below the grass canvas, so they stay crisp, animated and readable by a screen reader, and the
// canvas really does lie over them. They're small, the way someone is in a field: long blades
// from all around cross over them until wind lays those blades another way.

import '@fontsource/patrick-hand/400.css';
import './scene.css';
import meSvg from './art/me.svg?raw';
import snoreSvg from './art/snore.svg?raw';
import { EXPERIENCE, type Experience } from './experience';
import type { Hole } from './fallback';
import { inkify } from './ink';

const SAID_TO_MOUSE = 'Hey there! welcome to my personal website. Drag your mouse around to learn more about me';
const SAID_TO_FINGER = 'Hey there! welcome to my personal website. Drag your finger around to learn more about me';

/** Share of my face, or of me overall, the wind has to reach before I wake up. */
const FACE_FOUND = 0.6;
const BODY_FOUND = 0.4;
/** Share of a drawing the wind has to reach before it counts as found. */
const ART_FOUND = 0.3;

const SWELL_SECONDS = 0.75;
const POP_SECONDS = 0.5;
const SPEAK_AFTER = 0.3;
const TYPE_PER_SECOND = 38;
/** Least time I stay up, then how long once the pointer has wandered off. */
const AWAKE_SECONDS = 9;
const LONGEST_AWAKE = 24;
/** How long a note stays once the pointer has moved off. */
const NOTE_LINGERS_MOUSE = 1.2;
const NOTE_LINGERS_TOUCH = 5;

/** How hard air lands around me when the bubble pops, then while I'm up, and around a drawing. */
const POP_PUFF = 26;
const AWAKE_PUFF = 12;
const NOTE_PUFF = 14;

/** Where things lie, as a share of the viewport. */
const WIDE: Record<string, [number, number]> = {
  me: [0.5, 0.57],
  nyu: [0.1, 0.24],
  florence: [0.33, 0.2],
  bgmc: [0.64, 0.17],
  refitting: [0.84, 0.3],
  odun: [0.19, 0.58],
  kalodata: [0.79, 0.63],
  safelease: [0.33, 0.87],
  rehab: [0.6, 0.89],
  cssa: [0.9, 0.85],
};
const TALL: Record<string, [number, number]> = {
  me: [0.5, 0.52],
  nyu: [0.2, 0.09],
  florence: [0.76, 0.12],
  bgmc: [0.42, 0.2],
  refitting: [0.82, 0.27],
  odun: [0.16, 0.29],
  kalodata: [0.84, 0.73],
  safelease: [0.2, 0.74],
  rehab: [0.56, 0.83],
  cssa: [0.2, 0.92],
};

export interface Grass {
  hold(slot: number, hold: { x: number; y: number; radius: number; strength: number } | null): void;
  place(objects: { x: number; y: number; rx: number; ry: number }[], paint: (ctx: CanvasRenderingContext2D) => void): void;
  /** CSS px: how far from the pointer its wind takes hold. */
  readonly reach: number;
}

/** A thing in the grass, and which parts of it the wind has reached. */
interface Spot {
  el: HTMLElement;
  item: Experience | null;
  x: number; // box, CSS px
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  marks: Uint8Array;
  found: boolean;
  outline: { path: Path2D; fill: boolean; stroke: number }[];
  viewWidth: number;
  viewHeight: number;
}

const GRID = 12; // CSS px between the points checked on each drawing
/** viewBox units added all around a drawing's outline: the grass keeps this far from it. */
const OUTLINE_MARGIN = 6;

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

/** The drawing's shapes, for working out exactly which ground it covers. */
function readOutline(svg: SVGSVGElement) {
  const outline: Spot['outline'] = [];
  for (const el of svg.querySelectorAll<SVGElement>('path, circle, ellipse, rect')) {
    if (el.closest('.face-awake')) continue;
    const path = new Path2D();
    if (el instanceof SVGPathElement) {
      path.addPath(new Path2D(el.getAttribute('d') ?? ''));
    } else if (el instanceof SVGCircleElement) {
      path.arc(el.cx.baseVal.value, el.cy.baseVal.value, el.r.baseVal.value, 0, 7);
    } else if (el instanceof SVGEllipseElement) {
      path.ellipse(el.cx.baseVal.value, el.cy.baseVal.value, el.rx.baseVal.value, el.ry.baseVal.value, 0, 0, 7);
    } else if (el instanceof SVGRectElement) {
      path.rect(el.x.baseVal.value, el.y.baseVal.value, el.width.baseVal.value, el.height.baseVal.value);
    }
    const style = getComputedStyle(el);
    outline.push({ path, fill: style.fill !== 'none', stroke: parseFloat(style.strokeWidth) || 3 });
  }
  return outline;
}

export class Scene {
  private readonly me: Spot;
  private readonly spots: Spot[];
  private readonly bubble: HTMLElement;
  private readonly said: HTMLElement;
  private readonly unsaid: HTMLElement;
  private readonly card: HTMLElement;
  private readonly zzz: HTMLElement;
  private readonly snore: HTMLElement;
  private readonly speech: string;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  private grass: Grass | null = null;
  private bare = false;
  private width = 1;
  private height = 1;
  private pointerAt: { x: number; y: number } | null = null;

  // me: asleep → swelling → up (the speech) → asleep, and from then on up whenever someone comes by
  private mood: 'asleep' | 'swelling' | 'up' = 'asleep';
  private moodSeconds = 0;
  private greeted = false;
  private typed = 0;

  private noted: Spot | null = null;
  private noteLeftSeconds = Infinity;
  private noteLingers = NOTE_LINGERS_MOUSE;
  private focused: Spot | null = null;

  constructor(ground: HTMLElement, notes: HTMLElement) {
    this.speech = matchMedia('(pointer: coarse)').matches ? SAID_TO_FINGER : SAID_TO_MOUSE;

    const list = document.createElement('ul');
    list.setAttribute('aria-label', 'What I have been up to');
    this.spots = EXPERIENCE.map((item) => {
      const el = html(`<li class="spot" tabindex="0">
        ${item.art}
        <span class="sr">${item.title}. ${item.role}. ${item.when}. ${item.note}</span>
      </li>`);
      list.append(el);
      // Keyboard only: a mouse pressed on a drawing shouldn't leave its note stuck open.
      el.addEventListener('focus', () => {
        if (el.matches(':focus-visible')) this.setFocus(spot);
      });
      el.addEventListener('blur', () => this.setFocus(null));
      const spot = this.newSpot(el, item);
      return spot;
    });

    const meEl = html(meSvg);
    ground.append(html('<h1 class="sr">Benny Yuan</h1>'), meEl, list);
    ground.querySelectorAll<SVGSVGElement>('svg').forEach(inkify);
    this.me = this.newSpot(meEl, null);
    for (const spot of [this.me, ...this.spots]) {
      const svg = spot.el instanceof SVGSVGElement ? spot.el : spot.el.querySelector('svg')!;
      spot.outline = readOutline(svg);
      spot.viewWidth = svg.viewBox.baseVal.width;
      spot.viewHeight = svg.viewBox.baseVal.height;
    }

    this.bubble = html('<div class="bubble" role="status"><span class="said"></span><span class="unsaid"></span></div>');
    this.said = this.bubble.querySelector('.said')!;
    this.unsaid = this.bubble.querySelector('.unsaid')!;
    this.card = html('<div class="card" aria-hidden="true"></div>');
    this.zzz = html('<div class="zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>');
    this.snore = html(`<div class="snore-holder" aria-hidden="true">${snoreSvg}</div>`);
    notes.append(this.snore, this.zzz, this.bubble, this.card);
    this.snore.querySelectorAll('svg').forEach((svg) => inkify(svg as SVGSVGElement));
    this.layout();
  }

  private newSpot(el: HTMLElement, item: Experience | null): Spot {
    return {
      el, item, x: 0, y: 0, w: 1, h: 1, cols: 1, rows: 1, marks: new Uint8Array(1), found: false,
      outline: [], viewWidth: 1, viewHeight: 1,
    };
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
    this.markAll();
  }

  private markAll() {
    this.me.marks.fill(1);
    for (const spot of this.spots) spot.marks.fill(1);
  }

  /** Where the grass must stay away from if it can't be blown aside. */
  holes(): Hole[] {
    return [this.me, ...this.spots].map(({ x, y, w, h }) => ({
      x: x + w / 2,
      y: y + h / 2,
      rx: w * 0.78,
      ry: h * 0.86,
    }));
  }

  private settleIntoGrass() {
    const all = [this.me, ...this.spots];
    this.grass?.place(
      all.map(({ x, y, w, h }) => ({ x: x + w / 2, y: y + h / 2, rx: w * 0.42, ry: h * 0.46 })),
      (ctx) => {
        for (const spot of all) {
          ctx.save();
          ctx.translate(spot.x, spot.y);
          const scale = spot.w / spot.viewWidth;
          ctx.scale(scale, scale);
          for (const { path, fill, stroke } of spot.outline) {
            if (fill) ctx.fill(path);
            ctx.lineWidth = stroke + OUTLINE_MARGIN;
            ctx.stroke(path);
          }
          ctx.restore();
        }
      },
    );
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
    const artSize = wide ? Math.max(70, Math.min(w * 0.072, h * 0.12, 124)) : Math.max(62, Math.min(w * 0.2, h * 0.095));
    const meWidth = wide ? Math.max(170, Math.min(w * 0.17, h * 0.3, 300)) : Math.max(160, Math.min(w * 0.46, 250));
    const place = (spot: Spot, id: string, bw: number, bh: number) => {
      const [fx, fy] = where[id];
      // Stay fully on screen whatever the shape of the window.
      spot.w = bw;
      spot.h = bh;
      spot.x = Math.max(10, Math.min(w - bw - 10, fx * w - bw / 2));
      spot.y = Math.max(10, Math.min(h - bh - 10, fy * h - bh / 2));
      spot.cols = Math.max(3, Math.ceil(bw / GRID));
      spot.rows = Math.max(3, Math.ceil(bh / GRID));
      spot.marks = new Uint8Array(spot.cols * spot.rows);
      Object.assign(spot.el.style, { left: `${spot.x}px`, top: `${spot.y}px`, width: `${bw}px`, height: `${bh}px` });
    };
    place(this.me, 'me', meWidth, (meWidth * 250) / 300);
    for (const spot of this.spots) place(spot, spot.item!.id, artSize, artSize);
    if (this.bare) this.markAll();

    const { x, y, w: mw, h: mh } = this.me;
    const bubbleSize = mw * 0.22;
    Object.assign(this.snore.style, {
      left: `${x + mw * 0.51 - bubbleSize * 0.08}px`,
      top: `${y + mh * 0.25 - bubbleSize * 0.92}px`,
      width: `${bubbleSize}px`,
      height: `${bubbleSize}px`,
    });
    Object.assign(this.zzz.style, { left: `${x + mw * 0.58}px`, top: `${y + mh * 0.02}px` });
    this.placeBubble();
    this.settleIntoGrass();
    if (this.noted) this.note(this.noted);
  }

  private placeBubble() {
    const { x, y, w } = this.me;
    const bubbleWidth = Math.min(340, this.width - 28);
    const left = Math.max(14, Math.min(this.width - bubbleWidth - 14, x + w * 0.5 - 60));
    this.bubble.style.left = `${left}px`;
    this.bubble.style.width = `${bubbleWidth}px`;
    this.bubble.style.bottom = `${Math.min(this.height - 100, this.height - y + 20)}px`;
    this.bubble.style.setProperty('--tail', `${Math.max(24, x + w * 0.5 - left)}px`);
  }

  /** The pointer moved from one place to another (CSS px), or left (null). */
  pointer(x: number | null, y = 0, touch = false) {
    this.noteLingers = touch ? NOTE_LINGERS_TOUCH : NOTE_LINGERS_MOUSE;
    if (x === null) {
      this.pointerAt = null;
      return;
    }
    const from = this.pointerAt ?? { x, y };
    this.pointerAt = { x, y };
    const reach = this.grass?.reach ?? 0;
    this.reachSpot(this.me, from.x, from.y, x, y, reach);
    for (const spot of this.spots) this.reachSpot(spot, from.x, from.y, x, y, reach);
  }

  private reachSpot(spot: Spot, ax: number, ay: number, bx: number, by: number, reach: number) {
    if (Math.max(ax, bx) < spot.x - reach || Math.min(ax, bx) > spot.x + spot.w + reach) return;
    if (Math.max(ay, by) < spot.y - reach || Math.min(ay, by) > spot.y + spot.h + reach) return;
    for (let j = 0; j < spot.rows; j++) {
      for (let i = 0; i < spot.cols; i++) {
        const k = j * spot.cols + i;
        if (spot.marks[k]) continue;
        const px = spot.x + ((i + 0.5) / spot.cols) * spot.w;
        const py = spot.y + ((j + 0.5) / spot.rows) * spot.h;
        if (distanceToSegment(px, py, ax, ay, bx, by) < reach) spot.marks[k] = 1;
      }
    }
  }

  /** Share of a part of a spot the wind has reached; the part is given as shares of its box. */
  private shareReached(spot: Spot, left = 0, right = 1, top = 0, bottom = 1) {
    const i0 = Math.floor(spot.cols * left);
    const i1 = Math.ceil(spot.cols * right);
    const j0 = Math.floor(spot.rows * top);
    const j1 = Math.ceil(spot.rows * bottom);
    let seen = 0;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) seen += spot.marks[j * spot.cols + i];
    }
    return seen / Math.max(1, (i1 - i0) * (j1 - j0));
  }

  private near(spot: Spot, margin: number) {
    const p = this.pointerAt;
    return !!p && p.x > spot.x - margin && p.x < spot.x + spot.w + margin && p.y > spot.y - margin && p.y < spot.y + spot.h + margin;
  }

  tick(seconds: number) {
    this.moodSeconds += seconds;
    this.tickMe();
    this.tickNotes(seconds);
  }

  private setMoodClass(name: string, on: boolean) {
    this.me.el.classList.toggle(name, on);
    this.snore.classList.toggle(name, on);
  }

  private tickMe() {
    if (this.mood === 'asleep') {
      const found = this.greeted
        ? this.near(this.me, 0)
        : this.shareReached(this.me, 0.3, 0.7, 0, 0.4) > FACE_FOUND || this.shareReached(this.me) > BODY_FOUND;
      if (!found) return;
      this.zzz.classList.add('gone');
      if (this.greeted) {
        this.wake();
        this.showSpeech(this.speech.length);
      } else {
        this.mood = 'swelling';
        this.moodSeconds = 0;
        this.setMoodClass('swell', true);
      }
    } else if (this.mood === 'swelling') {
      if (this.moodSeconds >= SWELL_SECONDS || this.reducedMotion) {
        this.setMoodClass('swell', false);
        this.setMoodClass('popped', true);
        this.wake();
      }
    } else {
      this.tickSpeech();
      const t = this.moodSeconds;
      if (t > POP_SECONDS) this.setMoodClass('popped', false);
      this.keepAirOnMe(t);
      const typedOut = this.typed >= this.speech.length;
      if (typedOut && !this.near(this.me, 40) && (t > AWAKE_SECONDS || this.greeted) && t > 2) this.doze();
      else if (t > LONGEST_AWAKE) this.doze();
    }
  }

  private wake() {
    this.mood = 'up';
    this.moodSeconds = 0;
    this.setMoodClass('up', true);
    this.typed = 0;
  }

  private doze() {
    this.mood = 'asleep';
    this.moodSeconds = 0;
    this.greeted = true;
    this.setMoodClass('up', false);
    this.setMoodClass('popped', false);
    this.me.marks.fill(0);
    this.bubble.classList.remove('on');
    this.grass?.hold(0, null);
  }

  /** The pop blows the grass off me, and a gentler stream keeps it off while I'm talking. */
  private keepAirOnMe(t: number) {
    const { x, y, w, h } = this.me;
    const fading = Math.min(1, t / POP_SECONDS);
    this.grass?.hold(0, {
      x: x + w / 2,
      y: y + h * 0.5,
      radius: w * 0.42,
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

  // ---- notes on the drawings ----

  private setFocus(spot: Spot | null) {
    this.focused = spot;
    if (spot) spot.found = true;
  }

  private tickNotes(seconds: number) {
    for (const spot of this.spots) {
      if (!spot.found && this.shareReached(spot) > ART_FOUND) spot.found = true;
    }
    // Nothing cuts in while I'm saying hello for the first time.
    const hushed = !this.greeted && (this.mood === 'swelling' || (this.mood === 'up' && this.typed < this.speech.length));
    const talking = this.mood === 'up' && this.near(this.me, 30);
    const under = hushed || talking ? null : this.focused ?? this.spots.find((s) => s.found && this.near(s, 14)) ?? null;
    if (under) {
      this.noteLeftSeconds = 0;
      if (under !== this.noted) this.note(under);
    } else if (this.noted) {
      this.noteLeftSeconds += seconds;
      if (this.noteLeftSeconds > this.noteLingers) this.note(null);
    }
  }

  private note(spot: Spot | null) {
    this.noted = spot;
    if (!spot) {
      this.card.classList.remove('on');
      this.bubble.classList.remove('aside');
      this.grass?.hold(1, null);
      return;
    }
    const item = spot.item!;
    this.card.innerHTML = `<h2></h2><p class="role"></p><p class="when"></p><p class="note"></p>`;
    this.card.querySelector('h2')!.textContent = item.title;
    this.card.querySelector('.role')!.textContent = item.role;
    this.card.querySelector('.when')!.textContent = item.when;
    this.card.querySelector('.note')!.textContent = item.note;
    this.placeCard(spot);
    this.card.classList.add('on');
    // On a small screen a note can land on my speech: my speech steps aside until it's gone.
    const a = this.card.getBoundingClientRect();
    const b = this.bubble.getBoundingClientRect();
    this.bubble.classList.toggle('aside', a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
    this.grass?.hold(1, { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2, radius: spot.w * 0.55, strength: NOTE_PUFF });
  }

  private placeCard(spot: Spot) {
    const margin = 12;
    const cardWidth = Math.min(280, this.width - 2 * margin);
    this.card.style.width = `${cardWidth}px`;
    const cardHeight = this.card.offsetHeight;
    const gap = 14;
    let left: number;
    let top: number;
    if (spot.x + spot.w + gap + cardWidth + margin <= this.width) {
      left = spot.x + spot.w + gap;
      top = spot.y + spot.h / 2 - cardHeight / 2;
    } else if (spot.x - gap - cardWidth >= margin) {
      left = spot.x - gap - cardWidth;
      top = spot.y + spot.h / 2 - cardHeight / 2;
    } else {
      // No room beside it. Stay clear of me: below if it's above me, above if it's below me.
      left = spot.x + spot.w / 2 - cardWidth / 2;
      const aboveMe = spot.y + spot.h / 2 < this.me.y + this.me.h / 2;
      top = aboveMe ? spot.y + spot.h + gap : spot.y - gap - cardHeight;
      const bottom = top + cardHeight;
      if (aboveMe && bottom > this.me.y - 8) top = Math.max(margin, this.me.y - 8 - cardHeight);
      if (!aboveMe && top < this.me.y + this.me.h + 8) top = this.me.y + this.me.h + 8;
    }
    this.card.style.left = `${Math.max(margin, Math.min(this.width - cardWidth - margin, left))}px`;
    this.card.style.top = `${Math.max(margin, Math.min(this.height - cardHeight - margin, top))}px`;
  }
}
