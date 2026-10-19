import type { ContentPack } from '../content/contract';
import type { GameState, RandomSource } from './types';

export type MarketContext = Pick<GameState, 'day' | 'trends' | 'weatherId'>;

export function generateMarket(
  pack: ContentPack,
  rng: RandomSource,
  context: MarketContext,
): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const good of pack.goods) {
    prices[good.id] = good.basePrice + rng.int(good.priceRange);
  }

  if (pack.mode === 'classic' && context.day < 39 && pack.goods.length > 0) {
    for (let roll = 0; roll < 3; roll += 1) {
      delete prices[pack.goods[rng.int(pack.goods.length)].id];
    }
  }

  for (const [id, price] of Object.entries(prices)) {
    if (price === 0) delete prices[id];
  }
  return prices;
}

export function inventoryCount(state: GameState): number {
  return Object.values(state.inventory).reduce((total, lot) => total + lot.quantity, 0);
}
