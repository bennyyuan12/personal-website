// Loopable gradient noise.
//
// 3D gradient noise whose lattice can wrap along x and z:
//   - z is time: sampling z = fract(phase) * period.y is exactly periodic in the loop phase.
//   - x can wrap too, so a pattern can be scrolled by a whole number of repeats per loop.
//     That carries it across the world like real wind while still closing the loop.

// PCG3D hash (Jarzynski & Olano, "Hash Functions for GPU Rendering", JCGT 2020).
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}

vec3 latticeGrad(ivec3 c) {
  uvec3 h = pcg3d(uvec3(c + 4096));
  return vec3(h) * (2.0 / 4294967295.0) - 1.0;
}

// period.x: repeat along x in cells (0 = no repeat). period.y: repeat along z in cells.
// p.x (when repeating) and p.z must be >= 0. Returns roughly -1..1.
float loopNoise(vec3 p, ivec2 period) {
  vec3 fl = floor(p);
  vec3 f = p - fl;
  ivec3 i = ivec3(fl);
  int x0 = period.x > 0 ? i.x % period.x : i.x;
  int x1 = period.x > 0 ? (i.x + 1) % period.x : i.x + 1;
  int z0 = i.z % period.y;
  int z1 = (z0 + 1) % period.y;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float n000 = dot(latticeGrad(ivec3(x0, i.y,     z0)), f - vec3(0.0, 0.0, 0.0));
  float n100 = dot(latticeGrad(ivec3(x1, i.y,     z0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(latticeGrad(ivec3(x0, i.y + 1, z0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(latticeGrad(ivec3(x1, i.y + 1, z0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(latticeGrad(ivec3(x0, i.y,     z1)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(latticeGrad(ivec3(x1, i.y,     z1)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(latticeGrad(ivec3(x0, i.y + 1, z1)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(latticeGrad(ivec3(x1, i.y + 1, z1)), f - vec3(1.0, 1.0, 1.0));

  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z);
}

// Divergence-free 2D flow: rotated gradient of the noise. `phase` must be in [0, 1).
vec2 loopCurl(vec2 q, float phase, int period) {
  const float e = 0.04;
  float z = phase * float(period);
  ivec2 wrap = ivec2(0, period);
  float nx1 = loopNoise(vec3(q + vec2(e, 0.0), z), wrap);
  float nx0 = loopNoise(vec3(q - vec2(e, 0.0), z), wrap);
  float ny1 = loopNoise(vec3(q + vec2(0.0, e), z), wrap);
  float ny0 = loopNoise(vec3(q - vec2(0.0, e), z), wrap);
  vec2 g = vec2(nx1 - nx0, ny1 - ny0) / (2.0 * e);
  return vec2(g.y, -g.x);
}
