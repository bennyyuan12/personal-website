precision highp float;

uniform sampler2D uRamp;    // the photo's own color at each brightness

in float vX;
in float vT;
in float vShade;
in vec2 vDir;

layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gDir;   // (cos, sin) of the visible blade

void main() {
  // A soft fold down the middle of the blade.
  float light = vShade * (0.9 + 0.2 * cos(vX * 6.2831853));
  vec3 c = texture(uRamp, vec2(clamp(light, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
  gColor = vec4(c, 1.0);
  gDir = vec4(vDir, 0.0, 1.0);
}
