# Benny Yuan's personal website

A field of ASCII grass with me asleep in it. Blow the grass aside to find me, or the red button
hiding nearby. Press the button (or use the links at the top) and a scrapbook falls out of the sky.

## Run it

```bash
npm install
npm run dev
```

## Edit the scrapbook

```bash
npm run edit
```

This opens the site with an editor beside the book. Click something to select it, drag to move it,
use the dots to turn or resize it, and double-click words to rewrite them. The panel adds text,
photos, stickers, pages and sections. Photos can also be dropped straight onto a page.

**Save** writes the book to `public/book/book.json` and photos to `public/book/photos/`. Nothing is
live until those files are committed and the site is deployed. The book as it was before a
session's first save is kept in `.capture/book.before-edit.json`.

The editor only exists on the dev server. It isn't part of the built site.

`npm run seed` lays the book out again from scratch (`tools/seed-book.ts`). It refuses to replace an
existing book unless run as `npm run seed -- --force`.

## Build it

```bash
npm run build
npm run preview
```

The site is static: everything in `dist/` can be hosted anywhere.

## Where things are

| Path | What it is |
|---|---|
| `src/app.ts`, `src/shaders/` | The grass: blades, wind, air from the pointer, the ASCII pass |
| `src/scene.ts` | What's in the grass, and what happens when the book comes down |
| `src/me/` | Me: a posable skeleton (`rig.ts`), how it's drawn (`draw.ts`), how it moves (`actor.ts`) |
| `src/book/` | The book: pages, page turning, tags, the editor |
| `public/book/` | The book's contents and photos |
| `tools/` | Baking the grass, capturing the fallback videos, seeding the book |
