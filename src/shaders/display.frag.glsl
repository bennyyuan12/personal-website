// Final pass: the ASCII layer over the grass, plus debug views.

precision highp float;

uniform sampler2D uColor;      // blade pass color
uniform sampler2D uDir;        // blade pass direction
uniform sampler2D uPhoto;
uniform sampler2D uField;
uniform sampler2D uCellColor;  // per cell: average rgb, luminance
uniform sampler2D uCellDir;    // per cell: screen-space direction, coherence
uniform sampler2D uAtlas;      // glyph SDFs, one square tile per glyph, upright
uniform sampler2D uCdf;        // photo luminance CDF (equalization)
uniform mat3 uClipToUV;
uniform int uView;             // 0 ascii, 1 blades, 2 photo, 3 split, 4 direction, 5 field
uniform float uSplit;
uniform vec2 uResolution;      // device px
uniform vec2 uViewportCss;     // CSS px

uniform float uCell;           // CSS px
uniform float uGlyphCount;
uniform float uAtlasLod;
uniform float uAA;             // SDF units per device px (half the edge ramp)
uniform float uThin;           // SDF edge for the darkest cells (higher = thinner)
uniform float uBold;           // SDF edge for the brightest cells (lower = bolder)
uniform float uDither;
uniform float uBlend;
uniform float uGain;
uniform float uLift;
uniform float uUnderlay;
uniform float uGlow;
uniform vec3 uBg;

in vec2 vUv;
in vec2 vClip;
out vec4 outColor;

const float PI = 3.14159265359;

vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float glyphSdf(float index, vec2 local) {
  if (abs(local.x) > 0.5 || abs(local.y) > 0.5) return 0.0;
  vec2 uv = vec2((index + local.x + 0.5) / uGlyphCount, local.y + 0.5);
  return textureLod(uAtlas, uv, uAtlasLod).r;
}

vec3 ascii(vec2 uv, vec3 grass) {
  vec2 px = uv * uViewportCss;
  vec2 cell = floor(px / uCell);
  vec2 local = fract(px / uCell) - 0.5;
  vec4 cc = texelFetch(uCellColor, ivec2(cell), 0);
  vec4 cd = texelFetch(uCellDir, ivec2(cell), 0);

  // Glyphs are authored upright; turn each one to follow the blades in its cell.
  float a = atan(cd.y, cd.x) - 0.5 * PI;
  float ca = cos(a);
  float sa = sin(a);
  local = vec2(ca * local.x + sa * local.y, -sa * local.x + ca * local.y);

  // Equalized brightness picks the glyph (dots in shadow, strokes in light) and its weight.
  float lumEq = texture(uCdf, vec2(cc.a * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).r;
  float level = clamp(lumEq * (uGlyphCount - 1.0) + (hash12(cell) - 0.5) * uDither, 0.0, uGlyphCount - 1.0);
  float i0 = floor(level);
  float i1 = min(i0 + 1.0, uGlyphCount - 1.0);
  float f = level - i0;
  float k = uBlend < 0.01 ? step(0.5, f) : smoothstep(0.5 - 0.5 * uBlend, 0.5 + 0.5 * uBlend, f);

  float edge = mix(uThin, uBold, lumEq);
  float s0 = glyphSdf(i0, local);
  float s1 = glyphSdf(i1, local);
  float cover = mix(smoothstep(edge - uAA, edge + uAA, s0), smoothstep(edge - uAA, edge + uAA, s1), k);
  float sdf = mix(s0, s1, k);

  // Ink takes its hue from the cell and its brightness from the equalized luminance, so the
  // mostly-dark photo still spreads across the full range of ink brightness.
  vec3 chroma = clamp(cc.rgb / max(cc.a, 1e-3), 0.0, 2.0);
  vec3 ink = chroma * mix(0.12, uGain, pow(lumEq, uLift));
  vec3 col = mix(mix(uBg, grass, uUnderlay), ink, cover);
  float halo = smoothstep(edge - 0.3, edge, sdf) * (1.0 - cover) * uGlow * lumEq * lumEq;
  return col + ink * halo;
}

void main() {
  vec3 grass = texture(uColor, vUv).rgb;
  vec2 photoUV = (uClipToUV * vec3(vClip, 1.0)).xy;
  vec3 c;
  if (uView == 0) {
    c = ascii(vUv, grass);
  } else if (uView == 1) {
    c = grass;
  } else if (uView == 2) {
    c = texture(uPhoto, photoUV).rgb;
  } else if (uView == 3) {
    c = vUv.x < uSplit ? grass : ascii(vUv, grass);
    float px = abs(vUv.x - uSplit) * uResolution.x;
    c = mix(vec3(1.0), c, smoothstep(0.75, 1.5, px));
  } else if (uView == 4) {
    vec4 d = texture(uDir, vUv);
    vec2 v = d.xy / max(d.w, 1e-4);
    c = hue(atan(v.y, v.x) / (2.0 * PI) + 0.5) * clamp(length(v), 0.0, 1.0);
  } else {
    // Field heading as hue, strength as brightness, over a faint copy of the photo.
    vec2 v = texture(uField, photoUV).rg;
    float s = clamp(length(v), 0.0, 1.0);
    c = mix(texture(uPhoto, photoUV).rgb * 0.25, hue(atan(v.y, v.x) / (2.0 * PI) + 0.5), s);
  }
  outColor = vec4(c, 1.0);
}
