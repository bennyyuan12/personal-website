// What the book is made of. A page is a fixed sheet, 1000 units wide and 1370 tall, with things
// stuck onto it wherever they were put: this is a scrapbook, so nothing flows.

export const PAGE_WIDTH = 1000;
export const PAGE_HEIGHT = 1370;

export type TextStyle = 'title' | 'heading' | 'body' | 'note' | 'caption' | 'label' | 'stamp' | 'code';
export type Backing = 'none' | 'sticky' | 'card' | 'torn' | 'kraft' | 'dymo' | 'boxed';
/** What a carded sticker is drawn on. */
export type Scrap = 'white' | 'kraft' | 'graph';
export type Ink = 'ink' | 'red' | 'blue' | 'green' | 'white';
export type Paper = 'plain' | 'lined' | 'grid' | 'dots' | 'kraft';
export type Frame = 'polaroid' | 'print' | 'taped' | 'none' | 'sticker' | 'stamp' | 'torn';
/** What a photo is cut to. Unset: its own rectangle, or for a cut-out PNG, its own outline. */
export type Shape = 'rect' | 'rounded' | 'circle' | 'heart' | 'star' | 'arch' | 'scallop';
/** A torn scrap of paper something's stuck on. */
export type BackPaper = 'pink' | 'cream' | 'kraft' | 'blue' | 'mustard' | 'grid' | 'print';
/** How a photo's printed. Unset: in color. */
export type Tone = 'mono' | 'old' | 'sepia' | 'faded';
export type CollageLayout = 'grid' | 'mosaic' | 'strip' | 'film';

interface Placed {
  id: string;
  /** Top left corner and width, in page units. */
  x: number;
  y: number;
  w: number;
  /** Degrees, clockwise. */
  rot?: number;
  /** The id of a page this flips to when it's clicked. */
  goto?: string;
}

export interface TextItem extends Placed {
  type: 'text';
  style: TextStyle;
  /** Simple HTML: bold, italic, marks, lists, links, line breaks. `{{page}}` is the number of the page `goto` leads to. */
  html: string;
  /** 1 is the style's own size. */
  size?: number;
  ink?: Ink;
  align?: 'left' | 'center' | 'right';
  backing?: Backing;
  /** A font from fonts.ts in place of the style's own. */
  font?: string;
}

export interface PhotoItem extends Placed {
  type: 'photo';
  /** Path under the site root. Empty: a slot waiting for a photo, only shown while editing. */
  src: string;
  h: number;
  frame: Frame;
  caption?: string;
  alt?: string;
  /** Which part of the photo stays in view when the frame crops it, in percent. */
  focus?: [number, number];
  shape?: Shape;
  /** Cut out with scissors: the line cut along, as points in the photo (0 to 1 across and down). */
  cut?: [number, number][];
  /** Torn by hand rather than cut clean. */
  edge?: 'torn';
  /** A torn scrap of paper behind it. */
  paper?: BackPaper;
  tone?: Tone;
  /** Which tape a taped print is stuck down with, from stickers.ts. */
  tape?: string;
}

export interface CollagePhoto {
  src: string;
  /** Width over height of the photo itself. */
  ratio: number;
  focus?: [number, number];
  alt?: string;
}

/** Several photos printed or stuck together, moved and sized as one. */
export interface CollageItem extends Placed {
  type: 'collage';
  layout: CollageLayout;
  photos: CollagePhoto[];
  h: number;
  caption?: string;
}

export interface StickerItem extends Placed {
  type: 'sticker';
  /** A drawing from stickers.ts. */
  art: string;
  h: number;
  ink?: Ink;
  /** Drawn on a scrap of paper and stuck in, like a photo. */
  card?: boolean;
  /** Which paper the scrap is. Unset: white. */
  on?: Scrap;
  /** A peel-off sticker: a white die-cut edge all the way round. */
  cut?: boolean;
}

export type Item = TextItem | PhotoItem | StickerItem | CollageItem;

export interface Page {
  /** Also the page's address: the site's URL ends in #<id> while it's open. */
  id: string;
  /** What the editor's page list calls it. */
  name?: string;
  paper?: Paper;
  items: Item[];
}

export interface Section {
  id: string;
  title: string;
  /** What's written on its tag, or null for no tag. */
  tab: string | null;
  color: string;
  pages: Page[];
}

export interface BookData {
  version: 1;
  /** Fonts for every title and every heading in the book, from fonts.ts. Unset: the pen everything else is in. */
  fonts?: { title?: string; heading?: string };
  sections: Section[];
}
