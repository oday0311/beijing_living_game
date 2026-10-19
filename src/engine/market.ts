import type { ContentPack } from '../content/contract';
import type { GameState, RandomSource } from './types';

export type MarketContext = Pick<GameState, 'day' | 'trends' | 'weatherId'>;

export function generateMarketWithAllPrices(
  pack: ContentPack,
  rng: RandomSource,
  context: MarketContext,
): { prices: Record<string, number>; allPrices: Record<string, number> } {
  const prices: Record<string, number> = {};
  for (const good of pack.goods) {
    prices[good.id] = good.basePrice + rng.int(good.priceRange);
  }
  const allPrices = { ...prices };

  if (pack.mode === 'classic' && context.day < 39 && pack.goods.length > 0) {
    for (let roll = 0; roll < 3; roll += 1) {
      delete prices[pack.goods[rng.int(pack.goods.length)].id];
    }
  }

  for (const [id, price] of Object.entries(prices)) {
    if (price === 0) delete prices[id];
  }
  for (const [id, price] of Object.entries(allPrices)) {
    if (price === 0) delete allPrices[id];
  }
  return { prices, allPrices };
}

export function generateMarket(
  pack: ContentPack,
  rng: RandomSource,
  context: MarketContext,
): Record<string, number> {
  return generateMarketWithAllPrices(pack, rng, context).prices;
}

export function inventoryCount(state: GameState): number {
  return Object.values(state.inventory).reduce((total, lot) => total + lot.quantity, 0);
}
