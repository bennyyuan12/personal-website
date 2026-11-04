// The drawings are authored as clean paths; this redraws each line with a slightly unsteady hand.

const STEP = 5; // viewBox units between points along a line
const SHAKE = 1.05; // viewBox units

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261104);

/** A smooth wander along a line, different for every line. */
function hand() {
  const a = rand() * 6.28;
  const b = rand() * 6.28;
  return (s: number) => SHAKE * (0.65 * Math.sin(s / 21 + a) + 0.35 * Math.sin(s / 8.5 + b));
}

export function inkify(svg: SVGSVGElement) {
  for (const path of svg.querySelectorAll('path')) {
    const d = path.getAttribute('d') ?? '';
    let redrawn = '';
    for (const stroke of d.split(/(?=M)/).filter((part) => part.trim())) {
      path.setAttribute('d', stroke);
      const length = path.getTotalLength();
      const steps = Math.max(2, Math.round(length / STEP));
      const shakeX = hand();
      const shakeY = hand();
      const points: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const s = (i / steps) * length;
        const p = path.getPointAtLength(s);
        // Ends stay put on short lines, or they stop meeting what they're attached to.
        const hold = Math.min(1, length / 40);
        points.push(`${(p.x + shakeX(s) * hold).toFixed(1)} ${(p.y + shakeY(s) * hold).toFixed(1)}`);
      }
      redrawn += `M${points.join('L')}${/z\s*$/i.test(stroke) ? 'Z' : ''}`;
    }
    path.setAttribute('d', redrawn);
  }
}
