import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import sharp from 'sharp';
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
              const width = Number(url.searchParams.get('w'));
              const height = Number(url.searchParams.get('h'));
              if (body.length !== width * height * 4) throw new HttpError(400, 'bad frame size');
              // Raw RGBA from readPixels, which is bottom-up.
              await sharp(body, { raw: { width, height, channels: 4 } })
                .flip()
                .removeAlpha()
                .png({ compressionLevel: 1 })
                .toFile(path.join(frames, `frame-${String(i).padStart(5, '0')}.png`));
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
              const formats = (url.searchParams.get('formats') ?? 'mp4,webm').split(',');
              const quality = (key: string, fallback: number) => {
                const value = Number(url.searchParams.get(key) ?? fallback);
                if (!Number.isInteger(value) || value < 10 || value > 63) throw new HttpError(400, `bad ${key}`);
                return String(value);
              };
              if (formats.includes('mp4')) {
                await run('ffmpeg', [
                  ...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', quality('crf', 30), '-pix_fmt', 'yuv420p',
                  ...gop, '-sc_threshold', '0', '-movflags', '+faststart', mp4,
                ]);
              }
              if (formats.includes('webm')) {
                await run('ffmpeg', [
                  ...input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', quality('vp9crf', 44), '-row-mt', '1',
                  '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', ...gop, webm,
                ]);
              }
              if (url.searchParams.get('keep') !== '1') await rm(frames, { recursive: true, force: true });
              const size = async (f: string) => `${((await stat(f)).size / 1e6).toFixed(2)} MB`;
              reply = Object.fromEntries(
                await Promise.all(
                  [...formats.map((f) => `${name}.${f}`), `${name}.jpg`].map(async (f) => [f, await size(path.join(OUT_DIR, f))]),
                ),
              );
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

const BOOK_DIR = path.resolve('public/book');
const PHOTO_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg']);

/**
 * Dev-only endpoints for the scrapbook editor (?edit): write the book back to
 * public/book/book.json, and take in photos dropped on a page. The site itself stays static.
 */
function bookPlugin(): Plugin {
  let backedUp = false;
  return {
    name: 'book-edit',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__book', async (req, res) => {
        try {
          if (req.method !== 'POST') throw new HttpError(405, 'POST only');
          // Only the editor page itself may write files: another site open in the same browser
          // can't set this header on a request to here.
          if (req.headers['x-book-edit'] !== '1') throw new HttpError(403, 'not from the editor');
          const site = req.headers['sec-fetch-site'];
          if (site && site !== 'same-origin') throw new HttpError(403, 'not from the editor');
          const url = new URL(req.url ?? '/', 'http://localhost');
          const body = await readBody(req);
          let reply: unknown = { ok: true };

          if (url.pathname === '/save') {
            if (body.length > 8e6) throw new HttpError(413, 'the book is too big');
            const book = JSON.parse(body.toString('utf8')) as { version?: number; sections?: unknown };
            if (book.version !== 1 || !Array.isArray(book.sections)) throw new HttpError(400, 'that is not a book');
            const file = path.join(BOOK_DIR, 'book.json');
            if (!backedUp) {
              // Keep the book as it was before this session's first save, out of the repo.
              await mkdir(FRAMES_ROOT, { recursive: true });
              await copyFile(file, path.join(FRAMES_ROOT, 'book.before-edit.json')).catch(() => {});
              backedUp = true;
            }
            await mkdir(BOOK_DIR, { recursive: true });
            await writeFile(file, `${JSON.stringify(book, null, 2)}\n`);
          } else if (url.pathname === '/photo') {
            if (!body.length || body.length > 12e6) throw new HttpError(413, 'that photo is too big');
            const given = path.basename(url.searchParams.get('name') ?? 'photo.jpg');
            const ext = path.extname(given).toLowerCase();
            if (!PHOTO_TYPES.has(ext)) throw new HttpError(400, 'not a kind of photo this takes');
            const stem = path.basename(given, path.extname(given)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
            const name = `${stem}-${createHash('sha1').update(body).digest('hex').slice(0, 8)}${ext}`;
            await mkdir(path.join(BOOK_DIR, 'photos'), { recursive: true });
            await writeFile(path.join(BOOK_DIR, 'photos', name), body);
            reply = { src: `book/photos/${name}` };
          } else {
            throw new HttpError(404, 'unknown');
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
  plugins: [capturePlugin(), bookPlugin()],
});
