// Final pass: the ASCII layer over the grass, plus debug views. The result is premultiplied and
// its alpha is the grass itself, so anything lying in the grass (on the page, below this canvas)
// shows between the blades crossing over it, and sits in the shadow they cast.

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
uniform sampler2D uLight;      // brightness from the wind surface
uniform int uView;             // 0 ascii, 1 blades, 2 photo, 3 split, 4 direction, 5 field, 6 light
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
uniform float uGain;           // ink brightness relative to the grass
uniform float uUnderlay;       // grass brightness under the ink
uniform float uGrain;          // under the ink: 0 one flat color per cell, 1 every blade
uniform float uGroundShade;    // shadow the blades cast on whatever is lying under them
uniform vec2 uLightDir;
uniform float uGlow;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uTint;

in vec2 vUv;
in vec2 vClip;
out vec4 outColor;

const float PI = 3.14159265359;

vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// Color grade: tint and exposure, contrast around a mid pivot, then saturation.
vec3 grade(vec3 c) {
  c *= uTint * uExposure;
  float l = max(dot(c, LUMA), 1e-4);
  float graded = 0.42 * pow(l / 0.42, uContrast);
  c *= graded / l;
  return max(mix(vec3(graded), c, uSaturation), vec3(0.0));
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

vec4 ascii(vec2 uv, vec4 grass) {
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

  // The grass stays bright underneath and the glyphs are a brighter weave on top of it. Blades
  // have true edges, so one crossing a drawing crosses it blade by blade. Letters need most of a
  // cell to be grass, or they would float over what's underneath.
  vec3 blades = grass.rgb / max(grass.a, 1e-3);
  float under = grass.a;
  float inked = cover * smoothstep(0.45, 0.85, cd.a) * grass.a;
  vec3 ink = grade(cc.rgb) * uGain;
  vec3 col = grade(mix(cc.rgb, blades, uGrain)) * uUnderlay * under;
  float halo = smoothstep(edge - 0.3, edge, sdf) * (1.0 - cover) * uGlow * lumEq * lumEq;
  return vec4(mix(col, ink, inked) + ink * halo * under, mix(under, 1.0, inked));
}

// Shadow on what lies under the grass: how much grass stands between this spot and the light. It
// is read from the cells, so it moves with the blades.
float grassShadow(vec2 uv) {
  vec2 cell = uCell / uViewportCss;
  vec2 at = uv + uLightDir * cell * 1.6;
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    sum += texture(uCellDir, at + vec2(cos(a), sin(a)) * cell * 3.0).a;
  }
  return sum / 8.0;
}

void main() {
  vec4 scene = texture(uColor, vUv);
  vec3 grass = scene.rgb / max(scene.a, 1e-3);
  vec2 photoUV = (uClipToUV * vec3(vClip, 1.0)).xy;
  vec4 layer = vec4(0.0);
  vec3 c;
  if (uView == 0) {
    layer = ascii(vUv, scene);
  } else if (uView == 1) {
    layer = vec4(grade(grass) * scene.a, scene.a);
  } else if (uView == 2) {
    c = texture(uPhoto, photoUV).rgb;
  } else if (uView == 3) {
    vec4 a = ascii(vUv, scene);
    c = vUv.x < uSplit ? grade(grass) : a.rgb + (1.0 - a.a) * vec3(0.5);
    float px = abs(vUv.x - uSplit) * uResolution.x;
    c = mix(vec3(1.0), c, smoothstep(0.75, 1.5, px));
  } else if (uView == 4) {
    vec4 d = texture(uDir, vUv);
    vec2 v = d.xy / max(d.w, 1e-4);
    c = hue(atan(v.y, v.x) / (2.0 * PI) + 0.5) * clamp(length(v), 0.0, 1.0);
  } else if (uView == 6) {
    // Wind lighting: grey is unchanged, brighter and darker are the lit and shadowed slopes.
    c = vec3(texture(uLight, photoUV).r * 0.5);
  } else {
    // Field heading as hue, strength as brightness, over a faint copy of the photo.
    vec2 v = texture(uField, photoUV).rg;
    float s = clamp(length(v), 0.0, 1.0);
    c = mix(texture(uPhoto, photoUV).rgb * 0.25, hue(atan(v.y, v.x) / (2.0 * PI) + 0.5), s);
  }
  if (uView > 1) {
    outColor = vec4(c, 1.0);
    return;
  }
  float shade = layer.a > 0.995 ? 0.0 : uGroundShade * grassShadow(vUv);
  outColor = vec4(layer.rgb, layer.a + (1.0 - layer.a) * shade);
}
