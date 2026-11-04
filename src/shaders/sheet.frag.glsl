// The grass sheet: how the field is lying, over the world.
//
//   outState.xy  = bend: where the grass is right now
//   outState.zw  = how fast the bend is changing
//   outMemory.xy = a delayed copy of the bend, for tufts that respond late
//   outMemory.zw = rest: where the grass has come to lie
//
// Long grass doesn't spring back to a fixed pose. It behaves like soft wire: a small push flexes
// it and it returns, but past its yield point it stays over. So there is no original direction
// to return to. Calm air lets each spot settle on its own `rest`; a gust pulls it toward the lean
// the gust asks for; and any bend past the yield point drags `rest` along with it. When the gust
// has gone the grass stays where it was left, until something moves it again.
//
// The pointer is just more wind. It combs the grass the way it is moving and leaves a trail.

precision highp float;

uniform sampler2D uPrev;        // state
uniform sampler2D uPrevMemory;
uniform sampler2D uWind;        // RG: the lean the wind asks for. B: how hard it blows here, 0..1
uniform vec2 uTexel;
uniform float uAspect;          // world width / height
uniform float uDt;              // seconds
uniform float uStiffness;       // pull toward the target (1/s²)
uniform float uCoupling;        // pull toward neighbors (1/s²)
uniform float uDamping;         // 1/s
uniform float uLagRate;         // 0..1 per step
uniform float uYield;           // how far grass can flex and still come back
uniform float uSet;             // 0..1 per step: how quickly bend past the yield point takes hold
uniform float uCalm;            // the slight pull of light air
uniform vec2 uBrushA;           // pointer path this step, height units
uniform vec2 uBrushB;
uniform float uRadius;          // height units
uniform vec2 uPointerLean;      // the lean the pointer asks for
uniform float uPointerPress;    // how hard it is blowing, 0..1

in vec2 vUv;
layout(location = 0) out vec4 outState;
layout(location = 1) out vec4 outMemory;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  return length(p - a - ab * t);
}

// A single bad value would otherwise spread across the sheet and stay forever.
vec4 clean(vec4 v) {
  return (any(isnan(v)) || any(isinf(v))) ? vec4(0.0) : v;
}

void main() {
  vec4 s = clean(texture(uPrev, vUv));
  vec4 m = clean(texture(uPrevMemory, vUv));
  vec2 bend = s.xy;
  vec2 speed = s.zw;
  vec2 lag = m.xy;
  vec2 rest = m.zw;

  vec2 neighbors = 0.25 * (
    clean(texture(uPrev, vUv + vec2(uTexel.x, 0.0))).xy +
    clean(texture(uPrev, vUv - vec2(uTexel.x, 0.0))).xy +
    clean(texture(uPrev, vUv + vec2(0.0, uTexel.y))).xy +
    clean(texture(uPrev, vUv - vec2(0.0, uTexel.y))).xy);

  // What the air wants here: the gust's lean, or the pointer's where it is passing.
  vec4 wind = texture(uWind, vUv);
  float d = segmentDistance(vUv * vec2(uAspect, 1.0), uBrushA, uBrushB);
  float brush = uPointerPress * exp(-d * d / (uRadius * uRadius));
  vec2 asked = mix(wind.xy, uPointerLean, clamp(brush * 1.5, 0.0, 1.0));
  float press = clamp(max(max(wind.b, brush), uCalm), 0.0, 1.0);

  // With no wind the target is the grass's own resting place.
  vec2 target = mix(rest, asked, press);

  vec2 accel = uStiffness * (target - bend) + uCoupling * (neighbors - bend) - uDamping * speed;
  speed += accel * uDt;
  bend += speed * uDt;

  // Grass only bends so far: soft limit, so a violent swipe can't blow the sheet up.
  float size = length(bend);
  if (size > 2.2) {
    bend *= (2.2 + (size - 2.2) * 0.2) / size;
    speed *= 0.8;
  }

  // Past the yield point the bend takes hold: this is what the grass keeps.
  vec2 strain = bend - rest;
  float over = length(strain);
  if (over > uYield) rest += strain * (1.0 - uYield / over) * uSet;

  outState = vec4(bend, speed);
  outMemory = vec4(mix(lag, bend, uLagRate), rest);
}
