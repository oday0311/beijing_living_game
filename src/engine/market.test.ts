import { describe, expect, it } from 'vitest';
import { classicContent } from '../content/classic';
import { modernContent } from '../content/modern';
import { stubPack, MaxRng, ScriptedRng, stateWith } from '../test/fixtures';
import { applyWeather } from './modern';
import { generateMarket, generateMarketWithAllPrices, inventoryCount } from './market';

const context = { day: 1, trends: [], weatherId: null };

describe('market generation', () => {
  it('uses the original exclusive upper price ranges on the final days', () => {
    const prices = generateMarket(classicContent, new MaxRng(), { ...context, day: 39 });
    expect(prices).toEqual({
      cigarettes: 449, cars: 29999, vcd: 54, liquor: 3499,
      book: 13999, toys: 849, phones: 1499, cosmetics: 244,
    });
  });

  it('takes three independent omission rolls, including duplicate results', () => {
    const rolls = new ScriptedRng(Array(11).fill(0));
    const prices = generateMarket(classicContent, rolls, context);
    expect(prices).toEqual({
      cars: 15000, vcd: 5, liquor: 1000, book: 5000,
      toys: 250, phones: 750, cosmetics: 65,
    });
    expect(rolls.state).toBe(11);
  });

  it('omits distinct goods when the three rolls differ', () => {
    const rolls = new ScriptedRng([...Array(8).fill(0), 0, 0.125, 0.25]);
    expect(generateMarket(classicContent, rolls, context)).toEqual({
      liquor: 1000, book: 5000, toys: 250, phones: 750, cosmetics: 65,
    });
  });

  it('keeps every good on day 39 and removes a computed zero price', () => {
    const pack = structuredClone(stubPack);
    pack.goods[0].basePrice = 0;
    pack.goods[0].priceRange = 1;
    expect(generateMarket(pack, new MaxRng(), { ...context, day: 39 }))
      .toEqual({ item_b: 59 });
  });

  it('retains omitted original prices without drawing additional random values', () => {
    const rng = new ScriptedRng(Array(11).fill(0.998));
    const { prices, allPrices } = generateMarketWithAllPrices(classicContent, rng, context);
    expect(prices.cosmetics).toBeUndefined();
    expect(allPrices.cosmetics).toBe(244);
    expect(rng.state).toBe(11);
  });

  it('applies the linked weather category trend once with station demand', () => {
    const pack = { ...modernContent, goods: [{ id: 'coffee-beans', name: 'Coffee', category: 'drink', basePrice: 80, priceRange: 1 }] };
    const state = applyWeather(stateWith({ locationId: 'haidianhuangzhuang' }),
      modernContent.weather.find(({ id }) => id === 'heat')!, modernContent);
    expect(generateMarket(pack, new MaxRng(), state)).toEqual({ 'coffee-beans': 140 });
  });
});

describe('inventory count', () => {
  it('sums quantities across lots, including zero quantities', () => {
    expect(inventoryCount(stateWith({ inventory: {
      cigarettes: { quantity: 3, averageCost: 100 },
      cars: { quantity: 0, averageCost: 15000 },
      vcd: { quantity: 5, averageCost: 10 },
    } }))).toBe(8);
  });
});
