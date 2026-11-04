// Air, step 3: one Jacobi iteration of the pressure that keeps it flowing rather than piling up.
precision highp float;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
uniform float uDx;

in vec2 vUv;
layout(location = 0) out vec4 outPressure;

void main() {
  float e = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).r;
  float w = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).r;
  float n = texture(uPressure, vUv + vec2(0.0, uTexel.y)).r;
  float s = texture(uPressure, vUv - vec2(0.0, uTexel.y)).r;
  float div = texture(uDivergence, vUv).r;
  outPressure = vec4((e + w + n + s - uDx * uDx * div) * 0.25, 0.0, 0.0, 1.0);
}
