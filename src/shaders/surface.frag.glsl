// Light comes from how the grass is lying, not from the photo. It works like brushed velvet or a
// mown lawn: the same grass reads light or dark depending on which way it lies, so the big
// patches of tone are made by the wind and change with it.
//   tilt     grass lying toward the light shows its lit side; lying away shows shade
//   relief   grass blown together heaps up and catches light; blown apart it parts and goes dark
//   shimmer  grass on the move flashes, so a passing gust glints before it settles
//
// outField: RG = bend now, BA = delayed bend.
// outLight: R  = brightness multiplier for the blades here.

precision highp float;

uniform sampler2D uSheet;    // XY bend, ZW bend speed
uniform sampler2D uMemory;   // XY delayed bend
uniform vec2 uTexel;
uniform vec2 uLightDir;
uniform float uTilt;
uniform float uRelief;
uniform float uShimmer;

in vec2 vUv;
layout(location = 0) out vec4 outField;
layout(location = 1) out vec4 outLight;

void main() {
  vec4 sheet = texture(uSheet, vUv);
  outField = vec4(sheet.xy, texture(uMemory, vUv).xy);

  // Wide stencil: the features that matter are as broad as the patches.
  vec2 e = uTexel * 5.0;
  float spread =
    texture(uSheet, vUv + vec2(e.x, 0.0)).x - texture(uSheet, vUv - vec2(e.x, 0.0)).x +
    texture(uSheet, vUv + vec2(0.0, e.y)).y - texture(uSheet, vUv - vec2(0.0, e.y)).y;

  // Lean is pushed through a soft curve so patches read as distinct, not as a smooth gradient.
  float lean = dot(sheet.xy, uLightDir);
  lean = sign(lean) * pow(abs(lean), 0.7);
  float shade = 1.0 + uTilt * lean - uRelief * spread + uShimmer * length(sheet.zw);
  outLight = vec4(clamp(shade, 0.35, 2.1), 0.0, 0.0, 1.0);
}
