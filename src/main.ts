import { createApp } from './app';
import { createGui, type Stats } from './debug';
import { showFallback } from './fallback';
import { applyUrlParams, defaultParams } from './params';
import { AutoQuality, type Tier } from './quality';

function webgl2Available() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

async function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
  const params = defaultParams();
  applyUrlParams(params);

  const forceFallback = new URLSearchParams(location.search).has('fallback');
  if (forceFallback || !webgl2Available()) {
    showFallback(forceFallback ? 'forced by ?fallback' : 'WebGL2 is not available');
    return;
  }

  // Capture mode is a dev tool (it needs the dev server's ffmpeg endpoint); dropped from builds.
  const captureModule =
    import.meta.env.DEV && new URLSearchParams(location.search).has('capture') ? await import('./capture') : null;
  const capture = captureModule?.captureOptionsFromUrl() ?? null;
  if (capture) {
    params.paused = true;
    params.gui = false;
  }
  const startTier: Tier = params.quality === 'auto' ? 'high' : params.quality;

  let app;
  try {
    app = await createApp(canvas, params, { tier: startTier, preserveDrawingBuffer: !!capture });
  } catch (err) {
    console.error(err);
    showFallback('the renderer failed to start');
    return;
  }
  const renderer = app.renderer;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    showFallback('the WebGL context was lost');
  });

  await app.compile();

  if (captureModule && capture) {
    await captureModule.runCapture(app, params, capture);
    return;
  }

  // ---- render only when needed: the loop is playing, or something changed ----
  let dirty = true;
  const invalidate = () => {
    dirty = true;
  };
  window.addEventListener('resize', () => {
    app.resize();
    invalidate();
  });
  let visible = true;
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) invalidate();
  }).observe(canvas);

  // ---- quality: start high, step down while frames are slow ----
  const stats: Stats = { fps: 0, frameMs: 0, tier: app.tier };
  const onTier = (tier: Tier) => {
    app.setTier(tier);
    stats.tier = tier;
    invalidate();
  };
  let auto = params.quality === 'auto' ? new AutoQuality(app.tier, onTier) : null;

  // ---- loop clock: everything animated is a function of phase in [0, 1) ----
  let elapsedMs = params.phase * params.loopSeconds * 1000;
  let last = performance.now();

  if (params.gui) {
    const gui = createGui(params, stats, {
      resize: () => app.resize(),
      scrub: () => (elapsedMs = params.phase * params.loopSeconds * 1000),
      schools: () => app.setSchools(),
      ramp: () => void app.rebuildGlyphs().then(invalidate),
      quality: () => {
        if (params.quality === 'auto') {
          auto = new AutoQuality(app.tier, onTier);
        } else {
          auto = null;
          onTier(params.quality);
        }
      },
    });
    gui.onChange(invalidate);
  }

  renderer.setAnimationLoop((now: number) => {
    const dt = Math.min(now - last, 250);
    last = now;
    const loopMs = params.loopSeconds * 1000;
    if (!params.paused) {
      elapsedMs = (elapsedMs + dt) % loopMs;
      params.phase = elapsedMs / loopMs;
    }
    if (!visible || (params.paused && !dirty)) return;
    dirty = false;
    app.draw();

    stats.frameMs = stats.frameMs * 0.95 + dt * 0.05;
    stats.fps = 1000 / Math.max(stats.frameMs, 1e-3);
    if (auto && !params.paused) auto.sample(dt);
  });

  if (import.meta.env.DEV) {
    Object.assign(window, { __grass: { params, stats, app, renderer, draw: app.draw, ...app.debug } });
  }
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="error">${String(err)}</pre>`);
});
