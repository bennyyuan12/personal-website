// School field: a small texture over the photo (image UV, y-up) holding the direction the
// fur "wants" to point. RG = field at phase, BA = field a moment earlier (per-blade lag).
// The vector's length is how strongly blades follow it (0 = stay at rest).
//
// Every time term is periodic in the loop phase:
//   centers ride Lissajous paths with integer frequencies, headings oscillate with integer
//   frequencies (one school also spins a whole turn per loop), the noise wraps in time.

precision highp float;
precision highp int;

#pragma include noise

uniform float uPhase;
uniform float uLag;
uniform float uAspect;     // image width / height
uniform int uCount;
uniform vec4 uS0[8];       // center x, center y, path radius x, path radius y   (height units)
uniform vec4 uS1[8];       // path freq x, path freq y, path phase x, path phase y
uniform vec4 uS2[8];       // radius, base heading, heading swing, swing freq
uniform vec4 uS3[8];       // swing phase, spins per loop, presence freq, presence phase
uniform float uRadiusScale;
uniform float uSharpness;
uniform float uWaveSpeed;  // height units per loop: how fast a turn spreads from the leader
uniform float uRestWeight; // pull toward "no motion" away from any school
uniform float uAmpScale;
uniform float uCurl;
uniform float uCurlScale;
uniform int uCurlPeriod;

in vec2 vUv;
out vec4 outField;

const float TAU = 6.28318530718;

vec2 schools(vec2 q, float ph) {
  vec2 V = vec2(0.0);
  float wsum = uRestWeight;
  for (int k = 0; k < 8; k++) {
    if (k >= uCount) break;
    vec4 s0 = uS0[k];
    vec4 s1 = uS1[k];
    vec4 s2 = uS2[k];
    vec4 s3 = uS3[k];
    vec2 c = s0.xy + s0.zw * vec2(sin(TAU * s1.x * ph + s1.z), sin(TAU * s1.y * ph + s1.w));
    float r = s2.x * uRadiusScale;
    float d = length(q - c);
    float w = exp(-uSharpness * d * d / (r * r));
    float presence = mix(0.35, 1.0, smoothstep(-0.5, 0.5, sin(TAU * s3.z * ph + s3.w)));
    // The leader turns first; the turn reaches members further out a little later.
    float pl = ph - d / uWaveSpeed;
    float h = s2.y + uAmpScale * s2.z * sin(TAU * s2.w * pl + s3.x) + TAU * s3.y * pl;
    V += w * presence * vec2(cos(h), sin(h));
    wsum += w;
  }
  return V / wsum;
}

vec2 field(vec2 q, float ph) {
  ph = fract(ph);
  return schools(q, ph) + uCurl * 0.5 * loopCurl(q * uCurlScale, ph, uCurlPeriod);
}

void main() {
  vec2 q = vUv * vec2(uAspect, 1.0);
  outField = vec4(field(q, uPhase), field(q, uPhase - uLag));
}
