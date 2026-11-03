precision highp float;

// Blurred, darkened photo under the blades so gaps never show black.
uniform sampler2D uPhoto;
uniform float uLod;
uniform float uDim;
uniform vec2 uPriorDir;
in vec2 vUv;

layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gDir;

void main() {
  gColor = vec4(textureLod(uPhoto, vUv, uLod).rgb * uDim, 1.0);
  gDir = vec4(uPriorDir, 0.0, 1.0);
}
