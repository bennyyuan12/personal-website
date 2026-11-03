import * as THREE from 'three';

export type Rotation = 0 | 90 | -90;

export interface View {
  /** Image px (y-up) → clip space. */
  imageToClip: THREE.Matrix3;
  /** Clip space → photo UV. */
  clipToUV: THREE.Matrix3;
  /** CSS px per image px. */
  scale: number;
}

/**
 * Cover-fit the photo to the viewport, optionally rotated by 90° so the portrait
 * photo fills a landscape screen.
 */
export function computeView(
  vw: number,
  vh: number,
  iw: number,
  ih: number,
  rotation: Rotation,
  zoom: number,
): View {
  const r = (rotation * Math.PI) / 180;
  const c = Math.round(Math.cos(r) * 1e9) / 1e9;
  const s = Math.round(Math.sin(r) * 1e9) / 1e9;
  const rw = rotation === 0 ? iw : ih;
  const rh = rotation === 0 ? ih : iw;
  const scale = Math.max(vw / rw, vh / rh) * zoom;
  const sx = (2 * scale) / vw;
  const sy = (2 * scale) / vh;
  const cx = iw / 2;
  const cy = ih / 2;

  // clip = S · R · (p − center)
  const imageToClip = new THREE.Matrix3().set(
    sx * c, -sx * s, -sx * (c * cx - s * cy),
    sy * s, sy * c, -sy * (s * cx + c * cy),
    0, 0, 1,
  );
  const clipToUV = new THREE.Matrix3()
    .set(1 / iw, 0, 0, 0, 1 / ih, 0, 0, 0, 1)
    .multiply(imageToClip.clone().invert());
  return { imageToClip, clipToUV, scale };
}
