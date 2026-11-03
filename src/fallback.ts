// Shown when WebGL2 is missing or the GPU context is lost: the pre-rendered loop video
// (made with ?capture), or its poster for reduced-motion users, or the photo as a last resort.

const base = `${import.meta.env.BASE_URL}grass/`;

function photoImage() {
  const img = new Image();
  img.src = `${base}photo.jpg`;
  img.alt = '';
  img.className = 'fallback';
  return img;
}

export function showFallback(reason: string) {
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
    img.addEventListener('error', () => img.replaceWith(photoImage()), { once: true });
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
    video.lastElementChild!.addEventListener('error', () => video.replaceWith(photoImage()), { once: true });
    el = video;
  }
  el.classList.add('fallback');
  document.body.prepend(el);
}
