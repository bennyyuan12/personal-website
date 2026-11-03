// Shared layout of public/grass/blades.bin, used by the bake script and the renderer.
//
// The file is two blocks, both in blade order:
//   roots       count × 2 uint16   rootU, rootV (image UV, y-up: 0 = bottom)
//   attributes  count × 8 uint8    angle, len, width, lumEq, coherence, ridge, seed, seed2
// All values are normalized to 0..1:
//   angle      original direction / 2π, y-up, counter-clockwise from +x
//   len        blade length / LEN_MAX (image px)
//   width      blade width / WIDTH_MAX (image px)
//   lumEq      histogram-equalized brightness at the root
//   coherence  how strongly the fur lines up locally (structure tensor)
//   ridge      large-scale brightness (\u03c3=25 blur), min-max normalized
//   seed       random, drives per-blade motion
//   seed2      random, used for density thinning (quality tiers)
// Blades are sorted from dark to bright so bright tips are drawn on top.

export const ROOT_COMPONENTS = 2;
export const ATTR_COMPONENTS = 8;
export const LEN_MAX = 32;
export const WIDTH_MAX = 4;

export interface BladeMeta {
  version: 2;
  count: number;
  imageWidth: number;
  imageHeight: number;
  spacing: number;
  lenMax: number;
  widthMax: number;
  /** Dominant fur direction in degrees, y-up. */
  priorAngleDeg: number;
  /** 256-entry cumulative histogram of image luminance (for equalization). */
  lumCdf: number[];
}
