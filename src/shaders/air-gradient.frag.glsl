// Air, step 4: pressure pushes the air sideways, which is what rolls it into eddies.
precision highp float;

uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform vec2 uTexel;
uniform float uDx;

in vec2 vUv;
layout(location = 0) out vec4 outVelocity;

void main() {
  float e = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).r;
  float w = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).r;
  float n = texture(uPressure, vUv + vec2(0.0, uTexel.y)).r;
  float s = texture(uPressure, vUv - vec2(0.0, uTexel.y)).r;
  vec2 v = texture(uVelocity, vUv).xy - vec2(e - w, n - s) * 0.5 / uDx;
  outVelocity = vec4(clamp(v, vec2(-6.0), vec2(6.0)), 0.0, 1.0);
}
