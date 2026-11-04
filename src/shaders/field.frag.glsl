// The wind: a small texture over the world (image UV, y-up) holding what the air is doing now.
// A shared pattern moves across a fixed field of plants:
//   gusts    the main feature: broad patches carried across the world
//   detail   weaker, smaller features riding on them
//   heading  each gust blows its own way, so it combs the grass differently from the last one
//   rhythm   a steady train of waves rolling across the field, which never stops
// The grass doesn't follow this directly: the sheet (sheet.frag.glsl) responds to it, and it
// keeps what the gusts did to it.
//
// outWind: RG = the lean the wind is asking for. B = how hard it blows here, 0..1.
//          A = the rhythm here, -1..1: signed push along the wind, which the grass gives back.
//
// Every time term is periodic in the loop phase: gust patterns scroll by a whole number of
// repeats per loop, so the wind at the end of the loop is the wind at its start.

precision highp float;
precision highp int;

#pragma include noise

uniform float uPhase;
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
uniform float uCurlScale;
uniform int uCurlPeriod;
uniform vec2 uWindDir;     // where the wind is blowing toward
uniform float uBreeze;     // the lean every blade keeps
uniform float uGust;       // extra lean at the peak of a gust
uniform float uGustCells;  // gust fronts per height along the wind
uniform float uGustCross;  // per height across the wind: lower = longer fronts
uniform int uGustTrips;    // whole pattern repeats scrolled per loop: higher = faster
uniform float uGustDetail; // weight of the smaller features
uniform float uGustEdge;   // softness of a gust's edge
uniform float uGustTurn;   // how far gusts differ in direction
uniform float uPressAt;    // how strong a gust must be before it moves the grass much
uniform float uRipple;
uniform float uRhythmCells; // wave fronts per height along the wind
uniform int uRhythmA;       // waves per loop: a whole number, so the rhythm closes the loop
uniform int uRhythmB;

in vec2 vUv;
layout(location = 0) out vec4 outWind;

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

// Noise carried along the wind: `repeat` cells long, moved repeat × trips cells per loop.
float carried(float along, float across, float cells, float crossCells, int repeat, int trips, float ph) {
  float x = along * cells + float(repeat) * (float(trips) * (1.0 - ph) + 4.0);
  return loopNoise(vec3(x, across * crossCells + 16.0, ph * 4.0), ivec2(repeat, 4));
}

// A sine shaped from a triangle wave, the cheap wave Crysis used for its plants.
float wave(float x) {
  float t = abs(fract(x + 0.5) * 2.0 - 1.0);
  return t * t * (3.0 - 2.0 * t) * 2.0 - 1.0;
}

void main() {
  vec2 q = vUv * vec2(uAspect, 1.0);
  float ph = fract(uPhase);
  float along = dot(q, uWindDir);
  float across = dot(q, vec2(-uWindDir.y, uWindDir.x));

  // All three layers move at the same speed: the repeats scale with their frequency, so the same
  // number of trips carries each the same distance.
  float broad = carried(along, across, uGustCells, uGustCross, 12, uGustTrips, ph);
  float fine = carried(along, across, uGustCells * 2.5, uGustCross * 2.5, 30, uGustTrips, ph);
  float strength = smoothstep(0.02 - uGustEdge, 0.02 + uGustEdge, broad + uGustDetail * fine);

  // The air swirls as it goes, so each part of a gust lays the grass its own way. This is what
  // leaves the field in patches and cowlicks a few hundred pixels across rather than combed flat.
  float swirl = carried(along, across + 3.7, uGustCells * 2.0, uGustCross * 3.0, 24, uGustTrips, ph)
              + 0.5 * carried(along, across + 7.1, uGustCells * 5.0, uGustCross * 7.0, 60, uGustTrips, ph);
  float angle = atan(uWindDir.y, uWindDir.x) + uGustTurn * 3.0 * swirl;

  vec2 lean = (uBreeze + uGust * strength) * vec2(cos(angle), sin(angle));
  vec2 still = uSchoolAmount * schools(q, ph) + uRipple * 0.5 * loopCurl(q * uCurlScale, ph, uCurlPeriod);

  // The rhythm: wave fronts rolling downwind, with bent fronts so they aren't ruled lines, and two
  // periods that don't divide evenly so no two waves look alike. Stronger inside a gust.
  float bent = 0.55 * loopNoise(vec3(q * 1.1 + 11.0, 0.5), ivec2(0, 8));
  float front = along * uRhythmCells + bent;
  float rhythm = 0.64 * wave(float(uRhythmA) * ph - front) + 0.36 * wave(float(uRhythmB) * ph - front * 1.37 + 0.3);
  rhythm *= mix(0.72, 1.0, strength);

  outWind = vec4(lean + still, smoothstep(uPressAt - 0.12, uPressAt + 0.12, strength), rhythm);
}
