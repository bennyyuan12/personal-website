precision highp float;

// The grass floor under the blades. Blades don't cover everything, so whatever is drawn here shows
// through between them: it has to be lit by the same lean as the grass, never by the photo's own
// lighting, or a fixed copy of the photo sits behind the moving field.
uniform sampler2D uPhoto;
uniform sampler2D uLight;   // brightness from how the grass is lying
uniform sampler2D uRamp;    // the photo's own color at each brightness
uniform float uBaked;
uniform float uDim;
uniform vec2 uPriorDir;
in vec2 vUv;

layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gDir;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float MID_GREY = 0.3;

void main() {
  float fine = dot(textureLod(uPhoto, vUv, 1.5).rgb, LUMA);
  float local = dot(textureLod(uPhoto, vUv, 4.0).rgb, LUMA);
  float broad = dot(textureLod(uPhoto, vUv, 6.0).rgb, LUMA);
  float detail = clamp(fine / max(local, 0.03), 0.4, 1.8);
  float light = mix(MID_GREY, broad, uBaked) * detail * texture(uLight, vUv).r * uDim;
  gColor = vec4(texture(uRamp, vec2(clamp(light, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb, 1.0);
  gDir = vec4(uPriorDir, 0.0, 1.0);
}
