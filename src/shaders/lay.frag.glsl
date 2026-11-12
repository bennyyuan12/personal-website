// The lay of the grass: which way it grew and has come to lie, before any wind. Long grass is never
// combed one way. It falls into sweeps and cowlicks, so this is a swirling flow that runs across
// the field. Around something that settled into the grass the blades curl in over it, like a nest;
// around something that landed hard they're pressed out and swirl around it.
//
// RG = the lean of the grass here, as a share of its length: 0 standing .. 1 lying flat.
// BA = the same, as if nothing had pressed it out: where the blades that sprang back want to lie.

precision highp float;
precision highp int;

#pragma include noise

uniform float uAspect;
uniform vec2 uWindDir;
uniform float uLayScale;   // swirls per height
uniform float uLayDrift;   // how much the prevailing wind has combed it
uniform int uCount;
uniform vec4 uNests[12];   // center x, y, half width, half height (height units)
uniform float uNestPull[12]; // 1 curls in over it, -1 pressed out around it, 0 not there yet
uniform float uNestSpread;  // how far out the curl reaches, in nest radii
uniform float uNestTwist;   // radians: 0 points straight in, higher spirals around
uniform float uPressSpread; // the same for grass pressed out
uniform float uPressTwist;

in vec2 vUv;
layout(location = 0) out vec4 outLay;

void main() {
  vec2 q = vUv * vec2(uAspect, 1.0);
  vec2 warp = vec2(
    loopNoise(vec3(q * 1.7 + 3.1, 0.2), ivec2(0, 8)),
    loopNoise(vec3(q * 1.7 + 9.7, 0.7), ivec2(0, 8)));
  vec2 p = q + warp * 0.28;
  vec2 flow = loopCurl(p * uLayScale, 0.13, 4) + 0.45 * loopCurl(p * uLayScale * 2.3 + 5.0, 0.61, 4);
  flow += uLayDrift * uWindDir;
  float strength = length(flow);
  vec2 lean = (flow / max(strength, 1e-4)) * mix(0.68, 0.94, smoothstep(0.2, 1.3, strength));

  vec2 sprung = lean;
  for (int i = 0; i < uCount; i++) {
    vec4 c = uNests[i];
    float pull = uNestPull[i];
    if (pull == 0.0) continue;
    vec2 toCenter = c.xy - q;
    float r = length(toCenter / c.zw);
    if (r < 1e-3) continue;
    vec2 inward = toCenter / length(toCenter);
    bool pressed = pull < 0.0;
    float twist = pressed ? uPressTwist : uNestTwist;
    float spread = pressed ? uPressSpread : uNestSpread;
    vec2 way = pressed ? -inward : inward;
    float cs = cos(twist);
    float sn = sin(twist);
    vec2 curl = vec2(cs * way.x - sn * way.y, sn * way.x + cs * way.y);
    float amount = abs(pull) * exp(-r * r / (spread * spread));
    lean = mix(lean, curl * 0.92, amount);
    if (!pressed) sprung = mix(sprung, curl * 0.92, amount);
  }
  outLay = vec4(lean, sprung);
}
