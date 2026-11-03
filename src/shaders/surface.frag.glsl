// Combines the looping wind field with the mouse wind, and turns the result into light.
//
// Think of the fur as a soft surface: wind lifts it into rolling crests and a hand pressing
// through it leaves a dent. The slope of that surface against the light gives a lit side and a
// shadowed side, which is what makes the waves and the mouse wake read as 3D.
//
// outField: RG = final push now, BA = final push a moment earlier.
// outLight: R  = brightness multiplier for the blades here. G = surface height.

precision highp float;

uniform sampler2D uField;   // RG now, BA earlier
uniform sampler2D uGust;    // R wind height
uniform sampler2D uTouch;   // XY mouse bend
uniform vec2 uTexel;
uniform vec2 uLightDir;
uniform float uRelief;      // strength of lit/shadowed slopes
uniform float uCrestGlow;   // extra brightness on wind crests
uniform float uTouchGain;   // how hard the mouse wind pushes the blades
uniform float uTouchDent;   // how deep the mouse presses into the fur
uniform float uTouchSheen;  // brightness change from grass blown toward or away from the light
uniform float uTouchFlat;   // highlight on flattened grass, which shows the long sides of its blades

in vec2 vUv;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outLight;

float surfaceHeight(vec2 uv) {
  return texture(uGust, uv).r - uTouchDent * length(texture(uTouch, uv).xy);
}

void main() {
  vec4 field = texture(uField, vUv);
  vec2 touch = texture(uTouch, vUv).xy;
  vec2 bend = touch * uTouchGain;
  outField = field + vec4(bend, bend);

  // Wide stencil: the slopes that matter are broader than a texel.
  vec2 e = uTexel * 4.0;
  vec2 slope = vec2(
    surfaceHeight(vUv + vec2(e.x, 0.0)) - surfaceHeight(vUv - vec2(e.x, 0.0)),
    surfaceHeight(vUv + vec2(0.0, e.y)) - surfaceHeight(vUv - vec2(0.0, e.y)));

  // A slope that rises away from the light faces it.
  float lit = -dot(slope, uLightDir) * uRelief;
  float height = surfaceHeight(vUv);
  float shade = 1.0 + lit + uCrestGlow * height;
  shade += uTouchSheen * dot(touch, uLightDir) + uTouchFlat * min(length(touch), 1.2);
  outLight = vec4(clamp(shade, 0.45, 1.7), height, 0.0, 1.0);
}
