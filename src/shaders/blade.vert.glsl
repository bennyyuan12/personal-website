precision highp float;

// Per vertex: x = across the blade (-0.5..0.5), y = t along the blade (0 root .. 1 tip)
in vec3 position;
// Per instance (normalized uint16, see bladeFormat.ts)
in vec2 aRoot; // root position, image UV
in vec4 aA;    // angle/2π, len/LEN_MAX, width/WIDTH_MAX, tuftSeed
in vec4 aB;    // coherence, ridge, seed, seed2
in vec4 aC;    // tuft offset x, tuft offset y, clumpSeed, spare

uniform mat3 uImageToClip;
uniform vec2 uImageSize;
uniform float uLenMax;
uniform float uWidthMax;
uniform float uPhase;      // loop phase 0..1
uniform float uLenScale;
uniform float uWidthScale;
uniform float uMinWidth;   // image px: thinner than this and blades stop covering what's behind
uniform float uJitter;     // per-blade sway amplitude (radians)
uniform float uDensity;    // fraction of blades drawn (quality tiers)
uniform float uRootShade;
uniform float uSheen;
uniform vec2 uLightDir;
uniform sampler2D uField;  // RG bend of the field here, BA the same bend a moment ago
uniform sampler2D uLight;  // brightness from that bend (see surface.frag.glsl)
uniform float uFollow;     // how far a given bend turns a blade
uniform float uRootTurn;   // share of the lean taken at the base (the rest curves along the blade)
uniform float uTuftReach;  // image px: scale of the tuft offset
uniform float uTuftMix;    // 0: each blade feels its own spot; 1: the whole tuft feels one spot
uniform float uTuftGain;   // how much tufts differ in how far they give
uniform float uTuftLag;    // how much tufts differ in timing
uniform float uClumpGain;  // the same for larger clumps
uniform float uClumpLag;
uniform float uFlutter;    // each blade's own motion, stronger when it's being blown
uniform float uTuftSpread; // how far tufts splay from each other when they lie over (radians)
uniform float uTuftDepth;  // how much a tuft's outer blades fall into shadow against its center
uniform float uBladeTone;  // how much individual blades and tufts differ in tone

out vec2 vPhotoUV;
out float vX;
out float vT;
out float vShade;
out vec2 vDir;

const float TAU = 6.28318530718;
const float PI = 3.14159265359;

vec2 dir(float a) { return vec2(cos(a), sin(a)); }
vec2 perp(vec2 d) { return vec2(-d.y, d.x); }

void main() {
  vX = position.x;
  vT = position.y;
  vPhotoUV = vec2(0.0);
  vShade = 0.0;
  vDir = vec2(0.0);
  if (aB.w > uDensity) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside the clip volume
    return;
  }

  float x = position.x;
  float t = position.y;
  vec2 root = aRoot * uImageSize;
  float seed = aB.z;
  float a0 = aA.x * TAU;
  float restLen = aA.y * uLenMax * uLenScale;
  // Thinned-out blades (lower quality tiers) are drawn wider to keep the same coverage.
  float w = max(aA.z * uWidthMax * uWidthScale, uMinWidth) * inversesqrt(max(uDensity, 0.05));
  float taper = 1.0 - 0.75 * t;

  // Rest pose → photo lookup. The blade keeps sampling this strip wherever it moves,
  // so with no motion the blades rebuild the photo.
  vec2 d0 = dir(a0);
  vec2 rest = root + d0 * (t * restLen) + perp(d0) * (x * w * taper);
  vPhotoUV = rest / uImageSize;

  // ---- Wind: rooted plants, moving in groups ----
  // Blades of a tuft read the bend at one shared spot, so they respond as a group. Tufts and
  // clumps keep persistent differences in timing and give; a blade's root never moves.
  vec2 tuftUV = aRoot + (aC.xy * 2.0 - 1.0) * uTuftReach / uImageSize;
  vec2 windUV = mix(aRoot, tuftUV, uTuftMix);
  vec4 f = texture(uField, windUV);
  float tuftSeed = aA.w;
  float clumpSeed = aC.z;
  float late = clamp(uTuftLag * tuftSeed + uClumpLag * clumpSeed + 0.1 * seed, 0.0, 1.0);
  vec2 V = mix(f.rg, f.ba, late);
  float give = 1.0 + uTuftGain * (tuftSeed - 0.5) * 2.0 + uClumpGain * (clumpSeed - 0.5) * 2.0;

  // Adding the bend to the blade's direction works for wind from any side: along a blade it
  // stretches it out, against it stands it up, across it swings it over.
  float follow = uFollow * give * mix(0.75, 1.0, aB.x) * mix(0.8, 1.0, aB.y);
  float splay = uTuftSpread * (tuftSeed - 0.5) * 2.0;
  float cs = cos(splay);
  float sn = sin(splay);
  vec2 D = d0 + vec2(cs * V.x - sn * V.y, sn * V.x + cs * V.y) * follow;
  float delta = dot(D, D) > 1e-6 ? atan(d0.x * D.y - d0.y * D.x, dot(d0, D)) : 0.0;
  float len = restLen * clamp(length(D), 0.65, 1.15);

  // ---- Each blade's own motion: integer frequency k keeps it periodic in uPhase ----
  float k = 16.0 + floor(fract(seed * 13.731) * 18.0);
  delta += (uJitter + uFlutter * length(V)) * sin(TAU * (k * uPhase + seed));

  // Turn = rotate at the root + bend along a constant-curvature arc; the tip ends at a0 + delta.
  float aR = a0 + delta * uRootTurn;
  float kappa = delta * (1.0 - uRootTurn);
  float a = aR + kappa * t;
  vec2 spine = abs(kappa) > 1e-3
    ? len * vec2(sin(a) - sin(aR), cos(aR) - cos(a)) / kappa
    : len * t * dir(aR + 0.5 * kappa * t);
  vec2 p = root + spine + perp(dir(a)) * (x * w * taper);

  // Root-to-tip shading gives strand definition and averages to 1 along the blade, so the
  // overall brightness still matches the photo. Sheen brightens blades brushed toward the light.
  vec2 dTip = dir(a0 + delta);
  vShade = mix(uRootShade, 2.0 - uRootShade, t) * (1.0 + uSheen * (dot(dTip, uLightDir) - dot(d0, uLightDir)));
  vShade *= texture(uLight, windUV).r; // shaded as a group too, so tufts flash together

  // Depth inside the grass. Each tuft is a small mound: its middle stands up into the light and
  // its edges sink into the shade between tufts. Since this travels with the blades it moves when
  // they do, unlike shadow painted into the picture.
  vec2 fromCenter = (aC.xy * 2.0 - 1.0) * uTuftReach / 46.0;
  float mound = 1.0 - smoothstep(0.1, 1.0, dot(fromCenter, fromCenter));
  vShade *= mix(1.0 - uTuftDepth, 1.0 + 0.4 * uTuftDepth, mound);
  vShade *= 1.0 + uBladeTone * ((seed - 0.5) + 1.2 * (tuftSeed - 0.5) + 0.8 * (clumpSeed - 0.5));
  vDir = dir(a); // local direction along the blade, for the ASCII pass

  vec3 clip = uImageToClip * vec3(p, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
