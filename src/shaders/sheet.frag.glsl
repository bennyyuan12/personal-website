// The grass sheet: how the field is lying, over the world. Everything here is a change from the
// lay of the grass (lay.frag.glsl), which is how it lies with no wind.
//
//   outState.xy  = bend: where the grass is right now
//   outState.zw  = how fast the bend is changing
//   outMemory.xy = a delayed copy of the bend, for tufts that respond late
//   outMemory.zw = rest: where the grass has come to lie
//
// Long grass doesn't spring back to a fixed pose. It behaves like soft wire: a small push flexes
// it and it returns, but past its yield point it stays over. So three things move it:
//   rhythm   waves that never stop, small enough that the grass gives them back
//   gusts    stronger, they lay it over past the yield point and it stays there
//   air      the pointer's real moving air (air.ts): whatever it reaches is pushed its way
// Nothing is ever removed. Blades only change which way they lie.

precision highp float;

uniform sampler2D uPrev;        // state
uniform sampler2D uPrevMemory;
uniform sampler2D uWind;        // RG: the lean the wind asks for. B: how hard, 0..1. A: rhythm, -1..1
uniform sampler2D uLay;         // RG: how the grass lies with no wind
uniform sampler2D uAir;         // RG: the pointer's air, heights per second
uniform vec2 uTexel;
uniform float uDt;              // seconds
uniform float uStiffness;       // pull toward the target (1/s²)
uniform float uCoupling;        // pull toward neighbors (1/s²)
uniform float uDamping;         // 1/s
uniform float uLagRate;         // 0..1 per step
uniform float uYield;           // how far grass can flex and still come back
uniform float uSet;             // 0..1 per step: how quickly bend past the yield point takes hold
uniform float uCalm;            // the slight pull of light air
uniform vec2 uWindDir;
uniform float uSway;            // lean each wave of the rhythm gives, at its peak
uniform float uAirLean;         // lean per unit of air speed
uniform float uAirFull;         // air speed that has the grass entirely in its grip
uniform float uAirStiffness;    // air acts far faster than the grass's own spring (1/s²)
uniform float uRegrow;          // per second: how quickly grass rises back toward its lay

in vec2 vUv;
layout(location = 0) out vec4 outState;
layout(location = 1) out vec4 outMemory;

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
  vec2 lay = texture(uLay, vUv).xy;

  vec2 neighbors = 0.25 * (
    clean(texture(uPrev, vUv + vec2(uTexel.x, 0.0))).xy +
    clean(texture(uPrev, vUv - vec2(uTexel.x, 0.0))).xy +
    clean(texture(uPrev, vUv + vec2(0.0, uTexel.y))).xy +
    clean(texture(uPrev, vUv - vec2(0.0, uTexel.y))).xy);

  vec4 wind = texture(uWind, vUv);
  vec2 air = clean(texture(uAir, vUv)).xy;
  float airSpeed = length(air);
  // Faint air far from the pointer doesn't move long grass at all.
  float airGrip = smoothstep(0.3 * uAirFull, uAirFull, airSpeed);

  // Rest, then what the gust asks for, then the rhythm on top.
  float press = clamp(max(wind.b, uCalm), 0.0, 1.0);
  vec2 target = mix(rest, wind.xy, press);

  // As in Jahrmann & Wimmer: a blade lying along the wind takes less of it than one lying across.
  vec2 lean = lay + bend;
  float along = abs(dot(uWindDir, lean / max(length(lean), 1e-4)));
  target += uWindDir * wind.a * uSway * (1.0 - 0.4 * along);

  // Moving air lays the grass over its way, however it was lying.
  if (airSpeed > 1e-4) {
    vec2 blown = air / airSpeed * min(airSpeed * uAirLean, 1.1);
    target = mix(target, blown - lay, airGrip);
  }

  float pull = uStiffness + uAirStiffness * airGrip;
  vec2 accel = pull * (target - bend) + uCoupling * (neighbors - bend) - uDamping * speed;
  speed += accel * uDt;
  bend += speed * uDt;

  // A blade can only lie flat, however hard it's blown.
  lean = lay + bend;
  float size = length(lean);
  if (size > 1.2) {
    bend = lean * (1.2 / size) - lay;
    speed *= 0.8;
  }

  // Past the yield point the bend takes hold: this is what the grass keeps. It rises again very
  // slowly on its own.
  vec2 strain = bend - rest;
  float over = length(strain);
  if (over > uYield) rest += strain * (1.0 - uYield / over) * uSet;
  rest *= 1.0 - uRegrow * uDt;

  outState = vec4(bend, speed);
  outMemory = vec4(mix(lag, bend, uLagRate), rest);
}
