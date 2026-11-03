precision highp float;

// Per vertex: x = across the blade (-0.5..0.5), y = t along the blade (0 root .. 1 tip)
in vec3 position;
// Per instance (normalized uint16, see bladeFormat.ts)
in vec4 aA; // rootU, rootV, angle/2π, len/LEN_MAX
in vec4 aB; // width/WIDTH_MAX, lumEq, coherence, ridge
in vec2 aC; // seed, seed2

uniform mat3 uImageToClip;
uniform vec2 uImageSize;
uniform float uLenMax;
uniform float uWidthMax;
uniform float uPhase;      // loop phase 0..1
uniform float uLenScale;
uniform float uWidthScale;
uniform float uJitter;     // per-blade sway amplitude (radians)
uniform float uDensity;    // fraction of blades drawn (quality tiers)
uniform float uRootShade;
uniform float uSheen;
uniform vec2 uLightDir;
uniform sampler2D uField;  // school field over the photo (see field.frag.glsl)
uniform float uFollow;     // how far blades turn toward the field
uniform float uRootTurn;   // share of the turn done by rotating at the root (rest is bend)
uniform float uDrift;      // image px the roots get pushed along the field

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
  if (aC.y > uDensity) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside the clip volume
    return;
  }

  float x = position.x;
  float t = position.y;
  vec2 root = aA.xy * uImageSize;
  float a0 = aA.z * TAU;
  float len = aA.w * uLenMax * uLenScale;
  // Thinned-out blades (lower quality tiers) are drawn wider to keep the same coverage.
  float w = aB.x * uWidthMax * uWidthScale * inversesqrt(max(uDensity, 0.05));
  float taper = 1.0 - 0.75 * t;

  // Rest pose → photo lookup. The blade keeps sampling this strip wherever it moves,
  // so with no motion the blades rebuild the photo.
  vec2 d0 = dir(a0);
  vec2 rest = root + d0 * (t * len) + perp(d0) * (x * w * taper);
  vPhotoUV = rest / uImageSize;

  // ---- School field: big patches turn together ----
  // Each blade reads the field at its root, part-way between "now" and a moment ago,
  // so some blades lag behind the turn like stragglers in a school.
  vec4 f = texture(uField, aA.xy);
  vec2 V = mix(f.rg, f.ba, fract(aC.x * 7.137));
  float strength = min(length(V), 1.0);
  float diff = 0.0;
  if (strength > 1e-4) {
    vec2 vn = V / length(V);
    diff = atan(d0.x * vn.y - d0.y * vn.x, dot(d0, vn)); // signed angle rest → field
  }
  // Fade out as the field points nearly backwards, so blades never snap from +180° to −180°.
  diff *= 1.0 - smoothstep(0.6 * PI, PI, abs(diff));
  // Well-combed fur and lit ridges follow strongly; messy, shaded fur less so.
  float follow = uFollow * strength * mix(0.6, 1.0, aB.z) * mix(0.55, 1.0, aB.w);
  float delta = diff * follow;

  // ---- Each blade's own motion: integer frequency k keeps it periodic in uPhase ----
  float k = 1.0 + floor(fract(aC.x * 13.731) * 3.0);
  delta += uJitter * sin(TAU * (k * uPhase + aC.x));

  // Turn = rotate at the root + bend along a constant-curvature arc; the tip ends at a0 + delta.
  float aR = a0 + delta * uRootTurn;
  float kappa = delta * (1.0 - uRootTurn);
  float a = aR + kappa * t;
  vec2 spine = abs(kappa) > 1e-3
    ? len * vec2(sin(a) - sin(aR), cos(aR) - cos(a)) / kappa
    : len * t * dir(aR + 0.5 * kappa * t);
  // The field also pushes the roots a little, like fur being brushed.
  root += V * uDrift;
  vec2 p = root + spine + perp(dir(a)) * (x * w * taper);

  // Root-to-tip shading gives strand definition and averages to 1 along the blade, so the
  // overall brightness still matches the photo. Sheen brightens blades brushed toward the light.
  vec2 dTip = dir(a0 + delta);
  vShade = mix(uRootShade, 2.0 - uRootShade, t) * (1.0 + uSheen * (dot(dTip, uLightDir) - dot(d0, uLightDir)));
  vDir = dir(a); // local direction along the blade, for the ASCII pass

  vec3 clip = uImageToClip * vec3(p, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
