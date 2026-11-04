// Bake the grass world into ~245k long blades, grouped into tufts and clumps.
//
//   npm run bake                      (world.jpg → public/grass/blades.bin + meta.json)
//   tsx tools/bake-blades.ts <image> <outDir>
//
// All directions are in y-up image space (angle measured counter-clockwise from +x),
// which matches how WebGL samples a texture loaded with flipY.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ATTR_COMPONENTS, LEN_MAX, ROOT_COMPONENTS, TUFT_REACH, WIDTH_MAX, type BladeMeta } from '../src/bladeFormat';

const [input = 'public/grass/world.jpg', outDir = 'public/grass'] = process.argv.slice(2);

const SPACING = 3.2; // one blade per 3.2×3.2 px → 656×375 = 246,000 for the 2100×1200 world
const PRIOR_DEG = 54; // measured dominant fur direction (up and to the right)
const LEN_DARK = 26; // image px, length of the darkest blades
const LEN_BRIGHT = 60; // image px, length of the brightest blades
const TUFT_SIZE = 32; // image px across a tuft, measured across the fur
const CLUMP_SIZE = 170; // image px across a clump of tufts
const GROUP_STRETCH = 1.9; // groups are elongated along the fur, like leaning grass
const WIDTH_MIN = 1.8;
const WIDTH_MAX_PX = 2.6;
const SEED = 20261103;

// ---------- helpers ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const q16 = (v: number) => Math.round(clamp01(v) * 65535);
const q8 = (v: number) => Math.round(clamp01(v) * 255);

/** Separable Gaussian blur with clamp-to-edge. */
function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.ceil(sigma * 3);
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= sum;

  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i;
        acc += src[row + xx] * k[i + r];
      }
      tmp[row + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i;
        acc += tmp[yy * w + x] * k[i + r];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

function hash2(i: number, j: number, salt: number) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const furAngle = (PRIOR_DEG * Math.PI) / 180;
const furX = Math.cos(furAngle);
const furY = Math.sin(furAngle);

/**
 * Nearest cell of a jittered grid laid along the fur (a Voronoi diagram), so plants fall into
 * irregular groups stretched the way the grass leans. Coordinates are y-up image px.
 */
function nearestGroup(x: number, y: number, size: number, salt: number) {
  const a = (x * furX + y * furY) / GROUP_STRETCH;
  const b = -x * furY + y * furX;
  const ca = Math.floor(a / size);
  const cb = Math.floor(b / size);
  let best = Infinity;
  let cellA = ca;
  let cellB = cb;
  let centerA = 0;
  let centerB = 0;
  for (let i = ca - 1; i <= ca + 1; i++) {
    for (let j = cb - 1; j <= cb + 1; j++) {
      const pa = (i + 0.15 + 0.7 * hash2(i, j, salt)) * size;
      const pb = (j + 0.15 + 0.7 * hash2(i, j, salt + 1)) * size;
      const d = (pa - a) ** 2 + (pb - b) ** 2;
      if (d < best) {
        best = d;
        cellA = i;
        cellB = j;
        centerA = pa;
        centerB = pb;
      }
    }
  }
  const stretched = centerA * GROUP_STRETCH;
  return {
    seed: hash2(cellA, cellB, salt + 2),
    x: stretched * furX - centerB * furY,
    y: stretched * furY + centerB * furX,
  };
}

// ---------- load ----------

const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const C = info.channels;
const N_PX = W * H;
console.log(`photo ${W}×${H}`);

// Luminance on the sRGB-encoded values (row 0 = top of the photo).
const lum = new Float32Array(N_PX);
for (let i = 0; i < N_PX; i++) {
  lum[i] = (0.2126 * data[i * C] + 0.7152 * data[i * C + 1] + 0.0722 * data[i * C + 2]) / 255;
}

// Histogram → CDF, used to equalize brightness (the photo is mostly dark: median ≈ 0.27).
const hist = new Float64Array(256);
for (let i = 0; i < N_PX; i++) hist[Math.min(255, Math.floor(lum[i] * 256))]++;
const lumCdf: number[] = [];
let acc = 0;
for (let i = 0; i < 256; i++) {
  acc += hist[i];
  lumCdf.push(+(acc / N_PX).toFixed(5));
}
const equalize = (l: number) => lumCdf[Math.min(255, Math.floor(l * 256))];

// The photo's average color at each brightness. Relit blades take their color from this, so
// shadows and highlights keep the photo's real palette.
const rampSum = new Float64Array(256 * 3);
for (let i = 0; i < N_PX; i++) {
  const bin = Math.min(255, Math.floor(lum[i] * 256));
  for (let c = 0; c < 3; c++) rampSum[bin * 3 + c] += data[i * C + c] / 255;
}
const lumRamp: number[] = [];
let lastColor = [0.02, 0.04, 0.02];
for (let bin = 0; bin < 256; bin++) {
  // Bins the photo never reaches continue from the last color, scaled to the target brightness.
  const n = hist[bin];
  const luma = (bin + 0.5) / 256;
  const raw = n >= 8 ? [0, 1, 2].map((c) => rampSum[bin * 3 + c] / n) : lastColor;
  const rawLuma = Math.max(1e-4, 0.2126 * raw[0] + 0.7152 * raw[1] + 0.0722 * raw[2]);
  const color = raw.map((v) => Math.min(1, (v * luma) / rawLuma));
  lastColor = color;
  lumRamp.push(...color.map((v) => +v.toFixed(4)));
}

const lumSmooth = blur(lum, W, H, 1);
const ridgeRaw = blur(lum, W, H, 25);
let rMin = Infinity;
let rMax = -Infinity;
for (let i = 0; i < N_PX; i++) {
  rMin = Math.min(rMin, ridgeRaw[i]);
  rMax = Math.max(rMax, ridgeRaw[i]);
}

// ---------- structure tensor (fur orientation) ----------

const gx = new Float32Array(N_PX);
const gy = new Float32Array(N_PX); // y-up: positive when brighter above
const at = (x: number, y: number) =>
  lum[(y < 0 ? 0 : y >= H ? H - 1 : y) * W + (x < 0 ? 0 : x >= W ? W - 1 : x)];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    gx[i] =
      at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
      (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    gy[i] =
      at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
      (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
  }
}
const jxx0 = new Float32Array(N_PX);
const jyy0 = new Float32Array(N_PX);
const jxy0 = new Float32Array(N_PX);
for (let i = 0; i < N_PX; i++) {
  jxx0[i] = gx[i] * gx[i];
  jyy0[i] = gy[i] * gy[i];
  jxy0[i] = gx[i] * gy[i];
}
// Fine scale carries the local strand detail; the coarse scale fills in where the fine
// tensor is weak (flat shadows), so dark areas don't turn into random scribble.
const jxxF = blur(jxx0, W, H, 2);
const jyyF = blur(jyy0, W, H, 2);
const jxyF = blur(jxy0, W, H, 2);
const jxxC = blur(jxx0, W, H, 8);
const jyyC = blur(jyy0, W, H, 8);
const jxyC = blur(jxy0, W, H, 8);

const prior = [Math.cos((PRIOR_DEG * Math.PI) / 180), Math.sin((PRIOR_DEG * Math.PI) / 180)];

// ---------- blades ----------

const rand = mulberry32(SEED);
const nx = Math.floor(W / SPACING);
const ny = Math.floor(H / SPACING);
const count = nx * ny;

interface Blade {
  u: number;
  v: number;
  angle: number;
  len: number;
  width: number;
  lumEq: number;
  coh: number;
  ridge: number;
  seed: number;
  seed2: number;
  tuftSeed: number;
  clumpSeed: number;
  tuftDx: number;
  tuftDy: number;
}
const blades: Blade[] = new Array(count);
let cohSum = 0;
let k = 0;
for (let j = 0; j < ny; j++) {
  for (let i = 0; i < nx; i++) {
    const x = (i + rand()) * SPACING; // continuous px, row-down
    const yRow = (j + rand()) * SPACING;
    const px = Math.min(W - 1, Math.floor(x));
    const py = Math.min(H - 1, Math.floor(yRow));
    const p = py * W + px;

    const jxx = jxxF[p] + 0.35 * jxxC[p];
    const jyy = jyyF[p] + 0.35 * jyyC[p];
    const jxy = jxyF[p] + 0.35 * jxyC[p];
    const gradAngle = 0.5 * Math.atan2(2 * jxy, jxx - jyy);
    let angle = gradAngle + Math.PI / 2; // strands run perpendicular to the gradient
    if (Math.cos(angle) * prior[0] + Math.sin(angle) * prior[1] < 0) angle += Math.PI;
    angle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    const tr = jxxF[p] + jyyF[p];
    const coh = tr > 1e-8 ? Math.sqrt((jxxF[p] - jyyF[p]) ** 2 + 4 * jxyF[p] ** 2) / tr : 0;
    cohSum += coh;

    const lumEq = equalize(lumSmooth[p]);
    const yUp = H - yRow;
    const tuft = nearestGroup(x, yUp, TUFT_SIZE, 101);
    const clump = nearestGroup(x, yUp, CLUMP_SIZE, 202);
    // Plants keep persistent differences: tufts have their own height, blades vary around it.
    const tuftHeight = 0.82 + 0.36 * tuft.seed;
    const len = (LEN_DARK + (LEN_BRIGHT - LEN_DARK) * lumEq) * tuftHeight * (0.85 + 0.3 * rand());
    const width = WIDTH_MIN + (WIDTH_MAX_PX - WIDTH_MIN) * rand();

    blades[k++] = {
      u: x / W,
      v: 1 - yRow / H,
      angle,
      len,
      width,
      lumEq,
      coh,
      ridge: (ridgeRaw[p] - rMin) / (rMax - rMin),
      seed: rand(),
      seed2: rand(),
      tuftSeed: tuft.seed,
      clumpSeed: clump.seed,
      tuftDx: tuft.x - x,
      tuftDy: tuft.y - yUp,
    };
  }
}

// Dark first, bright last: instanced draws blend in order, so bright tips land on top.
blades.sort((a, b) => a.lumEq - b.lumEq);

const roots = new Uint16Array(count * ROOT_COMPONENTS);
const attrs = new Uint8Array(count * ATTR_COMPONENTS);
for (let b = 0; b < count; b++) {
  const s = blades[b];
  roots[b * 2] = q16(s.u);
  roots[b * 2 + 1] = q16(s.v);
  const o = b * ATTR_COMPONENTS;
  attrs[o + 0] = q8(s.angle / (2 * Math.PI));
  attrs[o + 1] = q8(s.len / LEN_MAX);
  attrs[o + 2] = q8(s.width / WIDTH_MAX);
  attrs[o + 3] = q8(s.tuftSeed);
  attrs[o + 4] = q8(s.coh);
  attrs[o + 5] = q8(s.ridge);
  attrs[o + 6] = q8(s.seed);
  attrs[o + 7] = q8(s.seed2);
  attrs[o + 8] = q8((s.tuftDx / TUFT_REACH + 1) / 2);
  attrs[o + 9] = q8((s.tuftDy / TUFT_REACH + 1) / 2);
  attrs[o + 10] = q8(s.clumpSeed);
}

const meta: BladeMeta = {
  version: 3,
  count,
  imageWidth: W,
  imageHeight: H,
  spacing: SPACING,
  lenMax: LEN_MAX,
  widthMax: WIDTH_MAX,
  tuftReach: TUFT_REACH,
  priorAngleDeg: PRIOR_DEG,
  lumCdf,
  lumRamp,
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'blades.bin'), Buffer.concat([Buffer.from(roots.buffer), Buffer.from(attrs.buffer)]));
await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta));

// Circular mean of the baked directions, as a sanity check against the measured −54° (y-down).
let cx = 0;
let cy = 0;
for (const s of blades) {
  cx += Math.cos(s.angle);
  cy += Math.sin(s.angle);
}
console.log(
  `${count} blades → ${path.join(outDir, 'blades.bin')} (${((roots.byteLength + attrs.byteLength) / 1e6).toFixed(2)} MB)\n` +
    `mean direction ${((Math.atan2(cy, cx) * 180) / Math.PI).toFixed(1)}° (y-up), ` +
    `mean coherence ${(cohSum / count).toFixed(2)}`,
);
