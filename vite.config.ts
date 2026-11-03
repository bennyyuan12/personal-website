import { spawn } from 'node:child_process';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const OUT_DIR = path.resolve('public/grass');
const FRAMES_ROOT = path.resolve('.capture');

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr}`))));
  });
}

/**
 * Dev-only endpoints for ?capture mode: receive PNG frames, then encode the loop with ffmpeg
 * into public/grass/<name>.mp4 (H.264) and .webm (VP9), plus a JPEG poster.
 */
function capturePlugin(): Plugin {
  return {
    name: 'grass-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', async (req, res) => {
        try {
          if (req.method !== 'POST') throw new HttpError(405, 'POST only');
          const url = new URL(req.url ?? '/', 'http://localhost');
          const name = url.searchParams.get('name') ?? '';
          if (!/^loop-[a-z0-9-]{1,32}$/.test(name)) throw new HttpError(400, 'bad name');
          const frames = path.join(FRAMES_ROOT, name);
          const body = await readBody(req);
          let reply: unknown = { ok: true };

          switch (url.pathname) {
            case '/begin':
              await rm(frames, { recursive: true, force: true });
              await mkdir(frames, { recursive: true });
              break;
            case '/frame': {
              const i = Number(url.searchParams.get('i'));
              if (!Number.isInteger(i) || i < 0 || i > 99999) throw new HttpError(400, 'bad frame index');
              await writeFile(path.join(frames, `frame-${String(i).padStart(5, '0')}.png`), body);
              break;
            }
            case '/poster':
              await writeFile(path.join(OUT_DIR, `${name}.jpg`), body);
              break;
            case '/encode': {
              const fps = Number(url.searchParams.get('fps'));
              if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new HttpError(400, 'bad fps');
              const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, 'frame-%05d.png')];
              const mp4 = path.join(OUT_DIR, `${name}.mp4`);
              const webm = path.join(OUT_DIR, `${name}.webm`);
              // One keyframe per loop. Every keyframe re-rolls the compression noise on the fine
              // glyph detail, which shows as a shimmer; with a single one it lands on the loop seam.
              const count = (await readdir(frames)).filter((f) => f.endsWith('.png')).length;
              const gop = ['-g', String(count), '-keyint_min', String(count)];
              await run('ffmpeg', [
                ...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
                ...gop, '-sc_threshold', '0', '-movflags', '+faststart', mp4,
              ]);
              await run('ffmpeg', [
                ...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1',
                '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', ...gop, webm,
              ]);
              if (url.searchParams.get('keep') !== '1') await rm(frames, { recursive: true, force: true });
              const size = async (f: string) => `${((await stat(f)).size / 1e6).toFixed(2)} MB`;
              reply = {
                [path.basename(mp4)]: await size(mp4),
                [path.basename(webm)]: await size(webm),
                [`${name}.jpg`]: await size(path.join(OUT_DIR, `${name}.jpg`)),
              };
              break;
            }
            default:
              throw new HttpError(404, 'unknown capture step');
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(reply));
        } catch (err) {
          res.statusCode = err instanceof HttpError ? err.status : 500;
          res.end(err instanceof Error ? err.message : String(err));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [capturePlugin()],
});
