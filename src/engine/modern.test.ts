import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { modernContent } from '../content/modern';
import { createGame } from './create-game';
import { modernState, ScriptedRng, stubPack, trend } from '../test/fixtures';
import { settleDay, travel } from './day-cycle';
import { generateMarket } from './market';
import { applyEvent, applyIdentity, applyTrends, applyWeather, borrowModern, creditTerms, moveCredit, settleWallet, travelCost } from './modern';
import { SeededRng } from './rng';
import { repayDebt } from './services';
import { buy, transfer } from './transactions';

describe('modern mechanics', () => {
  it('clamps stacked trends and applies only active targets', () => {
    expect(applyTrends(100, 'leisure', [
      trend({ category: 'leisure', multiplier: 3, daysLeft: 2 }),
      trend({ category: 'leisure', multiplier: 2, daysLeft: 1 }),
    ])).toBe(400);
    expect(applyTrends(100, 'daily', [trend({ category: 'daily', multiplier: 0.1 })])).toBe(35);
    expect(applyTrends(100, 'daily', [trend({ category: 'daily', multiplier: 2, daysLeft: 0 })])).toBe(100);
  });

  it('uses weather event as the sole effect source', () => {
    const heat = modernContent.weather.find((weather) => weather.id === 'heat')!;
    const state = applyWeather(modernState({ health: 80 }), heat, modernContent);
    expect(state.health).toBe(76);
    expect(state.trends).toMatchObject([{ category: 'drink', multiplier: 1.4, daysLeft: 2 }]);
    expect(state.pendingEvents.map(({ id }) => id)).toEqual(['health/heat-wave']);
    const rain = applyWeather(modernState(), modernContent.weather.find(({ id }) => id === 'rain')!, modernContent);
    expect(rain.trends).toEqual([]);
    const pack = { ...stubPack, weather: [heat], events: {
      market: [], money: [], identity: [], health: modernContent.events.health,
    } };
    const settled = settleDay(modernState({ health: 80, day: 4 }), pack, new ScriptedRng(Array(40).fill(0.5)));
    expect(settled.health).toBe(76);
    expect(settled.pendingEvents.map(({ id }) => id)).toEqual(['health/heat-wave']);
    expect(settled.trends).toMatchObject([{ category: 'drink', daysLeft: 1 }]);
    expect(settleDay({ ...settled, pendingEvents: [] }, pack, new ScriptedRng(Array(40).fill(0.5))).trends)
      .toMatchObject([{ category: 'drink', daysLeft: 1 }]);
  });

  it('finds the shortest path, discounts couriers and advances exactly one day', () => {
    expect(travelCost(modernContent, 'xizhimen', 'guomao', 'courier')).toBe(2);
    expect(travelCost(modernContent, 'xizhimen', 'guomao', null)).toBe(4);
    const result = travel({ ...createGame(modernContent, { playerName: 'Player', seed: 3, identityId: 'courier' }),
      day: 4, cash: 100 }, 'guomao', modernContent, new SeededRng(3));
    expect(result.ok && result.state.day).toBe(5);
    expect(result.ok && result.state.cash).toBeLessThan(100);
  });

  it('enforces credit limits and repays into the next tier', () => {
    expect(creditTerms('D')).toEqual({ limit: 0, dailyRate: 0.15 });
    const borrowed = borrowModern(modernState({ credit: 'C', debt: 100, bank: 0 }), 4900);
    expect(borrowed).toMatchObject({ ok: true, state: { debt: 5000, bank: 4900 } });
    expect(borrowModern(modernState({ credit: 'C', debt: 100 }), 4901))
      .toMatchObject({ ok: false, error: { code: 'CREDIT_LIMIT' } });
    const state = modernState({ credit: 'C', debt: 100, cash: 100, identityId: 'graduate' });
    const first = repayDebt(state, { amount: 1, account: 'cash' }, modernContent);
    expect(first).toMatchObject({ ok: true, state: { credit: 'C', modern: { onTimeRepayments: 2 } } });
    if (first.ok) expect(repayDebt(first.state, { amount: 1, account: 'cash' }, modernContent))
      .toMatchObject({ ok: true, state: { credit: 'B', modern: { onTimeRepayments: 1 } } });
    const reward = modernContent.events.money.find(({ id }) => id === 'money/repayment-reward')!;
    expect(applyEvent(state, reward)).toMatchObject({ credit: 'C', modern: { onTimeRepayments: 2 } });
    const review = modernContent.events.money.find(({ id }) => id === 'money/credit-review')!;
    expect(applyEvent({ ...state, credit: 'B' }, review).credit).toBe('C');
    expect(moveCredit('D', -1)).toBe('D');
    expect(moveCredit('S', 1)).toBe('S');
  });

  it('freezes wallet debits only and resets the daily transfer counter', () => {
    const state = modernState({ wallet: 1000, cash: 1000, walletFrozenDays: 1, market: { item_a: 10 } });
    expect(buy(state, { itemId: 'item_a', quantity: 1, account: 'wallet' }, {
      ...modernContent, goods: [{ id: 'item_a', name: 'A', category: 'daily', basePrice: 10, priceRange: 1 }],
      locations: [{ ...modernContent.locations[0], id: 'loc_a' }],
    })).toMatchObject({ ok: false, error: { code: 'WALLET_FROZEN' } });
    expect(transfer(state, { from: 'wallet', to: 'cash', amount: 1 }))
      .toMatchObject({ ok: false, error: { code: 'WALLET_FROZEN' } });
    expect(transfer(state, { from: 'cash', to: 'wallet', amount: 1 }).ok).toBe(true);
    const cashPurchase = buy(state, { itemId: 'item_a', quantity: 1, account: 'cash' }, {
      ...modernContent, goods: [{ id: 'item_a', name: 'A', category: 'daily', basePrice: 10, priceRange: 1 }],
      locations: [{ ...modernContent.locations[0], id: 'loc_a' }],
    });
    expect(cashPurchase).toMatchObject({ ok: true, state: { cash: 990 } });
    expect(settleWallet({ ...state, modern: { ...state.modern!, dailyWalletTransferred: 99 } }))
      .toMatchObject({ walletFrozenDays: 0, modern: { dailyWalletTransferred: 0 } });
    const transferState = modernState({ cash: 11_000, modern: { ...state.modern!, dailyWalletTransferred: 9_999 } });
    expect(transfer(transferState, { from: 'cash', to: 'wallet', amount: 1 }))
      .toMatchObject({ ok: true, state: { modern: { dailyWalletTransferred: 10_000 } } });
    expect(transfer(transferState, { from: 'cash', to: 'wallet', amount: 2 }))
      .toMatchObject({ ok: false, error: { code: 'TRANSFER_LIMIT' } });
  });

  it('applies passive identities and caps shopkeeper event capacity', () => {
    const shop = createGame(modernContent, { playerName: 'Player', seed: 1, identityId: 'shopkeeper' });
    expect(shop.capacity).toBe(120);
    const event = modernContent.events.identity.find(({ id }) => id === 'identity/shopkeeper-shelf')!;
    const first = applyIdentity(shop, event);
    expect(first).toMatchObject({ capacity: 125, modern: { shopkeeperCapacityBonus: 5 } });
    expect(applyIdentity(first, event)).toMatchObject({ capacity: 130, modern: { shopkeeperCapacityBonus: 10 } });
    let capped = shop;
    for (let index = 0; index < 8; index += 1) capped = applyIdentity(capped, event);
    expect(capped).toMatchObject({ capacity: 145, modern: { shopkeeperCapacityBonus: 25 } });
    const designer = createGame(modernContent, { playerName: 'Player', seed: 1, identityId: 'designer' });
    expect(designer.modern?.revealTrendDaysBonus).toBe(1);
  });

  it('keeps key invariants across generated inputs', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 10000 }), fc.integer({ min: 1, max: 1000 }), (base, seed) => {
      const state = modernState({ day: 2, cash: 1000 });
      const prices = generateMarket(modernContent, new SeededRng(seed), state);
      expect(Object.values(prices).every((price) => Number.isInteger(price) && price > 0)).toBe(true);
      expect(applyTrends(base, 'daily', [trend({ multiplier: 0.1, daysLeft: 1 })])).toBeGreaterThan(0);
      expect(travelCost(modernContent, 'xizhimen', 'guomao', null)).toBeGreaterThanOrEqual(1);
      expect(travelCost(modernContent, 'xizhimen', 'guomao', null)).toBeLessThanOrEqual(8);
    }));
    fc.assert(fc.property(fc.integer({ min: 1, max: 39 }), fc.integer(), (day, seed) => {
      const state = modernState({ day, cash: 100 });
      const result = travel(state, 'loc_b', stubPack, new SeededRng(seed));
      expect(result).toMatchObject({ ok: true, state: { day: day + 1 } });
    }));
    fc.assert(fc.property(fc.integer({ min: -20, max: 20 }), fc.integer({ min: 0, max: 10 }), (step, daysLeft) => {
      expect(['D', 'C', 'B', 'A', 'S']).toContain(moveCredit('C', step));
      const aged = settleDay(modernState({ trends: [trend({ daysLeft })] }), stubPack, new SeededRng(1)).trends;
      expect(aged.every((entry) => entry.daysLeft >= 0)).toBe(true);
    }));
  });
});
