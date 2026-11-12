// What the book is made of. A page is a fixed sheet, 1000 units wide and 1370 tall, with things
// stuck onto it wherever they were put: this is a scrapbook, so nothing flows.

export const PAGE_WIDTH = 1000;
export const PAGE_HEIGHT = 1370;

export type TextStyle = 'title' | 'heading' | 'body' | 'note' | 'caption' | 'label' | 'stamp' | 'code';
export type Backing = 'none' | 'sticky' | 'card' | 'torn' | 'kraft' | 'dymo';
export type Ink = 'ink' | 'red' | 'blue' | 'green' | 'white';
export type Paper = 'plain' | 'lined' | 'grid' | 'dots' | 'kraft';
export type Frame = 'polaroid' | 'print' | 'taped' | 'none';

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
}

export interface StickerItem extends Placed {
  type: 'sticker';
  /** A drawing from stickers.ts. */
  art: string;
  h: number;
  ink?: Ink;
  /** Drawn on a white card and taped down, like a photo. */
  card?: boolean;
}

export type Item = TextItem | PhotoItem | StickerItem;

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
  sections: Section[];
}
