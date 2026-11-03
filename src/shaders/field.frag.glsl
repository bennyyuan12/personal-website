// Wind field: a small texture over the world (image UV, y-up) holding where the grass is
// being pushed. Three layers add up:
//   schools  big patches that turn together, like a shoal changing direction
//   gusts    fronts of wind carried across the world, with ripples running through them
//   swirl    small divergence-free eddies
// outField: RG = push now, BA = push a moment earlier (per-blade lag).
// outGust:  R  = how much wind is hitting this spot now, for lighting.
//
// Every time term is periodic in the loop phase: paths and headings use integer frequencies,
// and gust patterns scroll by a whole number of repeats per loop, so frame N == frame 0.

precision highp float;
precision highp int;

#pragma include noise

uniform float uPhase;
uniform float uLag;
uniform float uAspect;     // world width / height
uniform int uCount;
uniform vec4 uS0[8];       // center x, center y, path radius x, path radius y   (height units)
uniform vec4 uS1[8];       // path freq x, path freq y, path phase x, path phase y
uniform vec4 uS2[8];       // radius, base heading, heading swing, swing freq
uniform vec4 uS3[8];       // swing phase, spins per loop, presence freq, presence phase
uniform float uRadiusScale;
uniform float uSharpness;
uniform float uWaveSpeed;  // height units per loop: how fast a turn spreads from the leader
uniform float uRestWeight; // pull toward "no motion" away from any school
uniform float uAmpScale;
uniform float uSchoolAmount;
uniform float uCurl;
uniform float uCurlScale;
uniform int uCurlPeriod;
uniform vec2 uWindDir;     // where the wind is blowing toward
uniform float uBreeze;     // steady lean
uniform float uGust;       // push at the peak of a gust
uniform float uRipple;     // push of the ripples inside a gust

in vec2 vUv;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outGust;

const float TAU = 6.28318530718;

vec2 schools(vec2 q, float ph) {
  vec2 V = vec2(0.0);
  float wsum = uRestWeight;
  for (int k = 0; k < 8; k++) {
    if (k >= uCount) break;
    vec4 s0 = uS0[k];
    vec4 s1 = uS1[k];
    vec4 s2 = uS2[k];
    vec4 s3 = uS3[k];
    vec2 c = s0.xy + s0.zw * vec2(sin(TAU * s1.x * ph + s1.z), sin(TAU * s1.y * ph + s1.w));
    float r = s2.x * uRadiusScale;
    float d = length(q - c);
    float w = exp(-uSharpness * d * d / (r * r));
    float presence = mix(0.35, 1.0, smoothstep(-0.5, 0.5, sin(TAU * s3.z * ph + s3.w)));
    // The leader turns first; the turn reaches members further out a little later.
    float pl = ph - d / uWaveSpeed;
    float h = s2.y + uAmpScale * s2.z * sin(TAU * s2.w * pl + s3.x) + TAU * s3.y * pl;
    V += w * presence * vec2(cos(h), sin(h));
    wsum += w;
  }
  return V / wsum;
}

// Scrolling noise: `repeat` cells long, moved by repeat × trips cells per loop, so it travels
// along the wind at repeat × trips / cells heights per loop.
float windNoise(float along, float across, float cells, float crossCells, int repeat, int trips, float ph) {
  float x = along * cells + float(repeat) * (float(trips) * (1.0 - ph) + 4.0);
  return loopNoise(vec3(x, across * crossCells + 16.0, ph * 2.0), ivec2(repeat, 2));
}

// x: gust strength 0..1 (broad fronts). y: ripple height 0..1 (the fine waves inside them).
vec2 gusts(vec2 q, float ph) {
  float along = dot(q, uWindDir);
  float across = dot(q, vec2(-uWindDir.y, uWindDir.x));
  // Stretched across the wind so the patches read as fronts. Both layers travel 5 heights per loop.
  float n = 0.85 * windNoise(along, across, 2.4, 1.1, 6, 2, ph)
          + 0.45 * windNoise(along, across, 6.0, 2.4, 10, 3, ph);
  float gust = smoothstep(-0.12, 0.42, n);

  // Ripples: two wave trains at the same speed, a little off-axis from each other so they beat
  // into short crests, and bent by noise so nothing runs straight. They only live inside gusts.
  float bend = 3.2 * loopNoise(vec3(q * 1.6 + 8.0, ph * 2.0), ivec2(0, 2))
             + 1.4 * loopNoise(vec3(q * 4.3 + 8.0, ph * 2.0), ivec2(0, 2));
  float wobble = dot(q, vec2(-uWindDir.y, uWindDir.x) * 0.31 + uWindDir * 0.95);
  float crestA = sin(TAU * (along * 8.0 - 40.0 * ph) + bend);
  float crestB = sin(TAU * (wobble * 13.0 - 65.0 * ph) - bend * 0.7);
  float crest = clamp(0.5 + 0.28 * (crestA + crestB), 0.0, 1.0);
  return vec2(gust, crest * gust * gust);
}

void main() {
  vec2 q = vUv * vec2(uAspect, 1.0);
  float now = fract(uPhase);
  float before = fract(uPhase - uLag);

  vec2 gNow = gusts(q, now);
  vec2 gBefore = gusts(q, before);
  float windNow = uBreeze + uGust * gNow.x + uRipple * gNow.y;
  float windBefore = uBreeze + uGust * gBefore.x + uRipple * gBefore.y;

  vec2 still = uSchoolAmount * schools(q, now) + uCurl * 0.5 * loopCurl(q * uCurlScale, now, uCurlPeriod);
  vec2 stillBefore = uSchoolAmount * schools(q, before) + uCurl * 0.5 * loopCurl(q * uCurlScale, before, uCurlPeriod);

  outField = vec4(still + uWindDir * windNow, stillBefore + uWindDir * windBefore);
  outGust = vec4(gNow.x * 0.85 + gNow.y * 0.15, gNow.x, 0.0, 1.0);
}
