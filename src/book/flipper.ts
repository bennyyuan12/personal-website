// A page in the air. Paper bends as it turns, so the page is cut into strips, each hinged on the
// one before it: the free edge runs ahead of the spine and the page arcs over, the way it does when
// it's lifted by its edge. One of these can also stand for a whole block of pages turned together.

const BEND = 0.2; // how far ahead of the spine the free edge runs, as a share of the turn
const SHADE = 0.42; // how dark a page gets when it faces away from the light

interface Strip {
  el: HTMLElement;
  front: HTMLElement;
  back: HTMLElement;
}

function div(className: string) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

export class Flipper {
  readonly el = div('flipper');
  private readonly strips: Strip[] = [];
  /** Whatever is stuck to the free edge, seen from each side. Nothing clips these. */
  private readonly edgeFront = div('edge front');
  private readonly edgeBack = div('edge back');
  private loaded = false;

  constructor(private readonly count: number) {
    this.el.style.setProperty('--strips', `${count}`);
    let parent = this.el;
    for (let i = 0; i < count; i++) {
      const el = div('strip');
      el.style.setProperty('--i', `${i}`);
      const front = div('face front');
      const back = div('face back');
      el.append(front, back);
      parent.append(el);
      parent = el;
      this.strips.push({ el, front, back });
    }
    parent.append(this.edgeFront, this.edgeBack);
    this.el.hidden = true;
  }

  /**
   * front: the page that faces up while this lies on the right. back: the one that faces up once
   * it's over on the left. tags: anything stuck to its free edge, front and back.
   */
  load(front: HTMLElement, back: HTMLElement, thickness: number, tags: [HTMLElement, HTMLElement][] = []) {
    this.unload();
    for (const strip of this.strips) {
      for (const [face, page] of [[strip.front, front], [strip.back, back]] as const) {
        const slice = div('slice');
        const copy = page.cloneNode(true) as HTMLElement;
        copy.inert = true;
        slice.append(copy);
        face.replaceChildren(slice, div('shading'));
      }
    }
    for (const [onFront, onBack] of tags) {
      this.edgeFront.append(onFront);
      this.edgeBack.append(onBack);
    }
    this.el.dataset.thick = `${Math.min(6, Math.max(1, thickness))}`;
    this.el.hidden = false;
    this.loaded = true;
  }

  unload() {
    if (!this.loaded) return;
    for (const strip of this.strips) {
      strip.front.replaceChildren();
      strip.back.replaceChildren();
    }
    this.edgeFront.replaceChildren();
    this.edgeBack.replaceChildren();
    this.el.hidden = true;
    this.loaded = false;
  }

  /**
   * p: 0 lying on the right .. 1 lying on the left. forward: which way it's travelling, since the
   * free edge leads whichever way that is. Returns the angle at the middle of the page.
   */
  set(p: number, forward: boolean) {
    const n = this.count;
    const angle = (s: number) => {
      // s: 0 at the spine .. 1 at the free edge
      const q = p * (1 + BEND) - BEND * (forward ? 1 - s : s);
      return Math.PI * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, q))));
    };
    const frontDark = (a: number) => (SHADE * (1 - Math.cos(a))) / 2;
    const backDark = (a: number) => (SHADE * (1 + Math.cos(a))) / 2;
    let before = 0;
    for (let i = 0; i < n; i++) {
      const strip = this.strips[i];
      const a = angle((i + 0.5) / n);
      strip.el.style.transform = `rotateY(${(before - a).toFixed(4)}rad)`;
      before = a;
      const inner = angle(i / n);
      const outer = angle((i + 1) / n);
      // Shaded continuously across the strips, so the bend reads as a curve and not as facets.
      strip.front.style.setProperty('--d0', frontDark(inner).toFixed(3));
      strip.front.style.setProperty('--d1', frontDark(outer).toFixed(3));
      strip.back.style.setProperty('--d0', backDark(outer).toFixed(3));
      strip.back.style.setProperty('--d1', backDark(inner).toFixed(3));
    }
    return angle(0.5);
  }
}
