// Grow the grass photo into a larger seamless landscape by image quilting
// (Efros & Freeman, "Image Quilting for Texture Synthesis and Transfer", SIGGRAPH 2001).
//
//   npm run world                     (tools/source/photo.jpg → public/grass/world.jpg)
//   tsx tools/make-world.ts <photo> <out> [seed]
//
// Patches are only translated, never flipped or rotated, so the fur keeps running the same
// way and the light keeps coming from the same side everywhere in the world.

import sharp from 'sharp';

const [input = 'tools/source/photo.jpg', output = 'public/grass/world.jpg', seedArg = '8'] = process.argv.slice(2);

const WORLD_W = 2100;
const WORLD_H = 1200;
const PATCH = Number(process.env.PATCH ?? 300); // about a ridge; the photo is too narrow for much larger
const OVERLAP = Number(process.env.OVERLAP ?? 120);
const STEP = PATCH - OVERLAP;
const MATCH_SCALE = 4; // candidates are compared at 1/4 resolution
const STRIDE = 8; // px between candidate source positions
const TOLERANCE = 1.2; // pick randomly among candidates within this factor of the best
const FEATHER = 3; // px of blending across a seam, for the fine fur detail
const LIGHT_BAND = 26; // px of blending across a seam, for the broad lighting

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
const rand = mulberry32(Number(seedArg));

const { data: srcBuf, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const src = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) src[i * 3 + c] = srcBuf[i * info.channels + c];

// ---- 1/4-resolution copies for matching ----
const SW = Math.floor(W / MATCH_SCALE);
const SH = Math.floor(H / MATCH_SCALE);
const srcSmall = new Float32Array(SW * SH * 3);
for (let y = 0; y < SH * MATCH_SCALE; y++) {
  for (let x = 0; x < SW * MATCH_SCALE; x++) {
    const d = (Math.floor(y / MATCH_SCALE) * SW + Math.floor(x / MATCH_SCALE)) * 3;
    const s = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) srcSmall[d + c] += src[s + c] / (MATCH_SCALE * MATCH_SCALE);
  }
}
const GW = Math.ceil(WORLD_W / MATCH_SCALE);
const GH = Math.ceil(WORLD_H / MATCH_SCALE);
const worldSmall = new Float32Array(GW * GH * 3);
const world = new Float32Array(WORLD_W * WORLD_H * 3);
const covered = new Uint8Array(WORLD_W * WORLD_H);

// How often each source area was used, so the world doesn't keep repeating its best patch.
const useW = Math.floor((W - PATCH) / STRIDE) + 1;
const useH = Math.floor((H - PATCH) / STRIDE) + 1;
const usage = new Float32Array(useW * useH);

const q = MATCH_SCALE;
const P = Math.floor(PATCH / q);
const O = Math.floor(OVERLAP / q);

function overlapCost(sx: number, sy: number, px: number, py: number, hasLeft: boolean, hasTop: boolean) {
  const ssx = Math.floor(sx / q);
  const ssy = Math.floor(sy / q);
  const gx = Math.floor(px / q);
  const gy = Math.floor(py / q);
  let cost = 0;
  let n = 0;
  for (let y = 0; y < P; y++) {
    if (gy + y >= GH) break;
    for (let x = 0; x < P; x++) {
      if (gx + x >= GW) break;
      if (!((hasLeft && x < O) || (hasTop && y < O))) continue;
      const a = ((ssy + y) * SW + ssx + x) * 3;
      const b = ((gy + y) * GW + gx + x) * 3;
      for (let c = 0; c < 3; c++) {
        const d = srcSmall[a + c] - worldSmall[b + c];
        cost += d * d;
      }
      n++;
    }
  }
  return n ? cost / n : 0;
}

/** Cheapest top-to-bottom path through an error surface (rows × cols). */
function minSeam(err: Float32Array, rows: number, cols: number) {
  const cum = new Float32Array(err);
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let best = cum[(r - 1) * cols + c];
      if (c > 0) best = Math.min(best, cum[(r - 1) * cols + c - 1]);
      if (c < cols - 1) best = Math.min(best, cum[(r - 1) * cols + c + 1]);
      cum[r * cols + c] += best;
    }
  }
  const path = new Int32Array(rows);
  let c = 0;
  for (let i = 1; i < cols; i++) if (cum[(rows - 1) * cols + i] < cum[(rows - 1) * cols + c]) c = i;
  path[rows - 1] = c;
  for (let r = rows - 2; r >= 0; r--) {
    let bestC = c;
    let best = cum[r * cols + c];
    if (c > 0 && cum[r * cols + c - 1] < best) (best = cum[r * cols + c - 1]), (bestC = c - 1);
    if (c < cols - 1 && cum[r * cols + c + 1] < best) (best = cum[r * cols + c + 1]), (bestC = c + 1);
    path[r] = c = bestC;
  }
  return path;
}

function boxBlur(a: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(a.length);
  const out = new Float32Array(a.length);
  const norm = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[y * w + Math.min(w - 1, Math.max(0, x + i))];
      tmp[y * w + x] = s / norm;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
      out[y * w + x] = s / norm;
    }
  }
  return out;
}

const cols = Math.ceil((WORLD_W - OVERLAP) / STEP);
const rows = Math.ceil((WORLD_H - OVERLAP) / STEP);
console.log(`world ${WORLD_W}×${WORLD_H}: ${cols}×${rows} patches of ${PATCH} px`);

for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const px = col * STEP;
    const py = row * STEP;
    const hasLeft = col > 0;
    const hasTop = row > 0;

    // ---- choose a source patch ----
    let sx = 0;
    let sy = 0;
    if (!hasLeft && !hasTop) {
      sx = Math.floor(rand() * useW) * STRIDE;
      sy = Math.floor(rand() * useH) * STRIDE;
    } else {
      const costs: { x: number; y: number; c: number }[] = [];
      let best = Infinity;
      for (let j = 0; j < useH; j++) {
        for (let i = 0; i < useW; i++) {
          const c = overlapCost(i * STRIDE, j * STRIDE, px, py, hasLeft, hasTop) * (1 + 0.5 * usage[j * useW + i]);
          costs.push({ x: i, y: j, c });
          if (c < best) best = c;
        }
      }
      const good = costs.filter((k) => k.c <= best * TOLERANCE + 1);
      const pick = good[Math.floor(rand() * good.length)];
      sx = pick.x * STRIDE;
      sy = pick.y * STRIDE;
    }
    const ui = sx / STRIDE;
    const uj = sy / STRIDE;
    for (let j = Math.max(0, uj - 6); j <= Math.min(useH - 1, uj + 6); j++) {
      for (let i = Math.max(0, ui - 6); i <= Math.min(useW - 1, ui + 6); i++) usage[j * useW + i] += 1;
    }

    // ---- cut the patch along the cheapest seams ----
    const w = Math.min(PATCH, WORLD_W - px);
    const h = Math.min(PATCH, WORLD_H - py);
    const alpha = new Float32Array(w * h).fill(1);
    // Keep seams away from the rim of the overlap, where they would read as straight block edges.
    const edgeCost = (i: number) => 12000 * Math.abs((2 * i) / (OVERLAP - 1) - 1) ** 6;
    const pixelError = (x: number, y: number) => {
      const a = ((sy + y) * W + sx + x) * 3;
      const b = ((py + y) * WORLD_W + px + x) * 3;
      let e = 0;
      for (let c = 0; c < 3; c++) {
        const d = src[a + c] - world[b + c];
        e += d * d;
      }
      return e;
    };
    if (hasLeft) {
      const err = new Float32Array(h * OVERLAP);
      for (let y = 0; y < h; y++) for (let x = 0; x < OVERLAP; x++) err[y * OVERLAP + x] = pixelError(x, y) + edgeCost(x);
      const seam = minSeam(err, h, OVERLAP);
      for (let y = 0; y < h; y++) for (let x = 0; x < seam[y]; x++) alpha[y * w + x] = 0;
    }
    if (hasTop) {
      const err = new Float32Array(w * OVERLAP);
      for (let x = 0; x < w; x++) for (let y = 0; y < OVERLAP; y++) err[x * OVERLAP + y] = pixelError(x, y) + edgeCost(y);
      const seam = minSeam(err, w, OVERLAP);
      for (let x = 0; x < w; x++) for (let y = 0; y < seam[x]; y++) alpha[y * w + x] = 0;
    }
    const fine = hasLeft || hasTop ? boxBlur(alpha, w, h, FEATHER) : alpha;
    const broad = hasLeft || hasTop ? boxBlur(boxBlur(alpha, w, h, LIGHT_BAND >> 1), w, h, LIGHT_BAND >> 1) : alpha;

    // ---- paste in two bands: broad lighting blends wide, fine fur stays on the seam ----
    // Where nothing has been placed yet, "old" is just the patch itself.
    const oldLayer = new Float32Array(w * h * 3);
    const newLayer = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = ((sy + y) * W + sx + x) * 3;
        const b = ((py + y) * WORLD_W + px + x) * 3;
        const isCovered = covered[(py + y) * WORLD_W + px + x] === 1;
        for (let c = 0; c < 3; c++) {
          newLayer[(y * w + x) * 3 + c] = src[a + c];
          oldLayer[(y * w + x) * 3 + c] = isCovered ? world[b + c] : src[a + c];
        }
      }
    }
    const lowPass = (layer: Float32Array) => {
      const out = new Float32Array(layer.length);
      const r = LIGHT_BAND >> 1;
      for (let c = 0; c < 3; c++) {
        const channel = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) channel[i] = layer[i * 3 + c];
        const low = boxBlur(boxBlur(channel, w, h, r), w, h, r);
        for (let i = 0; i < w * h; i++) out[i * 3 + c] = low[i];
      }
      return out;
    };
    const oldLow = lowPass(oldLayer);
    const newLow = lowPass(newLayer);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const b = ((py + y) * WORLD_W + px + x) * 3;
        for (let c = 0; c < 3; c++) {
          const o = oldLayer[i * 3 + c];
          const n = newLayer[i * 3 + c];
          const low = oldLow[i * 3 + c] * (1 - broad[i]) + newLow[i * 3 + c] * broad[i];
          const high = (o - oldLow[i * 3 + c]) * (1 - fine[i]) + (n - newLow[i * 3 + c]) * fine[i];
          world[b + c] = low + high;
        }
        covered[(py + y) * WORLD_W + px + x] = 1;
      }
    }

    // ---- refresh the low-res copy under this patch ----
    for (let gy = Math.floor(py / q); gy < Math.min(GH, Math.ceil((py + h) / q)); gy++) {
      for (let gx = Math.floor(px / q); gx < Math.min(GW, Math.ceil((px + w) / q)); gx++) {
        const acc = [0, 0, 0];
        let n = 0;
        for (let y = gy * q; y < Math.min(WORLD_H, (gy + 1) * q); y++) {
          for (let x = gx * q; x < Math.min(WORLD_W, (gx + 1) * q); x++) {
            const b = (y * WORLD_W + x) * 3;
            for (let c = 0; c < 3; c++) acc[c] += world[b + c];
            n++;
          }
        }
        for (let c = 0; c < 3; c++) worldSmall[(gy * GW + gx) * 3 + c] = acc[c] / n;
      }
    }
  }
  console.log(`row ${row + 1}/${rows}`);
}

const out = Buffer.alloc(WORLD_W * WORLD_H * 3);
for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(world[i])));
await sharp(out, { raw: { width: WORLD_W, height: WORLD_H, channels: 3 } })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(output);
console.log(`wrote ${output}`);
