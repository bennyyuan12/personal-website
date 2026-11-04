// Capture mode: render every frame of the loop at a fixed size and hand them to the dev
// server, which encodes them with ffmpeg (see vite.config.ts).
//
//   /?capture=landscape            1280×720, 30 fps → public/grass/loop-landscape.{mp4,webm,jpg}
//   /?capture=portrait&fps=60      720×1280, 60 fps → public/grass/loop-portrait.{mp4,webm,jpg}
//   &w=…&h=…                       custom size
//   /?capture=test&frames=90&keep=1  short test → loop-test.*; keep the PNG frames in .capture/
//   &formats=mp4                   skip the slower WebM encode
//   &start=0.3                     begin at this point in the loop (0..1)
//   &crf=34&vp9crf=50              compression; higher is smaller
//
// Frames are taken at phase i / N for i = 0 … N−1, so the video loops seamlessly.

import type { App } from './app';
import type { Params } from './params';

export interface CaptureOptions {
  name: string;
  width: number;
  height: number;
  fps: number;
  /** Stop after this many frames (for quick encoder tests); default: the whole loop. */
  frames?: number;
  /** Keep the PNG frames in .capture/ after encoding. */
  keep: boolean;
  /** Only encode these containers; default both. */
  formats: string;
  /** Where in the loop to begin, 0..1. */
  start: number;
  /** Encoder settings passed through as they are, e.g. "&crf=34&vp9crf=50". */
  encoder: string;
}

export interface CaptureResult {
  done: boolean;
  error: string | null;
  files: unknown;
}

export function captureOptionsFromUrl(): CaptureOptions | null {
  const q = new URLSearchParams(location.search);
  const mode = q.get('capture');
  if (mode === null) return null;
  const portrait = mode === 'portrait';
  return {
    // The mode names the output: loop-landscape, loop-portrait, or e.g. loop-test for experiments.
    name: `loop-${/^[a-z0-9-]{1,24}$/.test(mode) ? mode : 'landscape'}`,
    width: Math.round(Number(q.get('w')) || (portrait ? 720 : 1280)),
    height: Math.round(Number(q.get('h')) || (portrait ? 1280 : 720)),
    fps: Math.round(Number(q.get('fps')) || 30),
    frames: Number(q.get('frames')) || undefined,
    keep: q.get('keep') === '1',
    formats: q.get('formats') ?? 'mp4,webm',
    start: Number(q.get('start')) || 0,
    encoder: ['crf', 'vp9crf'].filter((k) => q.has(k)).map((k) => `&${k}=${q.get(k)}`).join(''),
  };
}

async function post(path: string, body?: BodyInit) {
  const res = await fetch(path, { method: 'POST', body });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), type, quality),
  );
}

export async function runCapture(app: App, params: Params, opts: CaptureOptions) {
  const status = document.createElement('pre');
  status.className = 'capture-status';
  document.body.append(status);
  const say = (msg: string) => (status.textContent = msg);
  const result: CaptureResult = { done: false, error: null, files: null };
  Object.assign(window, { __capture: result });

  try {
    app.setFixedViewport({ width: opts.width, height: opts.height, dpr: 1 });
    // Start on the sheet's repeating cycle, so the end of the capture meets its beginning.
    params.phase = opts.start;
    app.settle(params.loopSeconds + 8);
    const canvas = app.renderer.domElement;
    const gl = app.renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    const loopFrames = Math.round(params.loopSeconds * opts.fps);
    const frames = Math.min(loopFrames, opts.frames ?? loopFrames);
    const q = `name=${opts.name}`;

    await post(`/__capture/begin?${q}`);
    for (let i = 0; i < frames; i++) {
      params.phase = (opts.start + i / loopFrames) % 1;
      app.advance(1 / opts.fps);
      app.draw();
      // Raw pixels: the browser's PNG encoder is throttled when the page isn't visible.
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      await post(`/__capture/frame?${q}&i=${i}&w=${width}&h=${height}`, pixels);
      if (i === 0) await post(`/__capture/poster?${q}`, await toBlob(canvas, 'image/jpeg', 0.88));
      say(`capturing ${opts.name} ${opts.width}×${opts.height}: frame ${i + 1}/${frames}`);
    }
    say(`encoding ${opts.name} with ffmpeg…`);
    result.files = await (await post(`/__capture/encode?${q}&fps=${opts.fps}&keep=${opts.keep ? 1 : 0}&formats=${opts.formats}${opts.encoder}`)).json();
    say(`done\n${JSON.stringify(result.files, null, 2)}`);
  } catch (err) {
    result.error = String(err);
    say(`capture failed: ${String(err)}\n(capture needs the dev server: npm run dev)`);
  }
  result.done = true;
}
