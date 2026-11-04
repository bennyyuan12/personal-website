precision highp float;

// The thatch under the blades: old grass, in shadow. Blades don't cover everything, so whatever is
// drawn here shows through between them, lit by the same lean as the grass. Anything lying on the
// grass lies on top of this, so here it's cut away and the page shows through.
uniform sampler2D uPhoto;
uniform sampler2D uLight;   // brightness from how the grass is lying
uniform sampler2D uRamp;    // the photo's own color at each brightness
uniform sampler2D uShapes;  // R: 1 where something is lying on the grass
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
  float detail = clamp(fine / max(local, 0.03), 0.4, 1.8);
  float light = MID_GREY * detail * texture(uLight, vUv).r * uDim;
  float cover = 1.0 - smoothstep(0.35, 0.65, texture(uShapes, vUv).r);
  vec3 c = texture(uRamp, vec2(clamp(light, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
  gColor = vec4(c * cover, cover);
  gDir = vec4(uPriorDir * cover, 0.0, cover);
}
