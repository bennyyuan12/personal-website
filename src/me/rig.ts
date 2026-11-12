// Me, as a puppet. The body is a real skeleton in three dimensions, posed by saying which way each
// bone points, so that lying on my back, sitting up, running and looking at the sky are all the same
// figure seen from the same camera. Nothing here draws anything: it works out where the joints are.
//
// The world: x to the right and y down the screen, both along the ground, and z up off the ground
// toward the camera. Lengths are in shares of my height.

export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** A direction in the body's own frame: toward my left, toward my head, toward my front. */
export type Dir = [number, number, number];

export interface Face {
  /** 0 shut .. 1 open .. 1.4 wide. */
  eyes: number;
  /** -1 knitted .. 1 raised. */
  brows: number;
  /** 0 closed .. 1 wide open. */
  mouth: number;
  /** -1 down .. 1 smiling. */
  smile: number;
  /** Sunglasses: 0 on my nose .. 1 pushed up on my head. */
  shades: number;
}

export interface Pose {
  /** How far I'm tipped back: 0 upright, a quarter turn flat on my back. Negative leans forward. */
  pitch: number;
  /** Which way my front faces on the ground: 0 down the screen, a quarter turn to the right of it. */
  yaw: number;
  /** Leaning toward my left side. */
  roll: number;
  /** Height off the ground, on top of whatever standing or lying needs. */
  lift: number;
  /** Shoulders turned against the hips. */
  twist: number;
  spine: Dir;
  /** Head: turned to my left, tipped back, tilted. */
  head: [number, number, number];
  /** Upper arm, forearm. */
  armL: [Dir, Dir];
  armR: [Dir, Dir];
  /** Thigh, shin, foot. */
  legL: [Dir, Dir, Dir];
  legR: [Dir, Dir, Dir];
  face: Face;
}

/** Where everything ended up, in the world, in the same units as `height`. */
export interface Skeleton {
  height: number;
  /** The frames of the hips, the chest and the head: left, up, front. */
  L: V3;
  U: V3;
  F: V3;
  chestL: V3;
  chestU: V3;
  chestF: V3;
  headL: V3;
  headU: V3;
  headF: V3;
  pelvis: V3;
  chest: V3;
  head: V3;
  /** Left then right. */
  arms: { shoulder: V3; elbow: V3; wrist: V3; tip: V3 }[];
  legs: { hip: V3; knee: V3; ankle: V3; toe: V3 }[];
  face: Face;
}

export const SIZE = {
  torso: 0.28,
  neck: 0.03,
  head: 0.074,
  shoulder: 0.118,
  upperArm: 0.165,
  forearm: 0.145,
  hand: 0.06,
  hip: 0.054,
  thigh: 0.235,
  shin: 0.235,
  foot: 0.105,
};

export const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const mix3 = (a: V3, b: V3, t: number): V3 => add(scale(a, 1 - t), scale(b, t));
export function unit(a: V3): V3 {
  const n = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
}

/** a·left + b·up + c·front, in a frame. */
function along(L: V3, U: V3, F: V3, [l, u, f]: Dir, length: number): V3 {
  const n = Math.hypot(l, u, f) || 1;
  const k = length / n;
  return {
    x: (L.x * l + U.x * u + F.x * f) * k,
    y: (L.y * l + U.y * u + F.y * f) * k,
    z: (L.z * l + U.z * u + F.z * f) * k,
  };
}

/** Turn `a` toward `b` by an angle, both unit and at right angles. */
const swing = (a: V3, b: V3, angle: number) => add(scale(a, Math.cos(angle)), scale(b, Math.sin(angle)));

export function solve(pose: Pose, height: number): Skeleton {
  const H = height;
  // Standing and facing down the screen, then tipped back, leaned and turned.
  let L = v(1, 0, 0);
  let U = v(0, -Math.sin(pose.pitch), Math.cos(pose.pitch));
  const F0 = v(0, Math.cos(pose.pitch), Math.sin(pose.pitch));
  [L, U] = [swing(L, U, pose.roll), swing(U, scale(L, -1), pose.roll)];
  const c = Math.cos(pose.yaw);
  const s = Math.sin(pose.yaw);
  const turn = (a: V3) => v(a.x * c + a.y * s, -a.x * s + a.y * c, a.z);
  L = turn(L);
  U = turn(U);
  const F = turn(F0);

  const pelvis = v(0, 0, 0);
  const chest = along(L, U, F, pose.spine, SIZE.torso * H);
  const chestU = unit(chest);
  let chestL = unit(sub(L, scale(chestU, dot(L, chestU))));
  let chestF = cross(chestU, chestL);
  [chestL, chestF] = [swing(chestL, scale(chestF, -1), pose.twist), swing(chestF, chestL, pose.twist)];

  const [headTurn, headUp] = pose.head;
  const turnedL = swing(chestL, scale(chestF, -1), headTurn);
  const turnedF = swing(chestF, chestL, headTurn);
  const headF = swing(turnedF, chestU, headUp);
  let headU = swing(chestU, scale(turnedF, -1), headUp);
  const headL = swing(turnedL, headU, pose.head[2]);
  headU = swing(headU, scale(turnedL, -1), pose.head[2]);
  const head = add(add(chest, scale(chestU, SIZE.neck * H)), scale(headU, SIZE.head * H));

  const arm = (side: number, [upper, fore]: [Dir, Dir]) => {
    const shoulder = add(add(chest, scale(chestL, side * SIZE.shoulder * H)), scale(chestU, -0.028 * H));
    const elbow = add(shoulder, along(chestL, chestU, chestF, upper, SIZE.upperArm * H));
    const wrist = add(elbow, along(chestL, chestU, chestF, fore, SIZE.forearm * H));
    const tip = add(wrist, along(chestL, chestU, chestF, fore, SIZE.hand * H));
    return { shoulder, elbow, wrist, tip };
  };
  const leg = (side: number, [thigh, shin, foot]: [Dir, Dir, Dir]) => {
    const hip = add(add(pelvis, scale(L, side * SIZE.hip * H)), scale(U, -0.015 * H));
    const knee = add(hip, along(L, U, F, thigh, SIZE.thigh * H));
    const ankle = add(knee, along(L, U, F, shin, SIZE.shin * H));
    const toe = add(ankle, along(L, U, F, foot, SIZE.foot * H));
    return { hip, knee, ankle, toe };
  };
  const arms = [arm(1, pose.armL), arm(-1, pose.armR)];
  const legs = [leg(1, pose.legL), leg(-1, pose.legR)];

  // Whatever is lowest rests on the ground, so the same pose works standing, crouching or lying.
  let low = Math.min(pelvis.z - 0.07 * H, chest.z - 0.066 * H, head.z - 0.078 * H);
  for (const a of arms) low = Math.min(low, a.elbow.z - 0.034 * H, a.wrist.z - 0.028 * H, a.tip.z - 0.024 * H);
  for (const l of legs) low = Math.min(low, l.knee.z - 0.046 * H, l.ankle.z - 0.04 * H, l.toe.z - 0.032 * H);
  const up = v(0, 0, pose.lift * H - low);
  const raise = (p: V3) => add(p, up);

  return {
    height: H,
    L, U, F,
    chestL, chestU, chestF,
    headL, headU, headF,
    pelvis: raise(pelvis),
    chest: raise(chest),
    head: raise(head),
    arms: arms.map((a) => ({ shoulder: raise(a.shoulder), elbow: raise(a.elbow), wrist: raise(a.wrist), tip: raise(a.tip) })),
    legs: legs.map((l) => ({ hip: raise(l.hip), knee: raise(l.knee), ankle: raise(l.ankle), toe: raise(l.toe) })),
    face: pose.face,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mixDir(a: Dir, b: Dir, t: number): Dir {
  const na = Math.hypot(a[0], a[1], a[2]) || 1;
  const nb = Math.hypot(b[0], b[1], b[2]) || 1;
  return [lerp(a[0] / na, b[0] / nb, t), lerp(a[1] / na, b[1] / nb, t), lerp(a[2] / na, b[2] / nb, t)];
}
/** The short way round from one heading to another. */
function mixAngle(a: number, b: number, t: number) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Part of the way from one pose to another. */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    pitch: lerp(a.pitch, b.pitch, t),
    yaw: mixAngle(a.yaw, b.yaw, t),
    roll: lerp(a.roll, b.roll, t),
    lift: lerp(a.lift, b.lift, t),
    twist: lerp(a.twist, b.twist, t),
    spine: mixDir(a.spine, b.spine, t),
    head: [lerp(a.head[0], b.head[0], t), lerp(a.head[1], b.head[1], t), lerp(a.head[2], b.head[2], t)],
    armL: [mixDir(a.armL[0], b.armL[0], t), mixDir(a.armL[1], b.armL[1], t)],
    armR: [mixDir(a.armR[0], b.armR[0], t), mixDir(a.armR[1], b.armR[1], t)],
    legL: [mixDir(a.legL[0], b.legL[0], t), mixDir(a.legL[1], b.legL[1], t), mixDir(a.legL[2], b.legL[2], t)],
    legR: [mixDir(a.legR[0], b.legR[0], t), mixDir(a.legR[1], b.legR[1], t), mixDir(a.legR[2], b.legR[2], t)],
    face: {
      eyes: lerp(a.face.eyes, b.face.eyes, t),
      brows: lerp(a.face.brows, b.face.brows, t),
      mouth: lerp(a.face.mouth, b.face.mouth, t),
      smile: lerp(a.face.smile, b.face.smile, t),
      shades: lerp(a.face.shades, b.face.shades, t),
    },
  };
}

// ---- the poses ----

const FLAT = Math.PI / 2;
const mirror = ([l, u, f]: Dir): Dir => [-l, u, f];
const calm: Face = { eyes: 1, brows: 0, mouth: 0, smile: 0.2, shades: 1 };

/** Standing easy, facing down the screen. Everything else is told apart from this. */
export const STAND: Pose = {
  pitch: 0.04, yaw: 0, roll: 0, lift: 0, twist: 0,
  spine: [0, 1, 0.02],
  head: [0, 0.12, 0],
  armL: [[0.2, -0.97, 0.06], [0.12, -0.96, 0.24]],
  armR: [[-0.2, -0.97, 0.06], [-0.12, -0.96, 0.24]],
  legL: [[0.11, -0.99, 0.04], [0.02, -1, -0.05], [0.3, -0.06, 0.95]],
  legR: [[-0.11, -0.99, 0.04], [-0.02, -1, -0.05], [-0.3, -0.06, 0.95]],
  face: calm,
};

const pose = (changes: Partial<Pose>): Pose => ({ ...STAND, ...changes });

/** Flat on my back in the grass, arms and legs anywhere, sunglasses on. */
export const SLEEP = pose({
  pitch: FLAT, yaw: 0.1, spine: [0.03, 1, 0],
  head: [0.3, 0.04, 0.12],
  armL: [[0.93, 0.36, 0], [0.82, 0.57, 0.03]],
  armR: [[-0.95, 0.26, 0], [-0.5, 0.86, 0.04]],
  legL: [[0.3, -0.95, 0.02], [0.2, -0.98, -0.02], [0.82, -0.36, 0.44]],
  legR: [[-0.2, -0.98, 0.02], [-0.33, -0.94, -0.02], [-0.74, -0.42, 0.52]],
  face: { eyes: 0, brows: 0, mouth: 0.3, smile: 0, shades: 0 },
});

/** Awake where I lie: head up off the grass, sunglasses pushed back. */
export const AWAKE = pose({
  ...SLEEP,
  head: [0, 0.3, 0],
  armR: [[-0.84, 0.4, 0.36], [-0.22, 0.8, 0.56]],
  face: { eyes: 1, brows: 0.4, mouth: 0.25, smile: 0.9, shades: 1 },
});

/** The shock of it: clean off the ground, every limb stiff. */
export const SHOCK = pose({
  pitch: FLAT * 0.86, yaw: 0.04, lift: 0.3, spine: [0, 1, 0.1],
  head: [0, 0.36, 0],
  armL: [[0.72, 0.36, 0.6], [0.56, 0.6, 0.58]],
  armR: [[-0.72, 0.36, 0.6], [-0.56, 0.6, 0.58]],
  legL: [[0.42, -0.72, 0.56], [0.36, -0.9, 0.26], [0.5, -0.2, 0.84]],
  legR: [[-0.42, -0.72, 0.56], [-0.36, -0.9, 0.26], [-0.5, -0.2, 0.84]],
  face: { eyes: 1.4, brows: 1, mouth: 1, smile: -0.3, shades: 1 },
});

/** Down from the jump on hands and feet, about to bolt. */
export const SCRAMBLE = pose({
  pitch: -0.5, lift: 0, spine: [0, 1, 0.2],
  head: [0, 0.7, 0],
  armL: [[0.34, -0.7, 0.62], [0.12, -0.9, 0.42]],
  armR: [[-0.34, -0.7, 0.62], [-0.12, -0.9, 0.42]],
  legL: [[0.3, -0.42, 0.86], [0.1, -0.8, -0.6], [0.2, -0.3, 0.93]],
  legR: [[-0.26, -0.8, 0.54], [-0.1, -0.62, -0.78], [-0.2, -0.3, 0.93]],
  face: { eyes: 1.35, brows: 1, mouth: 0.8, smile: -0.3, shades: 1 },
});

/** Heels dug in at the end of the run. */
export const SKID = pose({
  pitch: 0.36, spine: [0, 1, -0.06],
  head: [0, 0.1, 0],
  armL: [[0.9, 0.12, 0.42], [0.78, 0.46, 0.42]],
  armR: [[-0.9, 0.12, 0.42], [-0.78, 0.46, 0.42]],
  legL: [[0.2, -0.76, 0.62], [0.12, -0.96, 0.26], [0.3, 0.3, 0.9]],
  legR: [[-0.16, -0.9, 0.42], [-0.1, -0.98, 0.16], [-0.3, 0.3, 0.9]],
  face: { eyes: 1.2, brows: 0.8, mouth: 0.5, smile: -0.2, shades: 1 },
});

/** Standing well back, hands half up, watching the sky. */
export const WATCH = pose({
  pitch: 0.1, spine: [0, 1, -0.04],
  head: [0, 0.78, 0],
  armL: [[0.34, -0.82, 0.46], [0.16, 0.42, 0.9]],
  armR: [[-0.34, -0.82, 0.46], [-0.16, 0.42, 0.9]],
  legL: [[0.16, -0.97, 0.16], [0.06, -0.99, -0.14], [0.34, -0.06, 0.94]],
  legR: [[-0.16, -0.97, 0.16], [-0.06, -0.99, -0.14], [-0.34, -0.06, 0.94]],
  face: { eyes: 1.3, brows: 0.9, mouth: 0.6, smile: -0.2, shades: 1 },
});

/** It landed: ducked, arms over my head, eyes shut. */
export const FLINCH = pose({
  pitch: -0.3, spine: [0, 1, 0.34],
  head: [0, -0.3, 0],
  armL: [[0.5, 0.56, 0.66], [-0.62, 0.62, 0.48]],
  armR: [[-0.5, 0.56, 0.66], [0.62, 0.62, 0.48]],
  legL: [[0.26, -0.66, 0.7], [0.1, -0.76, -0.64], [0.34, -0.1, 0.93]],
  legR: [[-0.26, -0.66, 0.7], [-0.1, -0.76, -0.64], [-0.34, -0.1, 0.93]],
  face: { eyes: 0, brows: -0.9, mouth: 0.15, smile: -0.5, shades: 1 },
});

/** Still alive. One forearm across my forehead. */
export const RELIEF = pose({
  pitch: 0.06,
  head: [0.1, 0.2, 0.06],
  armR: [[-0.42, 0.34, 0.84], [0.74, 0.62, 0.26]],
  face: { eyes: 0.5, brows: 0.3, mouth: 0.4, smile: 0.5, shades: 1 },
});

/** Sitting down in the grass, on the way to lying back. */
export const SIT = pose({
  pitch: 0.5, spine: [0, 1, 0.12],
  head: [0, 0.1, 0],
  armL: [[0.5, -0.76, -0.4], [0.3, -0.9, -0.3]],
  armR: [[-0.5, -0.76, -0.4], [-0.3, -0.9, -0.3]],
  legL: [[0.26, -0.3, 0.92], [0.12, -0.96, 0.24], [0.4, -0.2, 0.9]],
  legR: [[-0.26, -0.3, 0.92], [-0.12, -0.96, 0.24], [-0.4, -0.2, 0.9]],
  face: { eyes: 0.6, brows: 0, mouth: 0.9, smile: 0, shades: 1 },
});

/** One stride of a run: phase goes round once per two steps. panic: 0 pumping arms .. 1 arms in the air. */
export function run(phase: number, heading: number, panic: number): Pose {
  const leg = (side: number, at: number): [Dir, Dir, Dir] => {
    const thigh = 0.2 + 0.95 * Math.sin(at);
    // The knee folds as the leg comes through from behind, and straightens to land.
    const fold = 0.3 + 1.5 * Math.max(0, Math.sin(at - 1.25)) ** 1.2;
    const shin = thigh - fold;
    const foot = shin + 1.3;
    return [
      [side * 0.07, -Math.cos(thigh), Math.sin(thigh)],
      [side * 0.03, -Math.cos(shin), Math.sin(shin)],
      [side * 0.12, -Math.cos(foot), Math.sin(foot)],
    ];
  };
  const arm = (side: number, at: number): [Dir, Dir] => {
    const swing = 1.0 * Math.sin(at);
    const pumping: [Dir, Dir] = [
      [side * 0.24, -Math.cos(swing), Math.sin(swing)],
      [side * 0.02, -Math.cos(swing + 1.55), Math.sin(swing + 1.55)],
    ];
    const flail: [Dir, Dir] = [
      [side * (0.42 + 0.14 * Math.sin(at * 2)), 0.86, 0.16 + 0.22 * Math.sin(at * 2 + side)],
      [side * (0.1 + 0.34 * Math.sin(at * 3 + side * 1.3)), 0.94, 0.12],
    ];
    return [mixDir(pumping[0], flail[0], panic), mixDir(pumping[1], flail[1], panic)];
  };
  return {
    pitch: -0.3 + 0.1 * panic, yaw: heading, roll: 0.05 * Math.sin(phase), lift: 0.035 * Math.abs(Math.sin(phase)),
    twist: 0.28 * Math.sin(phase) * (1 - 0.6 * panic),
    spine: [0, 1, 0.1],
    head: [0, 0.34 + 0.2 * panic, 0],
    armL: arm(1, phase + Math.PI),
    armR: mirrorArm(arm(1, phase)),
    legL: leg(1, phase),
    legR: leg(-1, phase + Math.PI),
    face: { eyes: 1.3, brows: 1, mouth: 0.7 + 0.25 * Math.sin(phase * 2), smile: -0.3, shades: 1 },
  };
}

function mirrorArm([upper, fore]: [Dir, Dir]): [Dir, Dir] {
  return [mirror(upper), mirror(fore)];
}

/**
 * Lying down, one arm stretched out toward something on the ground: `angle` is its heading, and
 * `jab` (0..1) pokes the arm at it. The other hand rests on my stomach, so it's clear which is which.
 */
export function pointing(angle: number, jab = 0): Pose {
  // The arm on the side it's on does the pointing; headings are measured like `yaw`.
  const l = Math.sin(angle);
  const u = -Math.cos(angle);
  const reach: Dir = [l, u, 0.1 + 0.16 * jab];
  const left = l >= 0;
  const rest = (side: number): [Dir, Dir] => [[side * 0.5, -0.82, 0.2], [-side * 0.62, -0.64, 0.3]];
  return pose({
    ...AWAKE,
    head: [left ? 0.6 : -0.6, 0.34, 0],
    armL: left ? [reach, reach] : rest(1),
    armR: left ? rest(-1) : [reach, reach],
    face: { ...AWAKE.face, mouth: 0.5 },
  });
}
