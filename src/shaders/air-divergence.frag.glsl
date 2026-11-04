// Air, step 2: where it's piling up or thinning out. Air hitting the ground spreads sideways from
// where it lands, which here is a source of air: so a blower pushes outward all around itself.
precision highp float;

uniform sampler2D uVelocity;
uniform vec2 uTexel;
uniform float uDx;       // cell size, height units
uniform float uAspect;
uniform vec2 uSpot;      // where the pointer is blowing, height units
uniform float uBlow;     // how hard, per second
uniform float uRadius;
uniform vec4 uHolds[2];  // x, y, radius, strength

in vec2 vUv;
layout(location = 0) out vec4 outDivergence;

float landing(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  return exp(-dot(d, d) / (r * r));
}

void main() {
  float e = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float w = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float n = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  float s = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  vec2 p = vUv * vec2(uAspect, 1.0);
  float source = uBlow * landing(p, uSpot, uRadius);
  for (int i = 0; i < 2; i++) {
    if (uHolds[i].z > 0.0) source += uHolds[i].w * landing(p, uHolds[i].xy, uHolds[i].z);
  }
  outDivergence = vec4((e - w + n - s) * 0.5 / uDx - source, 0.0, 0.0, 1.0);
}
