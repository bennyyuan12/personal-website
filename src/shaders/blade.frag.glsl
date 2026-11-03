precision highp float;

uniform sampler2D uPhoto;

in vec2 vPhotoUV;
in float vX;
in float vT;
in float vShade;
in vec2 vDir;

layout(location = 0) out vec4 gColor; // premultiplied
layout(location = 1) out vec4 gDir;   // (cos, sin) of the visible blade, premultiplied

void main() {
  float fw = max(fwidth(vX), 1e-4);
  float edge = 1.0 - smoothstep(0.5 - fw, 0.5, abs(vX));
  float tip = 1.0 - 0.6 * smoothstep(0.8, 1.0, vT);
  float alpha = edge * tip;
  if (alpha < 0.004) discard;
  vec3 c = texture(uPhoto, vPhotoUV).rgb * vShade;
  gColor = vec4(c * alpha, alpha);
  gDir = vec4(vDir * alpha, 0.0, alpha);
}
