import * as THREE from 'three';
import TinySDF from '@mapbox/tiny-sdf';
import '@fontsource/jetbrains-mono/400.css';

export const GLYPH_FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

/** SDF encoding (tiny-sdf): the glyph edge sits at 1 − CUTOFF; values fall by 1/RADIUS per tile px. */
export const SDF_RADIUS = 10;
export const SDF_CUTOFF = 0.25;

export interface GlyphAtlas {
  texture: THREE.DataTexture;
  count: number;
  /** Tile size in px; glyph i occupies x ∈ [i·tile, (i+1)·tile). */
  tile: number;
  /** Share of each tile covered by ink at the default edge, for ordering the ramp. */
  coverage: number[];
}

/**
 * Render each character of `ramp` into its own square tile as a signed distance field,
 * centered on its ink (not its baseline) so it can be rotated about the cell center.
 * Glyphs are upright: their long strokes run along +y. A space gives an empty tile.
 */
export async function buildGlyphAtlas(ramp: string, tile = 64): Promise<GlyphAtlas> {
  // Make sure the web font is ready before rasterizing (falls back to system mono after 2 s).
  await Promise.race([
    document.fonts.load(`400 48px ${GLYPH_FONT}`, ramp),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);

  const chars = Array.from(ramp);
  const count = chars.length;

  // Size the font so the tallest glyph's ink spans ~74% of a tile.
  const probe = new TinySDF({ fontSize: 100, fontFamily: GLYPH_FONT, buffer: 0, radius: 1, cutoff: SDF_CUTOFF });
  let tallest = 1;
  for (const ch of chars) if (ch.trim()) tallest = Math.max(tallest, probe.draw(ch).glyphHeight);
  const fontSize = Math.max(8, Math.floor((100 * tile * 0.74) / tallest));

  const sdf = new TinySDF({
    fontSize,
    fontFamily: GLYPH_FONT,
    fontWeight: '400',
    buffer: SDF_RADIUS,
    radius: SDF_RADIUS,
    cutoff: SDF_CUTOFF,
  });

  const width = tile * count;
  const data = new Uint8Array(width * tile);
  const coverage: number[] = [];
  const edge = 255 * (1 - SDF_CUTOFF);

  chars.forEach((ch, i) => {
    let inked = 0;
    if (ch.trim()) {
      const g = sdf.draw(ch);
      const ox = Math.round((tile - g.width) / 2);
      const oy = Math.round((tile - g.height) / 2);
      for (let r = 0; r < g.height; r++) {
        const ty = oy + r;
        if (ty < 0 || ty >= tile) continue;
        const dstRow = (tile - 1 - ty) * width + i * tile; // flip: texture v grows upward
        for (let c = 0; c < g.width; c++) {
          const tx = ox + c;
          if (tx < 0 || tx >= tile) continue;
          const v = g.data[r * g.width + c];
          data[dstRow + tx] = v;
          if (v >= edge) inked++;
        }
      }
    }
    coverage.push(inked / (tile * tile));
  });

  const texture = new THREE.DataTexture(data, width, tile, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return { texture, count, tile, coverage };
}
