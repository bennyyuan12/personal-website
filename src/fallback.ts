// Shown when WebGL2 is missing or the GPU context is lost: the pre-rendered loop video
// (made with ?capture), or its poster for reduced-motion users, or the grass image as a last resort.
// Nothing can blow this grass away, so it lies over the ground with holes already cut around
// everything that lives there.

const base = `${import.meta.env.BASE_URL}grass/`;

/** A place the grass doesn't cover, CSS px. */
export interface Hole {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Cuts the holes out of the grass. False if this browser can't, so the grass would hide everything. */
function cutHoles(el: HTMLElement, holes: Hole[]) {
  const layers = holes
    .map((h) => `radial-gradient(${h.rx}px ${h.ry}px at ${h.x}px ${h.y}px, transparent 72%, black 100%)`)
    .join(', ');
  const style = el.style as CSSStyleDeclaration & Record<string, string>;
  style.maskImage = layers;
  style.maskComposite = 'intersect';
  style.webkitMaskImage = layers;
  style.webkitMaskComposite = 'source-in';
  return !!style.maskImage || !!style.webkitMaskImage;
}

function stillImage() {
  const img = new Image();
  img.src = `${base}world.jpg`;
  img.alt = '';
  img.className = 'fallback';
  return img;
}

export function showFallback(reason: string, holes: () => Hole[]) {
  console.info(`[grass] showing the fallback: ${reason}`);
  const canvas = document.querySelector<HTMLCanvasElement>('#stage');
  if (canvas) canvas.style.display = 'none';
  if (document.querySelector('.fallback')) return;

  const name = window.innerHeight > window.innerWidth ? 'loop-portrait' : 'loop-landscape';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let el: HTMLElement;

  if (reducedMotion) {
    const img = new Image();
    img.src = `${base}${name}.jpg`;
    img.alt = '';
    img.addEventListener('error', () => img.replaceWith(stillImage()), { once: true });
    el = img;
  } else {
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.poster = `${base}${name}.jpg`;
    video.setAttribute('aria-hidden', 'true');
    for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) {
      const source = document.createElement('source');
      source.src = `${base}${name}.${ext}`;
      source.type = type;
      video.append(source);
    }
    // The last <source> erroring means none of them could play.
    video.lastElementChild!.addEventListener('error', () => video.replaceWith(stillImage()), { once: true });
    el = video;
  }
  el.classList.add('fallback');
  document.body.prepend(el);
  const fit = () => {
    if (!cutHoles(el, holes())) el.remove();
  };
  fit();
  window.addEventListener('resize', fit);
}
