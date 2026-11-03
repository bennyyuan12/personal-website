// One texel per ASCII cell: average the blade render over the cell.
//   cColor = (average rgb, luminance)
//   cDir   = (dominant blade direction in screen space, unit; coherence 0..1; 1)

precision highp float;

uniform sampler2D uColor;     // blade pass color (premultiplied over an opaque background)
uniform sampler2D uDir;       // blade pass direction (image space)
uniform vec2 uViewport;       // CSS px
uniform float uCell;          // cell size, CSS px
uniform float uViewRotation;  // image → screen rotation (radians)

layout(location = 0) out vec4 cColor;
layout(location = 1) out vec4 cDir;

void main() {
  vec2 origin = floor(gl_FragCoord.xy) * uCell;
  vec3 c = vec3(0.0);
  vec2 d = vec2(0.0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 uv = (origin + (vec2(i, j) + 0.5) * 0.25 * uCell) / uViewport;
      c += texture(uColor, uv).rgb;
      d += texture(uDir, uv).xy;
    }
  }
  c *= 1.0 / 16.0;
  d *= 1.0 / 16.0;

  float coherence = length(d);
  float cr = cos(uViewRotation);
  float sr = sin(uViewRotation);
  vec2 ds = vec2(cr * d.x - sr * d.y, sr * d.x + cr * d.y);
  ds = coherence > 1e-4 ? ds / coherence : vec2(0.0, 1.0);

  cColor = vec4(c, dot(c, vec3(0.2126, 0.7152, 0.0722)));
  cDir = vec4(ds, coherence, 1.0);
}
