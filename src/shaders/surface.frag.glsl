// How the grass is lying right now, and the light that gives it. Light comes from the lie of the
// grass, not from the photo. It works like brushed velvet or a mown lawn: the same grass reads
// light or dark depending on which way it lies, so the sweeps of the field show as tone, and a
// passing wave shows as a band of light.
//   tilt     grass lying toward the light shows its lit side; lying away shows shade
//   relief   grass blown together heaps up and catches light; blown apart it parts and goes dark
//   shimmer  grass on the move flashes, so a passing gust glints before it settles
//
// outField: RG = lean now, BA = lean a moment ago, as a share of blade length.
// outLight: R  = brightness multiplier for the blades here.

precision highp float;

uniform sampler2D uSheet;    // XY bend, ZW bend speed
uniform sampler2D uMemory;   // XY delayed bend
uniform sampler2D uLay;      // XY how the grass lies with no wind
uniform vec2 uTexel;
uniform vec2 uLightDir;
uniform float uTilt;
uniform float uRelief;
uniform float uShimmer;

in vec2 vUv;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outLight;

vec2 leanAt(vec2 uv) {
  return texture(uLay, uv).xy + texture(uSheet, uv).xy;
}

void main() {
  vec4 sheet = texture(uSheet, vUv);
  vec2 lay = texture(uLay, vUv).xy;
  vec2 now = lay + sheet.xy;
  outField = vec4(now, lay + texture(uMemory, vUv).xy);

  // Wide stencil: the features that matter are as broad as the patches.
  vec2 e = uTexel * 5.0;
  float spread =
    leanAt(vUv + vec2(e.x, 0.0)).x - leanAt(vUv - vec2(e.x, 0.0)).x +
    leanAt(vUv + vec2(0.0, e.y)).y - leanAt(vUv - vec2(0.0, e.y)).y;

  // Lean is pushed through a soft curve so patches read as distinct, not as a smooth gradient.
  float lean = dot(now, uLightDir);
  lean = sign(lean) * pow(abs(lean), 0.7);
  float shade = 1.0 + uTilt * lean - uRelief * spread + uShimmer * length(sheet.zw);
  outLight = vec4(clamp(shade, 0.45, 1.9), 0.0, 0.0, 1.0);
}
