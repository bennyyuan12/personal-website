import { createApp, type App } from './app';
import { createGui, type Stats } from './debug';
import { showFallback } from './fallback';
import { applyUrlParams, defaultParams } from './params';
import { createPresetBar } from './presets';
import { AutoQuality, type Tier } from './quality';
import { Scene } from './scene';

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

  const scene = new Scene(document.querySelector<HTMLElement>('#ground')!, document.querySelector<HTMLElement>('#notes')!);
  window.addEventListener(
    'pointermove',
    (e) => scene.pointer(e.clientX, e.clientY, e.pointerType !== 'mouse'),
    { passive: true },
  );
  const pointerGone = (touch = false) => scene.pointer(null, 0, touch);
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') pointerGone(true);
  });
  document.documentElement.addEventListener('pointerleave', () => pointerGone());
  window.addEventListener('blur', () => pointerGone());

  /** No grass to render: the video stands in for it, and the ground can't stay covered. */
  function fallBack(reason: string) {
    showFallback(reason, () => scene.holes());
    scene.uncoverAll();
    window.addEventListener('resize', () => scene.layout());
    document.body.classList.add('ready');
    let last = performance.now();
    const loop = (now: number) => {
      scene.tick(Math.min(now - last, 250) / 1000);
      last = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  const forceFallback = new URLSearchParams(location.search).has('fallback');
  if (forceFallback || !webgl2Available()) {
    fallBack(forceFallback ? 'forced by ?fallback' : 'WebGL2 is not available');
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

  let app: App;
  try {
    app = await createApp(canvas, params, { tier: startTier, preserveDrawingBuffer: !!capture });
  } catch (err) {
    console.error(err);
    fallBack('the renderer failed to start');
    return;
  }
  const renderer = app.renderer;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    fallBack('the WebGL context was lost');
  });

  await app.compile();

  if (captureModule && capture) {
    await captureModule.runCapture(app, params, capture);
    return;
  }

  // Lay things in the grass, then let the wind work on the field, so it opens already blown about.
  scene.connect({
    hold: (slot, hold) => {
      app.setHold(slot, hold);
      invalidate();
    },
    place: (objects, paint) => app.place(objects, paint),
    get reach() {
      return params.touchRadius * app.worldHeightCss;
    },
  });
  app.settle(24);

  // ---- render only when needed: the loop is playing, or something changed ----
  // After a change the grass needs a moment to settle into its new shape.
  let awakeSeconds = 5;
  const invalidate = () => {
    awakeSeconds = 5;
  };
  window.addEventListener('resize', () => {
    app.resize();
    scene.layout();
    invalidate();
  });
  let visible = true;
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) invalidate();
  }).observe(canvas);

  // ---- the mouse is wind ----
  window.addEventListener('pointermove', (e) => app.pointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') app.pointer(null);
  });
  document.documentElement.addEventListener('pointerleave', () => app.pointer(null));
  window.addEventListener('blur', () => app.pointer(null));

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

  let gui: ReturnType<typeof createGui> | null = null;
  if (params.gui) {
    gui = createGui(params, stats, {
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
    createPresetBar(params, () => {
      invalidate();
      gui?.controllersRecursive().forEach((c) => c.updateDisplay());
    });
  }

  /** One frame of the app, given the time since the last one. */
  function tick(dt: number) {
    scene.tick(dt / 1000);
    const loopMs = params.loopSeconds * 1000;
    if (!params.paused) {
      elapsedMs = (elapsedMs + dt) % loopMs;
      params.phase = elapsedMs / loopMs;
    }
    if (!visible || (params.paused && awakeSeconds <= 0 && !app.pointerActive)) return;
    awakeSeconds -= dt / 1000;
    app.advance(dt / 1000);
    app.draw();

    stats.frameMs = stats.frameMs * 0.95 + dt * 0.05;
    stats.fps = 1000 / Math.max(stats.frameMs, 1e-3);
    if (auto && !params.paused) auto.sample(dt);
  }

  renderer.setAnimationLoop((now: number) => {
    const dt = Math.min(now - last, 250);
    last = now;
    tick(dt);
    document.body.classList.add('ready'); // the grass is up, so the ground can't be seen uncovered
  });

  if (import.meta.env.DEV) {
    Object.assign(window, { __grass: { params, stats, app, renderer, scene, draw: app.draw, tick, ...app.debug } });
  }
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="error">${String(err)}</pre>`);
});
