import type { RandomSource } from './types';

const ZERO_SEED = 0x6d2b79f5;

export class SeededRng implements RandomSource {
  private current: number;

  constructor(seed: number) {
    this.current = (seed >>> 0) || ZERO_SEED;
  }

  get state(): number {
    return this.current;
  }

  int(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive safe integer');
    }

    let next = this.current;
    next ^= next << 13;
    next ^= next >>> 17;
    next ^= next << 5;
    this.current = next >>> 0;
    return this.current % maxExclusive;
  }
}
