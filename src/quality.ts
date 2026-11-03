export type Quality = 'auto' | 'high' | 'medium' | 'low';
export type Tier = Exclude<Quality, 'auto'>;

export interface TierSettings {
  /** Fraction of blades drawn (thinned blades are drawn wider to keep coverage). */
  density: number;
  /** Segments per blade strip. */
  segments: number;
  /** Highest device pixel ratio used for the ASCII pass. */
  dprCap: number;
  /** Highest resolution of the blade pass, as a multiple of CSS px. */
  bladeScale: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  high: { density: 1, segments: 4, dprCap: 2, bladeScale: 1.5 },
  medium: { density: 0.55, segments: 3, dprCap: 2, bladeScale: 1 },
  low: { density: 0.3, segments: 2, dprCap: 1.5, bladeScale: 0.75 },
};

const ORDER: Tier[] = ['high', 'medium', 'low'];

/**
 * Steps the quality tier down while the median frame time stays over budget.
 * Samples are taken only from frames that were actually drawn while visible.
 */
export class AutoQuality {
  private samples: number[] = [];
  private warmup = 30;
  done = false;

  constructor(
    public tier: Tier,
    private readonly onChange: (tier: Tier) => void,
    private readonly budgetMs = 20,
  ) {}

  sample(frameMs: number) {
    if (this.done) return;
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    this.samples.push(frameMs);
    if (this.samples.length < 60) return;

    const median = [...this.samples].sort((a, b) => a - b)[this.samples.length >> 1];
    this.samples = [];
    const i = ORDER.indexOf(this.tier);
    if (median > this.budgetMs && i < ORDER.length - 1) {
      this.tier = ORDER[i + 1];
      this.warmup = 30;
      this.onChange(this.tier);
    } else {
      this.done = true;
    }
  }
}
