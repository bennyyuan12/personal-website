// Mouse wind: one step of a damped spring sheet over the world.
//   state.xy = how far the grass here is bent (a vector)
//   state.zw = how fast that bend is changing
// The pointer pushes on the sheet; each spot springs back, overshoots a little, and passes
// some of its motion to its neighbors, so a swipe leaves a wake that ripples outward.
// With no pointer the whole sheet settles to zero and the normal loop is untouched.

precision highp float;

uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uAspect;     // world width / height
uniform float uDt;         // seconds
uniform float uStiffness;  // pull back to rest (1/s²)
uniform float uCoupling;   // pull toward neighbors (1/s²), sets how fast ripples spread
uniform float uDamping;    // 1/s
uniform vec2 uBrushA;      // brush segment, height units
uniform vec2 uBrushB;
uniform float uRadius;     // height units
uniform vec2 uForce;       // 1/s²

in vec2 vUv;
out vec4 outState;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  return length(p - a - ab * t);
}

void main() {
  vec4 s = texture(uPrev, vUv);
  vec2 bend = s.xy;
  vec2 speed = s.zw;

  vec2 neighbors = 0.25 * (
    texture(uPrev, vUv + vec2(uTexel.x, 0.0)).xy +
    texture(uPrev, vUv - vec2(uTexel.x, 0.0)).xy +
    texture(uPrev, vUv + vec2(0.0, uTexel.y)).xy +
    texture(uPrev, vUv - vec2(0.0, uTexel.y)).xy);

  vec2 accel = uCoupling * (neighbors - bend) - uStiffness * bend - uDamping * speed;

  float d = segmentDistance(vUv * vec2(uAspect, 1.0), uBrushA, uBrushB);
  accel += uForce * exp(-d * d / (uRadius * uRadius));

  speed += accel * uDt;
  bend += speed * uDt;

  // Grass only bends so far: soft limit, so a violent swipe can't blow the sheet up.
  float size = length(bend);
  if (size > 1.6) {
    bend *= (1.6 + (size - 1.6) * 0.2) / size;
    speed *= 0.8;
  }

  outState = vec4(bend, speed);
}
