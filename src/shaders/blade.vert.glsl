precision highp float;

// One long blade, rooted for good. Its shape is worked out from how the grass is lying at its
// root and halfway along, so a blade curves with the sweep it belongs to, the way a long blade
// lies across its neighbors. As in Jahrmann & Wimmer the blade keeps its length: leaning less
// doesn't shorten it, it stands up and is seen end-on from above, so a wave passing against the
// grass lifts it through upright and lays it down the other way.

// Per vertex: x = across the blade (-0.5..0.5), y = t along the blade (0 root .. 1 tip)
in vec3 position;
// Per instance (normalized, see bladeFormat.ts)
in vec2 aRoot; // root position, image UV
in vec4 aA;    // angle/2π (unused), len/LEN_MAX, width/WIDTH_MAX, tuftSeed
in vec4 aB;    // coherence, ridge, seed, seed2
in vec4 aC;    // tuft offset x, tuft offset y, clumpSeed, spare

uniform mat3 uImageToClip;
uniform vec2 uImageSize;
uniform float uLenMax;
uniform float uWidthMax;
uniform float uPhase;      // loop phase 0..1
uniform float uLenScale;
uniform float uWidthScale;
uniform float uMinWidth;   // image px
uniform float uJitter;     // each blade's own sway (radians)
uniform float uDensity;    // fraction of blades drawn (quality tiers)
uniform float uRootShade;
uniform float uSheen;
uniform vec2 uLightDir;
uniform sampler2D uPhoto;
uniform sampler2D uField;  // RG lean of the grass here, BA the same lean a moment ago
uniform sampler2D uLight;  // brightness from that lean (see surface.frag.glsl)
uniform sampler2D uShapes; // R: 1 where something is lying on the grass
uniform float uTuftReach;  // image px: scale of the tuft offset
uniform float uTuftMix;    // 0: each blade feels its own spot; 1: the whole tuft feels one spot
uniform float uTuftGain;   // how much tufts differ in how far they give
uniform float uTuftLag;    // how much tufts differ in timing
uniform float uClumpGain;  // the same for larger clumps
uniform float uClumpLag;
uniform float uFlutter;    // each blade's own motion, stronger when it's being blown
uniform float uTuftSpread; // how far tufts splay from each other (radians)
uniform float uTuftPull;   // how far blade tips draw in toward the middle of their tuft
uniform float uTuftDepth;  // how much a tuft's outer blades fall into shadow against its center
uniform float uBladeTone;  // how much individual blades and tufts differ in tone
uniform float uBaked;      // how much of the photo's broad light is kept

out float vX;
out float vT;
out float vShade;
out vec2 vDir;

const float TAU = 6.28318530718;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float MID_GREY = 0.3; // the photo's typical brightness

vec2 dir(float a) { return vec2(cos(a), sin(a)); }
vec2 perp(vec2 d) { return vec2(-d.y, d.x); }
vec2 turn(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

void cull() {
  vX = 0.0;
  vT = 0.0;
  vShade = 0.0;
  vDir = vec2(0.0);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside the clip volume
}

/** The lean to use at a point: a blade feels it a little late or early, as far as its tuft gives. */
vec2 leanAt(vec2 uv, float late, float give, float splay) {
  vec4 f = texture(uField, uv);
  vec2 lean = turn(mix(f.rg, f.ba, late), splay) * give;
  float size = length(lean);
  return size > 1.0 ? lean / size : lean;
}

void main() {
  // Whatever is lying here is lying on these blades, pressed flat underneath it for good.
  if (aB.w > uDensity || texture(uShapes, aRoot).r > 0.5) {
    cull();
    return;
  }

  float x = position.x;
  float t = position.y;
  vX = x;
  vT = t;
  vec2 root = aRoot * uImageSize;
  float seed = aB.z;
  float tuftSeed = aA.w;
  float clumpSeed = aC.z;
  float L = aA.y * uLenMax * uLenScale;
  // Thinned-out blades (lower quality tiers) are drawn wider to keep the same coverage.
  float w = max(aA.z * uWidthMax * uWidthScale, uMinWidth) * inversesqrt(max(uDensity, 0.05));

  // ---- Wind: rooted plants, moving in groups ----
  // Blades of a tuft read the wind at one shared spot, so they respond as a group, and tufts and
  // clumps keep persistent differences in timing and give. Each blade's own motion is on top:
  // integer frequency k keeps it periodic in uPhase.
  vec2 tuftOffset = (aC.xy * 2.0 - 1.0) * uTuftReach;
  vec2 windUV = mix(aRoot, aRoot + tuftOffset / uImageSize, uTuftMix);
  float late = clamp(uTuftLag * tuftSeed + uClumpLag * clumpSeed + 0.1 * seed, 0.0, 1.0);
  float give = 1.0 + uTuftGain * (tuftSeed - 0.5) * 2.0 + uClumpGain * (clumpSeed - 0.5) * 2.0;
  float k = 16.0 + floor(fract(seed * 13.731) * 18.0);
  float splay = uTuftSpread * ((tuftSeed - 0.5) * 2.0 + 0.45 * (seed - 0.5) * 2.0)
              + uJitter * sin(TAU * (k * uPhase + seed));

  // ---- Shape: two steps along the lie of the grass, then a curve through them ----
  vec2 lean = leanAt(windUV, late, give, splay);
  vec2 mid = lean * L * 0.5;
  vec2 far = leanAt(windUV + mid / uImageSize, min(late + 0.25, 1.0), give, splay * 1.3);
  far = turn(far, uFlutter * length(lean) * sin(TAU * (k * uPhase + seed * 7.0)));
  vec2 tip = mid + far * L * 0.5;
  tip += tuftOffset * uTuftPull * (0.4 + 0.6 * tuftSeed); // wisps: tips draw in toward their tuft

  // Quadratic curve root → tip that passes through `mid` halfway along.
  vec2 control = 2.0 * mid - 0.5 * tip;
  vec2 along = 2.0 * (1.0 - t) * t * control + t * t * tip;
  vec2 tangent = 2.0 * (1.0 - t) * control + 2.0 * t * (tip - control);
  float speed = length(tangent);
  vec2 side = speed > 1e-3 ? perp(tangent / speed) : perp(dir(seed * TAU));
  float taper = 1.0 - pow(t, 2.4);
  vec2 p = root + along + side * (x * w * (0.25 + 0.75 * taper));

  // ---- Height: this is a depth, not an offset. We look straight down, so height only decides ----
  // ---- what lies over what. Each blade has its own layer in the thatch and rises along its length.
  float layer = fract(seed * 7.13 + tuftSeed * 3.1);
  float height = layer * 0.55 + t * 0.45;

  // ---- Shade ----
  // Roots sit in shadow and low blades sit under the others: the fake occlusion every game uses,
  // and most of what makes grass look deep.
  vec3 photo = textureLod(uPhoto, aRoot, 6.0).rgb;
  float tone = mix(MID_GREY, dot(photo, LUMA), uBaked);
  vShade = tone * mix(uRootShade, 2.0 - uRootShade, t) * mix(0.62, 1.2, height);
  vShade *= texture(uLight, windUV).r; // shaded as a group too, so tufts flash together
  vShade *= 1.0 + uSheen * dot(dir(atan(tangent.y, tangent.x)), uLightDir);
  vec2 fromCenter = (aC.xy * 2.0 - 1.0) * uTuftReach / 90.0;
  float mound = 1.0 - smoothstep(0.1, 1.0, dot(fromCenter, fromCenter));
  vShade *= mix(1.0 - uTuftDepth, 1.0 + 0.4 * uTuftDepth, mound);
  vShade *= 1.0 + uBladeTone * ((seed - 0.5) + 1.2 * (tuftSeed - 0.5) + 0.8 * (clumpSeed - 0.5));
  vDir = speed > 1e-3 ? tangent / speed : dir(seed * TAU); // along the blade, for the ASCII pass

  vec3 clip = uImageToClip * vec3(p, 1.0);
  gl_Position = vec4(clip.xy, 0.9 - 1.8 * height, 1.0);
}
