precision highp float;

uniform sampler2D uPhoto;
uniform sampler2D uRamp;    // the photo's own color at each brightness
uniform float uBaked;       // 0: all light comes from the grass's lie; 1: keep the photo's lighting

in vec2 vPhotoUV;
in float vX;
in float vT;
in float vShade;
in vec2 vDir;

layout(location = 0) out vec4 gColor; // premultiplied
layout(location = 1) out vec4 gDir;   // (cos, sin) of the visible blade, premultiplied

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float MID_GREY = 0.3; // the photo's typical brightness

void main() {
  float fw = max(fwidth(vX), 1e-4);
  float edge = 1.0 - smoothstep(0.5 - fw, 0.5, abs(vX));
  float tip = 1.0 - 0.6 * smoothstep(0.8, 1.0, vT);
  float alpha = edge * tip;
  if (alpha < 0.004) discard;

  // Split the photo into strand-scale detail and everything broader. Only strand detail is kept
  // for certain: a coarser split would leave every ridge's shadow edge in the "detail", and those
  // painted ridges are what hold the field in one shape.
  float fine = dot(texture(uPhoto, vPhotoUV).rgb, LUMA);
  float local = dot(textureLod(uPhoto, vPhotoUV, 3.5).rgb, LUMA);
  float broad = dot(textureLod(uPhoto, vPhotoUV, 6.0).rgb, LUMA);
  float detail = clamp(fine / max(local, 0.03), 0.3, 2.2);
  float light = mix(MID_GREY, broad, uBaked) * pow(detail, 1.25) * vShade;

  vec3 c = texture(uRamp, vec2(clamp(light, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
  gColor = vec4(c * alpha, alpha);
  gDir = vec4(vDir * alpha, 0.0, alpha);
}
