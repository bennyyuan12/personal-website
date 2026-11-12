// The book coming down. From up here we only see what it does to the ground: a shadow, small and
// soft while the book is high up, growing and sharpening as it falls. It's only in the last moment
// that the book itself comes past the camera and lands.

import type { Book, Pose } from './book/book';

/** Seconds from the first sign of the shadow to the landing. */
export const FALL_SECONDS = 2.7;
/** How long the book itself can be seen before it lands. */
const SEEN_FOR = 0.26;
/** It stays on top of the grass until the landing has blown the blades off it. */
const UNDER_AFTER = 0.26;
/** The size of the shadow at the top of the fall, as a share of the book's. */
const SHADOW_START = 0.1;
const SHADOW_GROWTH = 1.7;
const CAMERA_HEIGHT = 2.6;

/** The shadow slides in along the light as the book comes down. */
const LIGHT = { x: -0.62, y: 0.78 };
const SHADOW_SLIDE = 150; // CSS px at the top of the fall

export interface DropHooks {
  /** Each frame of the fall: 0 at the top .. 1 at the landing. */
  falling(progress: number): void;
  /** It hit the ground. */
  landed(): void;
  /** It's lying under the grass now. */
  settled(): void;
}

export class Drop {
  private seconds = 0;
  private running = false;
  private hit = false;
  private instant = false;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly shadow: HTMLElement,
    private readonly thud: HTMLElement,
    private readonly book: Book,
    private readonly hooks: DropHooks,
  ) {}

  /** instant: it's simply there, with nothing to watch. */
  start(instant = false) {
    this.seconds = 0;
    this.running = true;
    this.hit = false;
    this.instant = instant || this.reducedMotion;
    const { x, y } = this.book.restPose;
    const { w, h } = this.book.groundSize;
    Object.assign(this.shadow.style, { left: `${x - w / 2}px`, top: `${y - h / 2}px`, width: `${w}px`, height: `${h}px` });
    Object.assign(this.thud.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    this.thud.style.setProperty('--angle', `${this.book.restPose.angle}rad`);
    if (this.instant) this.seconds = FALL_SECONDS;
  }

  get active() {
    return this.running;
  }

  tick(seconds: number) {
    if (!this.running) return;
    this.seconds += seconds;
    const t = this.seconds;
    const k = Math.min(1, t / FALL_SECONDS);
    const height = 1 - k * k; // free fall
    this.hooks.falling(k);

    const rest = this.book.restPose;
    const flutter = 0.08 * height * Math.sin(t * 9);
    const spin = rest.angle + height * 1.1 + flutter;
    if (!this.hit) {
      const scale = SHADOW_START + (1 - SHADOW_START) * k ** SHADOW_GROWTH;
      const slide = SHADOW_SLIDE * height;
      this.shadow.style.transform =
        `translate(${LIGHT.x * slide}px, ${LIGHT.y * slide}px) rotate(${spin}rad) scale(${scale})`;
      this.shadow.style.opacity = `${0.34 + 0.46 * k}`;
      this.shadow.style.filter = `blur(${2 + 16 * height}px)`;

      const seen = t - (FALL_SECONDS - SEEN_FOR);
      if (seen > 0) {
        const pose: Pose = { x: rest.x, y: rest.y, angle: spin, scale: rest.scale / (1 - CAMERA_HEIGHT * height) };
        this.book.fall(pose, Math.min(1, seen / 0.1));
      }
    }

    if (k >= 1 && !this.hit) {
      this.hit = true;
      this.book.fall(rest, 1);
      this.shadow.style.opacity = '0';
      if (!this.instant) this.thud.classList.add('on');
      this.hooks.landed();
    }
    if (this.hit && (this.instant || t >= FALL_SECONDS + UNDER_AFTER)) {
      this.running = false;
      this.book.settle();
      this.hooks.settled();
      window.setTimeout(() => this.thud.classList.remove('on'), 500);
    }
  }
}
