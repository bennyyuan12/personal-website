// One pen for everything written by hand (an architect's capitals) and a typewriter for what's typed on torn paper,
// plus a shelf of others any piece of writing can be switched to in the editor.
import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-400-italic.css';
import '@fontsource/courier-prime/latin-700.css';
import '@fontsource/permanent-marker/latin-400.css';
import '@fontsource/caveat/latin-500.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/special-elite/latin-400.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/dm-serif-display/latin-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/archivo-black/latin-400.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/kalam/latin-400.css';
import '@fontsource/kalam/latin-700.css';
import '@fontsource/gloria-hallelujah/latin-400.css';
import '@fontsource/architects-daughter/latin-400.css';

export interface Font {
  label: string;
  family: string;
  weight: number;
  /** Line height that suits it for big type. */
  leading: number;
  /** Some faces run small or large for their size: this evens them out. */
  scale?: number;
  caps?: boolean;
}

/** Keys are what's stored in the book, so they never change. */
export const FONTS: Record<string, Font> = {
  architect: { label: 'Architect’s capitals (the book’s pen)', family: "'Architects Daughter', 'Bradley Hand', cursive", weight: 400, leading: 1.14, scale: 0.89, caps: true },
  marker: { label: 'Marker', family: "'Permanent Marker', 'Marker Felt', cursive", weight: 400, leading: 1.02 },
  'instrument-serif': { label: 'Instrument Serif (elegant)', family: "'Instrument Serif', Georgia, serif", weight: 400, leading: 1, scale: 1.12 },
  fraunces: { label: 'Fraunces (soft serif)', family: "'Fraunces', Georgia, serif", weight: 600, leading: 1.02 },
  'dm-serif': { label: 'DM Serif Display', family: "'DM Serif Display', Georgia, serif", weight: 400, leading: 1.02 },
  playfair: { label: 'Playfair Display', family: "'Playfair Display', Georgia, serif", weight: 700, leading: 1.04 },
  'space-grotesk': { label: 'Space Grotesk (modern)', family: "'Space Grotesk', system-ui, sans-serif", weight: 600, leading: 1.04 },
  bricolage: { label: 'Bricolage Grotesque', family: "'Bricolage Grotesque', system-ui, sans-serif", weight: 700, leading: 1.02 },
  'archivo-black': { label: 'Archivo Black (poster)', family: "'Archivo Black', Impact, sans-serif", weight: 400, leading: 1.02, scale: 0.92 },
  bebas: { label: 'Bebas Neue (tall)', family: "'Bebas Neue', Impact, sans-serif", weight: 400, leading: 0.96, scale: 1.22, caps: true },
  typewriter: { label: 'Typewriter', family: "'Courier Prime', 'Courier New', monospace", weight: 700, leading: 1.1, scale: 0.9 },
  'old-typewriter': { label: 'Old typewriter', family: "'Special Elite', 'Courier New', monospace", weight: 400, leading: 1.08, scale: 0.9 },
  pen: { label: 'Pen (Caveat)', family: "'Caveat', 'Bradley Hand', cursive", weight: 700, leading: 0.98, scale: 1.16 },
  kalam: { label: 'Neat handwriting (Kalam)', family: "'Kalam', 'Bradley Hand', cursive", weight: 700, leading: 1.04 },
  doodle: { label: 'Doodle handwriting', family: "'Gloria Hallelujah', 'Comic Sans MS', cursive", weight: 400, leading: 1.08, scale: 0.88 },
  'doodle-caps': { label: 'Doodle handwriting, capitals', family: "'Gloria Hallelujah', 'Comic Sans MS', cursive", weight: 400, leading: 1.12, scale: 0.8, caps: true },
};

/** CSS for a font, as custom properties a text item reads. */
export function fontVars(prefix: string, key: string | undefined) {
  const font = key ? FONTS[key] : undefined;
  if (!font) return {};
  return {
    [`--${prefix}-family`]: font.family,
    [`--${prefix}-weight`]: `${font.weight}`,
    [`--${prefix}-leading`]: `${font.leading}`,
    [`--${prefix}-scale`]: `${font.scale ?? 1}`,
    [`--${prefix}-case`]: font.caps ? 'uppercase' : 'none',
  };
}
