precision highp float;

in vec3 position; // unit quad 0..1
uniform mat3 uImageToClip;
uniform vec2 uImageSize;
out vec2 vUv;

void main() {
  vUv = position.xy;
  vec3 clip = uImageToClip * vec3(position.xy * uImageSize, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
