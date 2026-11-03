// Shared layout of public/grass/blades.bin, used by the bake script and the renderer.
//
// One blade = BLADE_STRIDE uint16 values, all normalized to 0..1 (value / 65535):
//   0 rootU      root position, image UV, y-up (0 = bottom of photo)
//   1 rootV
//   2 angle      original direction / 2π, y-up, counter-clockwise from +x
//   3 len        blade length / LEN_MAX (image px)
//   4 width      blade width / WIDTH_MAX (image px)
//   5 lumEq      histogram-equalized brightness at the root
//   6 coherence  how strongly the fur lines up locally (structure tensor)
//   7 ridge      large-scale brightness (σ=25 blur), min-max normalized
//   8 seed       random, drives per-blade motion phase
//   9 seed2      random, used for density thinning (quality tiers)
// Blades are sorted from dark to bright so bright tips are drawn on top.

export const BLADE_STRIDE = 10;
export const LEN_MAX = 32;
export const WIDTH_MAX = 4;

export interface BladeMeta {
  version: 1;
  count: number;
  stride: number;
  imageWidth: number;
  imageHeight: number;
  spacing: number;
  lenMax: number;
  widthMax: number;
  /** Dominant fur direction in degrees, y-up. */
  priorAngleDeg: number;
  /** 256-entry cumulative histogram of photo luminance (for equalization). */
  lumCdf: number[];
}
