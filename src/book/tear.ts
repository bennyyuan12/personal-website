// Tearing paper. Given the line something was cut or torn along, make the ragged edge a hand
// leaves: a wandering, jagged line for the picture, and just outside it the white core of the
// paper showing through in patches, the way a torn photo or magazine page looks.
//
// Shapes come in as points in the box (0 to 1 across and down), and go out as CSS polygons. The
// raggedness is worked out in page units so it's the same size whatever the shape of the box, and
// it's seeded by the item, so a torn edge looks the same every time it's drawn.

type Point = [number, number];

function random(seed: string) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const polygon = (points: Point[], w: number, h: number) =>
  `polygon(${points.map(([x, y]) => `${((x / w) * 100).toFixed(2)}% ${((y / h) * 100).toFixed(2)}%`).join(', ')})`;

/** A box's own outline, for tearing the whole of it. */
export const WHOLE: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** The cut itself as a clean line, scissors-sharp. */
export function cutPolygon(points: Point[]) {
  return polygon(points, 1, 1);
}

/**
 * Tear along `outline`, for a box `w` by `h` page units. `fray` is how wide the white edge gets
 * where it shows. `edge` is the picture's own outline; `core` is the paper just outside it.
 */
export function tear(outline: Point[], w: number, h: number, seed: string, fray = 7) {
  const rand = random(seed);
  const at = outline.map(([x, y]): Point => [x * w, y * h]);
  let area = 0;
  for (let i = 0; i < at.length; i++) {
    const [x0, y0] = at[i];
    const [x1, y1] = at[(i + 1) % at.length];
    area += x0 * y1 - x1 * y0;
  }
  const outward = area > 0 ? 1 : -1;

  // Points every few units along the line, keeping its corners.
  let length = 0;
  for (let i = 0; i < at.length; i++) {
    const [x0, y0] = at[i];
    const [x1, y1] = at[(i + 1) % at.length];
    length += Math.hypot(x1 - x0, y1 - y0);
  }
  const step = Math.max(4, length / 600);
  const along: Point[] = [];
  for (let i = 0; i < at.length; i++) {
    const [x0, y0] = at[i];
    const [x1, y1] = at[(i + 1) % at.length];
    const pieces = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 0; j < pieces; j++) along.push([x0 + ((x1 - x0) * j) / pieces, y0 + ((y1 - y0) * j) / pieces]);
  }

  // A tear wanders slowly, jags quickly, and only now and then shows a wide strip of white.
  const [a, b, c, d, e] = Array.from({ length: 5 }, () => rand() * 6.28);
  const n = along.length;
  const edge: Point[] = [];
  const core: Point[] = [];
  let s = 0;
  for (let k = 0; k < n; k++) {
    const [px, py] = along[(k - 2 + n) % n];
    const [nx, ny] = along[(k + 2) % n];
    const [x, y] = along[k];
    if (k > 0) s += Math.hypot(x - along[k - 1][0], y - along[k - 1][1]);
    const tx = nx - px;
    const ty = ny - py;
    const tl = Math.hypot(tx, ty) || 1;
    // Outward from the shape.
    const ox = (outward * ty) / tl;
    const oy = (-outward * tx) / tl;
    const wander = 2.2 * Math.sin(s / 31 + a) + 1.2 * Math.sin(s / 11 + b);
    const jag = (rand() - 0.5) * 3.4;
    const white = fray * Math.max(0, Math.min(1.3, 0.25 + 0.75 * Math.sin(s / 57 + c) + 0.4 * Math.sin(s / 17 + d) + 0.2 * Math.sin(s / 6 + e)));
    // Kept just inside the line, so nothing is lost to the edge of the box.
    const coreOut = -3.6 + 0.5 * wander + jag * 0.6;
    const edgeOut = coreOut - white - 0.6 - rand() * 1.4 + 0.5 * wander;
    core.push([x + ox * coreOut, y + oy * coreOut]);
    edge.push([x + ox * edgeOut, y + oy * edgeOut]);
  }
  return { edge: polygon(edge, w, h), core: polygon(core, w, h) };
}

/** Where a torn scrap of paper sits behind something w by h: how far it reaches out each way, and its tilt. */
export function scrapAround(w: number, h: number, seed: string) {
  const rand = random(`${seed}/scrap`);
  const reach = Math.min(48, 12 + Math.min(w, h) * 0.06);
  const out = () => Math.round(reach * (0.45 + rand() * 0.9));
  const left = out();
  const right = out();
  const top = out();
  const bottom = out();
  const turn = Math.round((rand() - 0.5) * 9 * 10) / 10;
  const sw = w + left + right;
  const sh = h + top + bottom;
  return { left, top, w: sw, h: sh, turn, ...tear(WHOLE, sw, sh, `${seed}/scrap`, 6) };
}

/** Fewer points along a hand-drawn line, so it keeps its shape without thousands of them. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    const [x0, y0] = points[from];
    const [x1, y1] = points[to];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    let far = -1;
    let farthest = tolerance;
    for (let i = from + 1; i < to; i++) {
      const [x, y] = points[i];
      // A loop ends where it began: then it's how far from that point.
      const off = len < 1e-6 ? Math.hypot(x - x0, y - y0) : Math.abs(dy * x - dx * y + x1 * y0 - y1 * x0) / len;
      if (off > farthest) {
        farthest = off;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([from, far], [far, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** The box a cut takes up, in the photo (0 to 1 across and down). */
export function cutBounds(points: Point[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
