// Air, step 1: it carries itself along and slows down, and the pointer drags it the way it's going.
precision highp float;

uniform sampler2D uVelocity;
uniform float uAspect;
uniform float uDt;
uniform float uFade;   // share of its speed the air keeps this step
uniform vec2 uBrushA;  // pointer path this step, height units
uniform vec2 uBrushB;
uniform vec2 uPush;    // pointer velocity, heights per second
uniform float uDrag;   // 0..1: how far the air under the pointer takes on its velocity
uniform float uRadius; // height units

in vec2 vUv;
layout(location = 0) out vec4 outVelocity;

void main() {
  vec2 here = texture(uVelocity, vUv).xy;
  vec2 v = texture(uVelocity, vUv - uDt * here * vec2(1.0 / uAspect, 1.0)).xy * uFade;
  vec2 p = vUv * vec2(uAspect, 1.0);
  vec2 ab = uBrushB - uBrushA;
  float t = clamp(dot(p - uBrushA, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  vec2 away = p - uBrushA - ab * t;
  v = mix(v, uPush, uDrag * exp(-dot(away, away) / (uRadius * uRadius)));
  outVelocity = vec4(v, 0.0, 1.0);
}
