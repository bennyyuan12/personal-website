// Draws the puppet from rig.ts: an inked figure with flat colour and one tone of shade.
// The camera looks down on the field from the south, so the ground is seen from above while
// anything with height is drawn up the screen from where it stands. Lying down I'm seen from
// directly above; on my feet I'm seen from the front, the side or the back, depending on the way
// I'm facing. Every part is built from the joints, so it holds together from any side.

import { add, dot, mix3, scale, sub, unit, v, type Skeleton, type V3 } from './rig';

/** How far up the screen a height is drawn. */
const RISE = 0.86;
/** From the scene toward the camera. */
const VIEW = unit(v(0, RISE, 1));
/** Toward the light, on screen. Shade falls on the other side of everything. */
const LIGHT = { x: 0.62, y: -0.78 };

export interface P2 {
  x: number;
  y: number;
}

export const project = (p: V3): P2 => ({ x: p.x, y: p.y - RISE * p.z });
const nearness = (p: V3) => p.y * VIEW.y + p.z * VIEW.z;

type Tone = [fill: string, shade: string];
const INK = '#1d1b17';
const HOODIE: Tone = ['#f3ecd9', '#d3c9ae'];
const PANTS: Tone = ['#4d586b', '#39424f'];
const BOOT: Tone = ['#b7814a', '#8e6136'];
const SKIN: Tone = ['#f2caa2', '#dbab80'];
const BAG: Tone = ['#cf9a2e', '#a67a1f'];
const HAIR = '#23201b';
const STRAP = '#3b352b';

interface Style {
  ink: string;
  /** Width of the inked line. */
  line: number;
  /** Outline only: everything one flat colour, no detail. For telling the grass where I am. */
  flat: boolean;
}

interface Seg {
  a: P2;
  b: P2;
  ra: number;
  rb: number;
}

const TAU = Math.PI * 2;
const mix2 = (a: P2, b: P2, t: number): P2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Two circles and the skin stretched between them. */
function addCapsule(ctx: CanvasRenderingContext2D, { a, b, ra, rb }: Seg) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(ra - rb) + 1e-3) {
    const big = ra >= rb ? a : b;
    const r = Math.max(ra, rb);
    ctx.moveTo(big.x + r, big.y);
    ctx.arc(big.x, big.y, r, 0, TAU);
    ctx.closePath();
    return;
  }
  const along = Math.atan2(dy, dx);
  const open = Math.acos((ra - rb) / d);
  ctx.moveTo(a.x + ra * Math.cos(along + open), a.y + ra * Math.sin(along + open));
  ctx.arc(a.x, a.y, ra, along + open, along - open + TAU);
  ctx.arc(b.x, b.y, rb, along - open, along + open);
  ctx.closePath();
}

function addCircle(ctx: CanvasRenderingContext2D, c: P2, r: number) {
  ctx.moveTo(c.x + r, c.y);
  ctx.arc(c.x, c.y, r, 0, TAU);
  ctx.closePath();
}

/** The outline around a set of points. */
function hull(points: P2[]) {
  const sorted = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  const turn = (o: P2, p: P2, q: P2) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const lower: P2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A smooth closed shape through the outline of some points. */
function addBlob(ctx: CanvasRenderingContext2D, points: P2[]) {
  const h = hull(points);
  const n = h.length;
  if (n < 3) return;
  const start = mix2(h[n - 1], h[0], 0.5);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const next = mix2(h[i], h[(i + 1) % n], 0.5);
    ctx.quadraticCurveTo(h[i].x, h[i].y, next.x, next.y);
  }
  ctx.closePath();
}

/**
 * Ink a shape and colour it in. The line goes down first at twice its width and the colour covers
 * the inner half, so shapes built from several pieces get one outline with no joins showing.
 */
function paint(ctx: CanvasRenderingContext2D, st: Style, build: () => void, [fill, shade]: Tone, depth: number) {
  ctx.beginPath();
  build();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = st.line * 2;
  ctx.stroke();
  if (st.flat) {
    ctx.fillStyle = st.ink;
    ctx.fill();
    return;
  }
  ctx.fillStyle = shade;
  ctx.fill();
  // The lit side is the same shape again, nudged toward the light and kept inside the outline.
  ctx.save();
  ctx.clip();
  ctx.translate(LIGHT.x * depth, LIGHT.y * depth);
  ctx.beginPath();
  build();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, st: Style, points: P2[], width = st.line * 0.8, color = st.ink) {
  if (st.flat || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Points around an ellipse standing in the world. */
function ring(center: V3, across: V3, deep: V3, a: number, b: number, n = 12) {
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    out.push(project(add(center, add(scale(across, Math.cos(t) * a), scale(deep, Math.sin(t) * b)))));
  }
  return out;
}

function drawLeg(ctx: CanvasRenderingContext2D, st: Style, s: Skeleton, i: number) {
  const H = s.height;
  const leg = s.legs[i];
  const hip = project(leg.hip);
  const knee = project(leg.knee);
  const ankle = project(leg.ankle);
  const toe = project(leg.toe);
  paint(ctx, st, () => {
    addCapsule(ctx, { a: hip, b: knee, ra: 0.057 * H, rb: 0.046 * H });
    addCapsule(ctx, { a: knee, b: ankle, ra: 0.046 * H, rb: 0.038 * H });
  }, PANTS, 0.02 * H);
  // A boot: its shaft up the shin, then the foot.
  const shaft = mix2(knee, ankle, 0.7);
  paint(ctx, st, () => {
    addCapsule(ctx, { a: shaft, b: ankle, ra: 0.043 * H, rb: 0.043 * H });
    addCapsule(ctx, { a: ankle, b: toe, ra: 0.043 * H, rb: 0.035 * H });
  }, BOOT, 0.016 * H);
  if (st.flat) return;
  // The top of the boot, and laces across the foot.
  const sideways = (from: P2, to: P2, at: number, half: number): P2[] => {
    const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const n = { x: -(to.y - from.y) / d, y: (to.x - from.x) / d };
    const c = mix2(from, to, at);
    return [{ x: c.x + n.x * half, y: c.y + n.y * half }, { x: c.x - n.x * half, y: c.y - n.y * half }];
  };
  line(ctx, st, sideways(shaft, ankle, 0.1, 0.04 * H));
  if (Math.hypot(toe.x - ankle.x, toe.y - ankle.y) > 0.05 * H) {
    line(ctx, st, sideways(ankle, toe, 0.4, 0.022 * H), st.line * 0.7);
    line(ctx, st, sideways(ankle, toe, 0.68, 0.02 * H), st.line * 0.7);
  }
}

function drawArm(ctx: CanvasRenderingContext2D, st: Style, s: Skeleton, i: number) {
  const H = s.height;
  const arm = s.arms[i];
  const shoulder = project(arm.shoulder);
  const elbow = project(arm.elbow);
  const wrist = project(arm.wrist);
  const tip = project(arm.tip);
  // The hand first, so the cuff sits over the wrist.
  const d = Math.hypot(tip.x - wrist.x, tip.y - wrist.y) || 1;
  const across = { x: -(tip.y - wrist.y) / d, y: (tip.x - wrist.x) / d };
  const thumbSide = i === 0 ? 1 : -1;
  const thumb = { x: wrist.x + (tip.x - wrist.x) * 0.42 + across.x * 0.026 * H * thumbSide, y: wrist.y + (tip.y - wrist.y) * 0.42 + across.y * 0.026 * H * thumbSide };
  paint(ctx, st, () => {
    addCapsule(ctx, { a: wrist, b: tip, ra: 0.027 * H, rb: 0.022 * H });
    addCircle(ctx, thumb, 0.011 * H);
  }, SKIN, 0.01 * H);
  paint(ctx, st, () => {
    addCapsule(ctx, { a: shoulder, b: elbow, ra: 0.042 * H, rb: 0.036 * H });
    addCapsule(ctx, { a: elbow, b: wrist, ra: 0.036 * H, rb: 0.031 * H });
  }, HOODIE, 0.016 * H);
  if (st.flat) return;
  // The ribbed cuff.
  const fd = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
  if (fd > 0.04 * H) {
    const n = { x: -(wrist.y - elbow.y) / fd, y: (wrist.x - elbow.x) / fd };
    const c = mix2(elbow, wrist, 0.84);
    line(ctx, st, [{ x: c.x + n.x * 0.03 * H, y: c.y + n.y * 0.03 * H }, { x: c.x - n.x * 0.03 * H, y: c.y - n.y * 0.03 * H }]);
  }
}

function drawTorso(ctx: CanvasRenderingContext2D, st: Style, s: Skeleton) {
  const H = s.height;
  const hem = sub(s.pelvis, scale(s.U, 0.045 * H));
  const top = add(s.chest, scale(s.chestU, 0.012 * H));
  const midL = unit(add(s.L, s.chestL));
  const midF = unit(add(s.F, s.chestF));
  const points = [
    ...ring(hem, s.L, s.F, 0.122 * H, 0.074 * H),
    ...ring(mix3(s.pelvis, s.chest, 0.45), midL, midF, 0.113 * H, 0.068 * H),
    ...ring(sub(s.chest, scale(s.chestU, 0.03 * H)), s.chestL, s.chestF, 0.136 * H, 0.07 * H),
    ...ring(top, s.chestL, s.chestF, 0.106 * H, 0.055 * H),
  ];
  paint(ctx, st, () => addBlob(ctx, points), HOODIE, 0.03 * H);
  if (st.flat) return;

  const facing = dot(s.chestF, VIEW);
  if (Math.abs(facing) < 0.1) return;
  const side = facing > 0 ? 1 : -1;
  /** A point on the surface of the hoodie: l across (-1..1), u up from the hem (0..1). */
  const on = (l: number, u: number) => {
    const center = mix3(hem, top, u);
    const across = unit(mix3(s.L, s.chestL, u));
    const deep = unit(mix3(s.F, s.chestF, u));
    const half = (0.122 + 0.012 * Math.sin(u * 2.6)) * H;
    return project(add(center, add(scale(across, l * half), scale(deep, side * 0.07 * H * Math.sqrt(Math.max(0, 1 - l * l))))));
  };
  const span = (l0: number, u0: number, l1: number, u1: number, n = 6) =>
    Array.from({ length: n + 1 }, (_, k) => on(l0 + ((l1 - l0) * k) / n, u0 + ((u1 - u0) * k) / n));

  ctx.save();
  ctx.globalAlpha = Math.min(1, (Math.abs(facing) - 0.1) / 0.2);
  line(ctx, st, span(-0.96, 0.08, 0.96, 0.08, 8), st.line * 0.7); // the hem band
  if (side > 0) {
    line(ctx, st, span(0, 0.96, 0, 0.1, 5), st.line * 0.7); // zip
    line(ctx, st, [...span(-0.5, 0.12, -0.62, 0.36, 2), ...span(-0.62, 0.36, 0.62, 0.36, 6), ...span(0.62, 0.36, 0.5, 0.12, 2)], st.line * 0.7); // pocket
    for (const x of [-1, 1]) {
      const cord = span(x * 0.13, 0.95, x * 0.2, 0.74, 2);
      line(ctx, st, cord, st.line * 0.7);
      ctx.beginPath();
      addCircle(ctx, cord[cord.length - 1], st.line * 0.9);
      ctx.fillStyle = st.ink;
      ctx.fill();
    }
  }
  // The bag's strap, from my right shoulder to my left hip, on whichever side is showing.
  const strap = span(-0.72, 1, 0.97, 0.1, 7);
  line(ctx, st, strap, 0.034 * H);
  line(ctx, st, strap, 0.034 * H - st.line * 1.6, STRAP);
  ctx.restore();
}

function drawBag(ctx: CanvasRenderingContext2D, st: Style, s: Skeleton) {
  const H = s.height;
  const center = bagCenter(s);
  const points: P2[] = [];
  for (const l of [-1, 0, 1]) {
    for (const u of [-1, 0, 1]) {
      for (const f of [-1, 0, 1]) {
        const n = Math.hypot(l, u, f);
        if (!n) continue;
        points.push(project(add(center, add(add(scale(s.L, (l / n) * 0.034 * H), scale(s.U, (u / n) * 0.062 * H)), scale(s.F, (f / n) * 0.052 * H)))));
      }
    }
  }
  paint(ctx, st, () => addBlob(ctx, points), BAG, 0.014 * H);
  if (st.flat) return;
  const flap = (f: number) => project(add(center, add(scale(s.U, 0.012 * H), add(scale(s.F, f * 0.046 * H), scale(s.L, 0.03 * H)))));
  line(ctx, st, [flap(-1), flap(0), flap(1)], st.line * 0.7);
}

const bagCenter = (s: Skeleton) =>
  add(s.pelvis, add(scale(s.L, 0.14 * s.height), add(scale(s.U, -0.03 * s.height), scale(s.F, 0.012 * s.height))));

/** A ball in the world is taller than it is wide on screen, because its near side is drawn lower. */
const BALL = Math.hypot(1, RISE);

function addBall(ctx: CanvasRenderingContext2D, c: P2, r: number) {
  ctx.moveTo(c.x + r, c.y);
  ctx.ellipse(c.x, c.y, r, r * BALL, 0, 0, TAU);
  ctx.closePath();
}

function drawHead(ctx: CanvasRenderingContext2D, st: Style, s: Skeleton) {
  const H = s.height;
  const R = 0.074 * H;
  const head = s.head;
  // The hood sits back on my head, so my face comes out of the front of it.
  const hood = project(add(head, add(scale(s.headF, -0.03 * H), scale(s.headU, 0.004 * H))));
  const hoodR = 0.09 * H;
  const collar = project(add(s.chest, scale(s.chestU, 0.004 * H)));
  paint(ctx, st, () => {
    addCapsule(ctx, { a: collar, b: hood, ra: 0.058 * H, rb: 0.07 * H });
    addBall(ctx, hood, hoodR);
  }, HOODIE, 0.022 * H);
  if (st.flat) return;

  const facing = dot(s.headF, VIEW);
  if (facing < -0.3) {
    // The back of the hood: the seam over the top.
    const seam = (t: number) => project(add(head, add(scale(s.headU, Math.cos(t) * 0.094 * H), scale(s.headF, -0.03 * H - Math.sin(t) * 0.09 * H))));
    line(ctx, st, [seam(0.1), seam(0.5), seam(0.9), seam(1.3)], st.line * 0.7);
    return;
  }

  /** A point on my face: l toward my left, u up, both from the middle of it. */
  const on = (l: number, u: number, out = 0) => {
    const deep = Math.sqrt(Math.max(0, R * R - l * l - u * u)) + out;
    return project(add(head, add(scale(s.headL, l), add(scale(s.headU, u), scale(s.headF, deep)))));
  };
  /** Whether that point is on the side of my head the camera can see. */
  const seen = (l: number, u: number) => {
    const deep = Math.sqrt(Math.max(0, R * R - l * l - u * u));
    return (dot(s.headL, VIEW) * l + dot(s.headU, VIEW) * u + facing * deep) / R > 0.08;
  };

  // My face is the front of a ball, so from the side it's a sliver with a nose on it.
  const rim = Math.sqrt(R * R - (0.02 * H) ** 2);
  const skin: P2[] = [];
  const fringe: P2[] = [];
  for (const share of [1, 0.72, 0.4]) {
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * TAU;
      const l = Math.cos(t) * rim * share;
      const u = Math.sin(t) * rim * share;
      const p = on(l, u);
      skin.push(p);
      if (u > 0.036 * H) fringe.push(p);
    }
  }
  skin.push(on(0, 0), on(0.006 * H, -0.012 * H, 0.012 * H));
  paint(ctx, st, () => addBlob(ctx, skin), SKIN, 0.012 * H);
  if (fringe.length > 2) {
    ctx.beginPath();
    addBlob(ctx, fringe);
    ctx.fillStyle = HAIR;
    ctx.fill();
  }

  const face = s.face;
  const shadesDown = face.shades < 0.5;
  if (!shadesDown) {
    for (const x of [-1, 1]) {
      const l = x * 0.027 * H;
      if (!seen(l, 0.004 * H)) continue;
      const at = on(l, 0.004 * H);
      if (face.eyes < 0.15) {
        line(ctx, st, [on(l - 0.011 * H, 0.004 * H), on(l, -0.002 * H), on(l + 0.011 * H, 0.004 * H)], st.line * 0.8);
        continue;
      }
      if (face.eyes > 1.12) {
        ctx.beginPath();
        addCircle(ctx, at, 0.019 * H);
        ctx.fillStyle = '#fffdf6';
        ctx.fill();
        ctx.lineWidth = st.line * 0.6;
        ctx.strokeStyle = st.ink;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(at.x, at.y, 0.0105 * H, 0.0105 * H * Math.min(1.15, face.eyes), 0, 0, TAU);
      ctx.fillStyle = st.ink;
      ctx.fill();
      const lift = face.brows * 0.012 * H;
      line(ctx, st, [on(x * 0.014 * H, 0.032 * H + lift * (face.brows < 0 ? -0.6 : 1)), on(x * 0.042 * H, 0.032 * H + lift)], st.line * 0.8);
    }
  }
  line(ctx, st, [on(0.003 * H, 0.004 * H), on(0.008 * H, -0.013 * H, 0.012 * H), on(-0.001 * H, -0.018 * H)], st.line * 0.7);
  if (seen(0, -0.04 * H)) {
    if (face.mouth > 0.12) {
      const at = on(0, -0.04 * H);
      ctx.beginPath();
      ctx.ellipse(at.x, at.y, (0.012 + 0.004 * Math.max(0, face.smile)) * H, Math.max(0.004, face.mouth * 0.018) * H, 0, 0, TAU);
      ctx.fillStyle = '#3a1b14';
      ctx.fill();
      ctx.lineWidth = st.line * 0.6;
      ctx.strokeStyle = st.ink;
      ctx.stroke();
    } else {
      const a = on(-0.018 * H, -0.037 * H + 0.005 * H * face.smile);
      const b = on(0.018 * H, -0.037 * H + 0.005 * H * face.smile);
      const c = on(0, -0.037 * H - 0.008 * H * face.smile);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      ctx.lineCap = 'round';
      ctx.lineWidth = st.line * 0.8;
      ctx.strokeStyle = st.ink;
      ctx.stroke();
    }
  }

  // Sunglasses: over my eyes, or pushed up onto the hood.
  const up = face.shades * 0.072 * H;
  for (const x of [-1, 1]) {
    if (!seen(x * 0.028 * H, 0.005 * H) && up < 0.03 * H) continue;
    const points: P2[] = [];
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * TAU;
      points.push(on(x * 0.029 * H + Math.cos(t) * 0.024 * H, 0.005 * H + up + Math.sin(t) * 0.018 * H, 0.005 * H));
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = st.ink;
    ctx.fill();
    line(ctx, st, [on(x * 0.038 * H, 0.013 * H + up, 0.006 * H), on(x * 0.027 * H, 0.015 * H + up, 0.006 * H)], st.line * 0.6, '#ffffff99');
  }
  line(ctx, st, [on(-0.008 * H, 0.008 * H + up, 0.006 * H), on(0.008 * H, 0.008 * H + up, 0.006 * H)], st.line);
}

/**
 * Draw me. `outline`: instead, fill my whole shape with one colour and a margin this wide around
 * it, for marking which ground I'm lying on.
 */
export function drawFigure(ctx: CanvasRenderingContext2D, s: Skeleton, outline?: { color: string; margin: number }) {
  const H = s.height;
  const st: Style = outline
    ? { ink: outline.color, line: outline.margin, flat: true }
    : { ink: INK, line: Math.max(1.15, H * 0.0105), flat: false };

  const chestFacing = dot(s.chestF, VIEW);
  const hipFacing = dot(s.F, VIEW);
  const torsoNear = nearness(mix3(s.pelvis, s.chest, 0.5));
  const headNear = nearness(s.head);

  // A leg goes over the hoodie only when its knee comes out toward the camera, as when sitting.
  const legOver = s.legs.map((leg) => {
    const out = dot(sub(leg.knee, leg.hip), s.F);
    return (out > 0.09 * H && hipFacing > 0.15) || (out < -0.09 * H && hipFacing < -0.15);
  });
  const legOrder = nearness(s.legs[0].knee) < nearness(s.legs[1].knee) ? [0, 1] : [1, 0];

  // An arm goes behind the body when it's on the far side of it, or tucked behind my back.
  const armBehind = s.arms.map((arm, i) => {
    const side = i === 0 ? 1 : -1;
    const farSide = dot(s.chestL, VIEW) * side < -0.3;
    const tucked = dot(sub(arm.wrist, s.chest), s.chestF) * Math.sign(chestFacing || 1) < -0.07 * H && Math.abs(chestFacing) > 0.2;
    return farSide || tucked;
  });
  const armNear = s.arms.map((arm) => Math.max(nearness(arm.elbow), nearness(arm.wrist)));
  const armOrder = armNear[0] < armNear[1] ? [0, 1] : [1, 0];
  const armOverHead = s.arms.map((_, i) => !armBehind[i] && armNear[i] > headNear + 0.02 * H);

  const bagBehind = nearness(bagCenter(s)) < torsoNear - 0.05 * H;

  for (const i of armOrder) if (armBehind[i]) drawArm(ctx, st, s, i);
  if (bagBehind) drawBag(ctx, st, s);
  for (const i of legOrder) if (!legOver[i]) drawLeg(ctx, st, s, i);
  drawTorso(ctx, st, s);
  for (const i of legOrder) if (legOver[i]) drawLeg(ctx, st, s, i);
  if (!bagBehind) drawBag(ctx, st, s);
  for (const i of armOrder) if (!armBehind[i] && !armOverHead[i]) drawArm(ctx, st, s, i);
  drawHead(ctx, st, s);
  for (const i of armOrder) if (armOverHead[i]) drawArm(ctx, st, s, i);
}

/** My shadow on the ground: the same body, flattened away from the light. */
export function drawShadow(ctx: CanvasRenderingContext2D, s: Skeleton) {
  const H = s.height;
  const cast = (p: V3): P2 => ({ x: p.x - 0.5 * p.z, y: p.y + 0.34 * p.z });
  ctx.fillStyle = '#000';
  ctx.beginPath();
  addCapsule(ctx, { a: cast(s.pelvis), b: cast(s.chest), ra: 0.12 * H, rb: 0.13 * H });
  addCircle(ctx, cast(s.head), 0.09 * H);
  for (const arm of s.arms) {
    addCapsule(ctx, { a: cast(arm.shoulder), b: cast(arm.elbow), ra: 0.04 * H, rb: 0.035 * H });
    addCapsule(ctx, { a: cast(arm.elbow), b: cast(arm.tip), ra: 0.035 * H, rb: 0.025 * H });
  }
  for (const leg of s.legs) {
    addCapsule(ctx, { a: cast(leg.hip), b: cast(leg.knee), ra: 0.055 * H, rb: 0.045 * H });
    addCapsule(ctx, { a: cast(leg.knee), b: cast(leg.ankle), ra: 0.045 * H, rb: 0.04 * H });
    addCapsule(ctx, { a: cast(leg.ankle), b: cast(leg.toe), ra: 0.04 * H, rb: 0.034 * H });
  }
  ctx.fill();
}

/** The box around me on screen, measured from where I am on the ground. */
export function bounds(s: Skeleton) {
  const H = s.height;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const take = (p: V3, r: number) => {
    const q = project(p);
    left = Math.min(left, q.x - r);
    right = Math.max(right, q.x + r);
    top = Math.min(top, q.y - r);
    bottom = Math.max(bottom, q.y + r);
  };
  take(s.head, 0.095 * H);
  take(s.pelvis, 0.13 * H);
  take(s.chest, 0.14 * H);
  for (const arm of s.arms) {
    take(arm.elbow, 0.04 * H);
    take(arm.tip, 0.03 * H);
  }
  for (const leg of s.legs) {
    take(leg.knee, 0.05 * H);
    take(leg.toe, 0.045 * H);
  }
  return { left, right, top, bottom };
}
