// Me, moving. The puppet (rig.ts) is always easing toward whatever pose the moment calls for, so
// one thing flows into the next without any of it being keyed by hand: asleep, awake and waving,
// pointing, and the whole business of a book coming down, which is one run of acts from the jump
// to standing well back with my hands up.
//
// Lying in the grass I'm drawn underneath it. On my feet I'm taller than the grass, so I'm drawn
// over it, with a shadow.

import { bounds, drawFigure, drawShadow, project } from './draw';
import { add, AWAKE, FLINCH, mixPose, pointing, RELIEF, run, scale, SCRAMBLE, SHOCK, SIT, SKID, SLEEP, solve, STAND, WATCH, type Pose } from './rig';

type Act =
  | 'asleep' | 'awake' | 'pointing'
  | 'shock' | 'scramble' | 'running' | 'skid' | 'watching' | 'flinch' | 'relief'
  | 'sitting' | 'lying';

/** How long each passing act lasts, and what follows it. */
const NEXT: Partial<Record<Act, [seconds: number, then: Act]>> = {
  shock: [0.46, 'scramble'],
  scramble: [0.2, 'running'],
  skid: [0.3, 'watching'],
  flinch: [0.6, 'relief'],
  sitting: [0.5, 'lying'],
};
/** How quickly I ease into each act's pose, per second. */
const EASE: Record<Act, number> = {
  asleep: 5, awake: 9, pointing: 8,
  shock: 26, scramble: 18, running: 30, skid: 16, watching: 9, flinch: 28, relief: 7,
  sitting: 7, lying: 5.5,
};
/** Radians of stride per second: two steps a turn. */
const STRIDE = 17;
const LIE_SECONDS = 1.1;
/** The canvas, as a multiple of my height: room for arms in the air and a jump. */
const ROOM = 2.8;
/** Where the ground under me sits in that canvas, from its top. */
const FOOT = 0.62;

export class Actor {
  /** Where I am on the ground (my hips), CSS px. */
  x = 0;
  y = 0;

  private readonly canvas = document.createElement('canvas');
  private readonly shadow = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;
  private readonly shadowCtx = this.shadow.getContext('2d')!;
  private height = 200;
  private pose: Pose = SLEEP;
  private act: Act = 'asleep';
  private seconds = 0;
  private clock = 0;
  private stride = 0;
  private up = false;
  private frame = 0;
  private pointAt = 0;
  private trip = { fromX: 0, fromY: 0, toX: 0, toY: 0, seconds: 1, lookX: 0, lookY: 0 };
  private whenDown: (() => void) | null = null;

  constructor(
    private readonly ground: HTMLElement,
    private readonly sky: HTMLElement,
  ) {
    this.canvas.className = 'me';
    this.shadow.className = 'me-shadow';
    for (const el of [this.canvas, this.shadow]) el.setAttribute('aria-hidden', 'true');
    ground.append(this.canvas);
    sky.append(this.shadow);
    this.shadow.hidden = true;
  }

  // ---- where I am and how big ----

  resize(height: number) {
    this.height = height;
    const size = Math.ceil(height * ROOM);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const el of [this.canvas, this.shadow]) {
      el.width = Math.round(size * dpr);
      el.height = Math.round(size * dpr);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.transformOrigin = `50% ${FOOT * 100}%`;
    }
    this.shadow.style.filter = `blur(${(height * 0.028).toFixed(1)}px)`;
    this.draw();
  }

  /** Be somewhere, lying down asleep, with no getting there. */
  place(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.draw();
  }

  /** Lie down asleep right here and now, skipping whatever I was in the middle of. */
  drop() {
    this.act = 'asleep';
    this.seconds = 0;
    this.pose = SLEEP;
    this.setUp(false);
    this.draw();
  }

  /** The box around me when I'm lying asleep, CSS px. */
  get napBox() {
    const box = bounds(solve(SLEEP, this.height));
    return { x: this.x + box.left, y: this.y + box.top, w: box.right - box.left, h: box.bottom - box.top };
  }

  /** Where my mouth is when I'm lying asleep: that's where the snoring comes from. */
  get mouth() {
    const s = solve(SLEEP, this.height);
    const at = project(add(s.head, add(scale(s.headF, 0.07 * this.height), scale(s.headU, -0.04 * this.height))));
    return { x: this.x + at.x, y: this.y + at.y };
  }

  /** Mark the ground I lie on, with a margin, for the grass. */
  paintOutline(ctx: CanvasRenderingContext2D, margin: number) {
    ctx.save();
    ctx.translate(this.x, this.y);
    drawFigure(ctx, solve(SLEEP, this.height), { color: '#fff', margin });
    ctx.restore();
  }

  /** On my feet, above the grass. */
  get isUp() {
    return this.up;
  }

  /** Standing still and watching, the run over. */
  get isWatching() {
    return this.act === 'watching';
  }

  // ---- what I'm doing ----

  private begin(act: Act) {
    this.act = act;
    this.seconds = 0;
  }

  sleep() {
    if (this.act === 'awake' || this.act === 'pointing') this.begin('asleep');
  }

  wake() {
    if (this.act === 'asleep' || this.act === 'pointing') this.begin('awake');
  }

  /** Still lying down, point at somewhere on the ground. */
  point(x: number, y: number) {
    if (this.act !== 'asleep' && this.act !== 'awake' && this.act !== 'pointing') return;
    this.pointAt = Math.atan2(x - this.x, y - this.y);
    if (this.act !== 'pointing') this.begin('pointing');
  }

  /** Something's coming down: jump, scramble up, run to (toX, toY), then stand watching (lookX, lookY). */
  flee(toX: number, toY: number, lookX: number, lookY: number) {
    const distance = Math.hypot(toX - this.x, toY - this.y);
    this.trip = {
      fromX: this.x, fromY: this.y, toX, toY, lookX, lookY,
      seconds: Math.max(0.7, Math.min(1.35, distance / (this.height * 4.6))),
    };
    this.stride = 0;
    this.setUp(true);
    this.begin('shock');
  }

  /** It landed. */
  flinch() {
    if (this.up) this.begin('flinch');
  }

  /** Sit, lie back and go to sleep where I stand. */
  lieDown(done: () => void) {
    this.whenDown = done;
    if (!this.up) {
      this.finishLying();
      return;
    }
    this.begin('sitting');
  }

  private finishLying() {
    this.begin('asleep');
    this.setUp(false);
    const done = this.whenDown;
    this.whenDown = null;
    done?.();
  }

  private setUp(up: boolean) {
    if (up === this.up) return;
    this.up = up;
    (up ? this.sky : this.ground).append(this.canvas);
    this.shadow.hidden = !up;
  }

  /** The way I face to look from where I am toward a point. */
  private toward(x: number, y: number) {
    return Math.atan2(x - this.x, y - this.y);
  }

  private target(): Pose {
    const t = this.seconds;
    const trip = this.trip;
    switch (this.act) {
      case 'asleep': {
        // Breathing, and a mouth that opens with each snore.
        const breath = Math.sin(this.clock * 1.75);
        return { ...SLEEP, spine: [0.03, 1, 0.012 * breath], face: { ...SLEEP.face, mouth: 0.28 + 0.2 * breath } };
      }
      case 'awake': {
        if (t > 3.4) return AWAKE;
        const wave = Math.sin(t * 9.5);
        return { ...AWAKE, armR: [[-0.84, 0.4, 0.36], [-0.2 + 0.34 * wave, 0.8, 0.56]] };
      }
      case 'pointing':
        // A few jabs at it, then the arm just stays out.
        return pointing(this.pointAt, Math.max(0, Math.sin(t * 8)) * Math.exp(-t * 0.7));
      case 'shock': {
        // A real jump: up and back down over the length of the act.
        const k = Math.min(1, t / NEXT.shock![0]);
        return { ...SHOCK, lift: 0.34 * 4 * k * (1 - k) };
      }
      case 'scramble':
        return { ...SCRAMBLE, yaw: Math.atan2(trip.toX - trip.fromX, trip.toY - trip.fromY) };
      case 'running': {
        const heading = Math.atan2(trip.toX - trip.fromX, trip.toY - trip.fromY);
        // Arms in the air to begin with, then head down and run.
        const panic = 1 - Math.min(1, Math.max(0, (t / trip.seconds - 0.45) / 0.3));
        return run(this.stride, heading, panic);
      }
      case 'skid':
        return { ...SKID, yaw: Math.atan2(trip.toX - trip.fromX, trip.toY - trip.fromY) };
      case 'watching': {
        const sway = Math.sin(this.clock * 2.2) * 0.03;
        return { ...WATCH, yaw: this.toward(trip.lookX, trip.lookY), roll: sway, head: [0, 0.78 + sway, 0] };
      }
      case 'flinch':
        return { ...FLINCH, yaw: this.toward(trip.lookX, trip.lookY) };
      case 'relief': {
        const facing = this.toward(trip.lookX, trip.lookY);
        // A wipe of the brow, then just standing there looking at it.
        if (t < 1.1) return { ...RELIEF, yaw: facing };
        return { ...STAND, yaw: facing, head: [0, -0.1, 0], face: { eyes: 1, brows: 0.5, mouth: 0, smile: 0.1, shades: 1 } };
      }
      case 'sitting':
        return { ...SIT, yaw: SLEEP.yaw };
      case 'lying': {
        // A yawn on the way down, and the sunglasses come back down at the end.
        const k = Math.min(1, t / LIE_SECONDS);
        return { ...SLEEP, face: { eyes: k > 0.5 ? 0 : 0.5, brows: 0, mouth: k < 0.6 ? 0.9 : 0.3, smile: 0, shades: k > 0.75 ? 0 : 1 } };
      }
    }
  }

  tick(seconds: number) {
    this.seconds += seconds;
    this.clock += seconds;
    const next = NEXT[this.act];
    if (next && this.seconds >= next[0]) this.begin(next[1]);

    if (this.act === 'running') {
      const trip = this.trip;
      const k = Math.min(1, this.seconds / trip.seconds);
      // Off the mark slowly, flat out in the middle, braking at the end.
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.x = trip.fromX + (trip.toX - trip.fromX) * eased;
      this.y = trip.fromY + (trip.toY - trip.fromY) * eased;
      this.stride += seconds * STRIDE * (0.55 + 0.9 * Math.sin(Math.PI * k));
      if (k >= 1) this.begin('skid');
    } else if (this.act === 'lying' && this.seconds >= LIE_SECONDS) {
      this.finishLying();
    }

    this.pose = mixPose(this.pose, this.target(), 1 - Math.exp(-seconds * EASE[this.act]));
    // Asleep under the grass there's little to see: breathing doesn't need every frame.
    this.frame++;
    if (this.act !== 'asleep' || this.frame % 3 === 0) this.draw();
  }

  private draw() {
    const H = this.height;
    const size = H * ROOM;
    const dpr = this.canvas.width / size;
    const s = solve(this.pose, H);
    // Coming up off the ground is coming toward the camera.
    const near = 1 + 0.3 * Math.max(0, this.pose.lift);
    const at = `translate(${(this.x - size / 2).toFixed(1)}px, ${(this.y - size * FOOT).toFixed(1)}px)`;
    this.canvas.style.transform = `${at} scale(${near.toFixed(3)})`;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size * FOOT);
    drawFigure(ctx, s);
    if (!this.up) return;
    this.shadow.style.transform = at;
    const shadow = this.shadowCtx;
    shadow.setTransform(dpr, 0, 0, dpr, 0, 0);
    shadow.clearRect(0, 0, size, size);
    shadow.translate(size / 2, size * FOOT);
    drawShadow(shadow, s);
  }
}
