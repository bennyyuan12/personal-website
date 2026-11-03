precision highp float;

in vec3 position; // one big triangle in clip space
out vec2 vUv;
out vec2 vClip;

void main() {
  vClip = position.xy;
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
