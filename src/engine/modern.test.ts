import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { modernContent } from '../content/modern';
import { createGame } from './create-game';
import { modernState, ScriptedRng, stubPack, trend } from '../test/fixtures';
import { settleDay, travel } from './day-cycle';
import { generateMarket } from './market';
import { applyEvent, applyIdentity, applyTrends, applyWeather, borrowModern, creditTerms, moveCredit, settleWallet, travelCost, triggeredModern } from './modern';
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
      day: 4, cash: 100, pendingEvents: [] }, 'guomao', modernContent, new SeededRng(3));
    expect(result.ok && result.state.day).toBe(5);
    expect(result.ok && result.state.cash).toBeLessThan(100);
  });

  it('enforces credit limits and repays into the next tier', () => {
    expect(creditTerms('D')).toEqual({ limit: 0, dailyRate: 0.15 });
    const borrowed = borrowModern(modernState({ credit: 'C', debt: 100, bank: 0 }), 4900);
    expect(borrowed).toMatchObject({ ok: true, state: { debt: 5000, bank: 4900 } });
    expect(borrowModern(modernState({ credit: 'C', debt: 100 }), 4901))
      .toMatchObject({ ok: false, error: { code: 'CREDIT_LIMIT' } });
    const opening = createGame(modernContent, { playerName: 'Player', seed: 1, identityId: null });
    expect(borrowModern(opening, 1)).toMatchObject({ ok: false, error: { code: 'CREDIT_LIMIT' } });
    const cleared = repayDebt({ ...opening, cash: 3000 }, { amount: 600, account: 'cash' }, modernContent);
    if (cleared.ok) expect(borrowModern(cleared.state, 100)).toMatchObject({ ok: true });
    const state = modernState({ credit: 'C', debt: 300, cash: 300, identityId: 'graduate',
      modern: { ...modernState().modern!, repaymentDueDay: 5, repaymentDueAmount: 30,
        repaidTowardDue: 0, onTimeRepayments: 0 } });
    const tiny = repayDebt(state, { amount: 1, account: 'cash' }, modernContent);
    expect(tiny).toMatchObject({ ok: true, state: { credit: 'C', modern: { repaidTowardDue: 1, onTimeRepayments: 0 } } });
    if (tiny.ok) {
      const completed = repayDebt(tiny.state, { amount: 29, account: 'cash' }, modernContent);
      expect(completed).toMatchObject({ ok: true, state: { credit: 'C', modern: { onTimeRepayments: 2,
        repaymentDueDay: 10, lastOnTimeRepaymentDay: 1 } } });
      if (completed.ok) {
        expect(repayDebt(completed.state, { amount: 1, account: 'cash' }, modernContent))
          .toMatchObject({ ok: true, state: { credit: 'C', modern: { onTimeRepayments: 2 } } });
        const secondWindow = { ...completed.state, day: 6 };
        const upgraded = repayDebt(secondWindow, { amount: secondWindow.modern!.repaymentDueAmount, account: 'cash' }, modernContent);
        expect(upgraded).toMatchObject({ ok: true, state: { credit: 'B', modern: { onTimeRepayments: 1 } } });
        if (upgraded.ok) expect(upgraded.state.journal.at(-1)?.delta?.credit).toBe(1);
      }
    }
    const reward = modernContent.events.money.find(({ id }) => id === 'money/repayment-reward')!;
    expect(applyEvent(state, reward)).toBe(state);
    const review = modernContent.events.money.find(({ id }) => id === 'money/credit-review')!;
    const reviewed = { ...state, credit: 'B' as const };
    expect(applyEvent(reviewed, review)).toBe(reviewed);
    expect(moveCredit('D', -1)).toBe('D');
    expect(moveCredit('S', 1)).toBe('S');
  });

  it('penalizes an unpaid installment once after day five and journals it', () => {
    const pack = { ...stubPack, events: { market: [], health: [], identity: [], money: modernContent.events.money } };
    const state = modernState({ day: 5, debt: 1000, credit: 'B', modern: {
      ...modernState().modern!, repaymentDueDay: 5, repaymentDueAmount: 100, repaidTowardDue: 50,
    } });
    const next = settleDay(state, pack, new ScriptedRng(Array(50).fill(0.5)));
    expect(next).toMatchObject({ day: 6, credit: 'C', modern: { overduePenalties: 1, repaymentDueDay: 10,
      repaidTowardDue: 0 } });
    expect(next.pendingEvents.map(({ id }) => id)).toEqual(['money/credit-review']);
    expect(next.journal.some(({ title, delta }) => title === '信用复核' && delta?.credit === -1)).toBe(true);
    const again = settleDay({ ...next, pendingEvents: [] }, pack, new ScriptedRng(Array(50).fill(0.5)));
    expect(again.modern?.overduePenalties).toBe(1);
  });

  it('reveals one forecast day to designers and two for the current reveal event', () => {
    const marketEvent = { ...modernContent.events.market[0], frequency: 1 };
    const pack = { ...modernContent, weather: [], goods: [
      { id: 'coffee-beans', name: 'Coffee', category: 'drink', basePrice: 80, priceRange: 1 },
    ], events: { ...modernContent.events, market: [marketEvent],
      health: [], money: [], identity: [] } };
    const designer = createGame(pack, { playerName: 'Player', seed: 1, identityId: 'designer' });
    expect(designer.modern?.visibleTrendForecast).toMatchObject([{ day: 2, trends: [{ id: marketEvent.id }] }]);
    expect(designer.modern?.visibleTrendForecast.every(({ day }) => day <= 2)).toBe(true);
    const ordinary = createGame(pack, { playerName: 'Player', seed: 1, identityId: null });
    expect(ordinary.modern?.visibleTrendForecast).toEqual([]);
    expect(designer.trends).toEqual([]);
    const before = designer.market['coffee-beans'];
    const reveal = modernContent.events.identity.find(({ id }) => id === 'identity/designer-radar')!;
    const shown = applyIdentity(designer, reveal);
    expect(shown.modern?.revealAllThroughDay).toBe(1);
    expect(shown.modern?.visibleTrendForecast).toEqual(shown.modern?.forecastMarketEvents);
    const advanced = settleDay({ ...shown, pendingEvents: [] }, pack, new SeededRng(shown.rngState));
    expect(advanced.trends.some(({ id }) => id === marketEvent.id)).toBe(true);
    expect(advanced.market['coffee-beans']).toBeGreaterThan(before);
    expect(advanced.modern?.revealAllThroughDay).toBeNull();
    expect(advanced.modern?.visibleTrendForecast.every(({ day }) => day <= 3)).toBe(true);
  });

  it('uses identity event weights on the same random roll', () => {
    const event = modernContent.events.market[0];
    expect(triggeredModern(event, 'market', modernContent, null, new ScriptedRng([0.012]))).toBe(false);
    expect(triggeredModern(event, 'market', modernContent, 'designer', new ScriptedRng([0.012]))).toBe(true);
    const identityEvent = modernContent.events.identity[0];
    expect(triggeredModern(identityEvent, 'identity', modernContent, null, new ScriptedRng([0.012]))).toBe(false);
    expect(triggeredModern(identityEvent, 'identity', modernContent, 'courier', new ScriptedRng([0.012]))).toBe(true);
    for (const identity of modernContent.identities) {
      expect(Object.values(identity.eventWeights ?? {}).some((weight) => weight !== 1)).toBe(true);
    }
  });

  it('conditions the graduate identity reward on a qualifying repayment', () => {
    const event = modernContent.events.identity.find(({ id }) => id === 'identity/graduate-review')!;
    const state = modernState({ identityId: 'graduate', debt: 300, cash: 300,
      modern: { ...modernState().modern!, repaymentDueDay: 5, repaymentDueAmount: 30 } });
    expect(applyIdentity(state, event)).toBe(state);
    const paid = repayDebt(state, { amount: 30, account: 'cash' }, modernContent);
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(applyIdentity(paid.state, event)).toMatchObject({ bank: state.bank + 100,
      credit: state.credit, pendingEvents: [{ id: event.id }] });
  });

  it('sets first-day weather and journals travel, interest, events and liquidation', () => {
    const heat = modernContent.weather.find(({ id }) => id === 'heat')!;
    const pack = { ...modernContent, weather: [heat], goods: [
      { id: 'coffee-beans', name: 'Coffee', category: 'drink', basePrice: 80, priceRange: 1 },
    ], events: { market: [], health: [modernContent.events.health.find(({ id }) => id === heat.eventId)!],
      money: [], identity: [] } };
    const initial = createGame(pack, { playerName: 'Player', seed: 7, identityId: null });
    expect(initial).toMatchObject({ weatherId: 'heat', health: 96, market: { 'coffee-beans': 140 } });
    expect(initial.trends).toMatchObject([{ category: 'drink', daysLeft: 1 }]);
    expect(initial.pendingEvents.map(({ id }) => id)).toEqual(['health/heat-wave']);
    expect(initial.journal.map(({ title }) => title)).toEqual(['热浪']);
    const before = structuredClone(initial);
    const travelled = travel({ ...initial, pendingEvents: [], day: 39, cash: 10_000, debt: 0,
      inventory: { 'coffee-beans': { quantity: 2, averageCost: 80 } } }, 'guomao', pack, new SeededRng(initial.rngState));
    expect(initial).toEqual(before);
    expect(travelled).toMatchObject({ ok: true, state: { day: 40, inventory: {}, status: 'won' } });
    if (travelled.ok) {
      expect(travelled.state.pendingEvents.map(({ id }) => id)).toEqual([
        'health/heat-wave', 'journey-complete', 'auto-liquidation',
      ]);
      expect(travelled.state.journal.map(({ title }) => title)).toEqual([
        '热浪', 'Travel', 'Bank interest', 'Debt interest', '热浪', 'Auto-liquidation',
      ]);
      expect(travelled.state.journal.map(({ day }) => day)).toEqual([1, 39, 40, 40, 40, 40]);
      expect(travelled.state.journal.find(({ title }) => title === 'Auto-liquidation')?.delta?.cash).toBeGreaterThan(0);
    }
  });

  it('charges the first-day rain fare once and records journalNotice', () => {
    const rain = modernContent.weather.find(({ id }) => id === 'rain')!;
    const pack = { ...modernContent, weather: [rain], events: { market: [], money: [], identity: [],
      health: [modernContent.events.health.find(({ id }) => id === rain.eventId)!] } };
    const first = createGame(pack, { playerName: 'Player', seed: 1, identityId: null });
    expect(first).toMatchObject({ weatherId: 'rain', health: 98 });
    const moved = travel({ ...first, pendingEvents: [] }, 'fuxingmen', pack, new SeededRng(first.rngState));
    expect(moved).toMatchObject({ ok: true, state: { cash: 1996, day: 2 } });
    const delay = modernContent.events.health.find(({ id }) => id === 'health/subway-delay')!;
    const delayed = applyEvent(first, delay);
    expect(delayed.journal.at(-1)).toMatchObject({ title: delay.title, detail: '地铁延误', delta: { cash: -10 } });
    const freeze = modernContent.events.money.find(({ id }) => id === 'money/wallet-freeze')!;
    expect(applyEvent(first, freeze).journal.at(-1)?.delta?.walletFrozenDays).toBe(1);
  });

  it('consumes each scheduled market event roll only once', () => {
    const event = { ...modernContent.events.market[0], frequency: 1 };
    const pack = { ...stubPack, events: { market: [event], health: [], money: [], identity: [] } };
    const state = modernState({ day: 1, modern: { ...modernState().modern!, forecastMarketEvents: [
      { day: 2, trends: [{ id: event.id, category: 'coffee-beans', multiplier: 1.8, daysLeft: 3, reason: event.title }] },
      { day: 3, trends: [] },
    ] } });
    const rng = new ScriptedRng([0.5, 0.5, 0.5]);
    settleDay(state, pack, rng);
    expect(rng.state).toBe(3); // Two price rolls and one roll for day four's plan.
    const finalRng = new ScriptedRng([0.5, 0.5]);
    const final = settleDay({ ...state, day: 39, modern: { ...state.modern!, forecastMarketEvents: [
      { day: 40, trends: state.modern!.forecastMarketEvents[0].trends },
    ] } }, pack, finalRng);
    expect(finalRng.state).toBe(2);
    expect(final.modern?.forecastMarketEvents).toEqual([]);
  });

  it('caps rainy transit at eight on a long route', () => {
    const rain = modernContent.weather.find(({ id }) => id === 'rain')!;
    const locations = Array.from({ length: 25 }, (_, index) => ({
      ...stubPack.locations[0], id: `station-${index}`,
      neighborIds: [index > 0 ? `station-${index - 1}` : '', index < 24 ? `station-${index + 1}` : '']
        .filter(Boolean),
    }));
    const pack = { ...stubPack, locations, weather: [rain], events: { ...stubPack.events,
      health: [modernContent.events.health.find(({ id }) => id === rain.eventId)!] } };
    const state = modernState({ locationId: 'station-0', weatherId: 'rain', cash: 100 });
    const result = travel(state, 'station-24', pack, new SeededRng(state.rngState));
    expect(result).toMatchObject({ ok: true, state: { cash: 92 } });
  });

  it('clears a frozen wallet on real travel while preserving cash spending', () => {
    const state = modernState({ walletFrozenDays: 1, cash: 100, wallet: 100 });
    expect(transfer(state, { from: 'wallet', to: 'cash', amount: 1 }).ok).toBe(false);
    const moved = travel(state, 'loc_b', stubPack, new SeededRng(state.rngState));
    expect(moved).toMatchObject({ ok: true, state: { walletFrozenDays: 0, day: 2 } });
    if (moved.ok) expect(transfer(moved.state, { from: 'wallet', to: 'cash', amount: 1 }).ok).toBe(true);
  });

  it('replays modern state exactly and leaves inputs immutable', () => {
    const run = () => {
      let state = createGame(modernContent, { playerName: 'Player', seed: 83, identityId: 'courier' });
      for (const target of ['guomao', 'chaoyangmen', 'xizhimen']) {
        state = { ...state, pendingEvents: [] };
        const snapshot = structuredClone(state);
        const result = travel(state, target, modernContent, new SeededRng(state.rngState));
        expect(state).toEqual(snapshot);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.error.message);
        state = result.state;
      }
      return state;
    };
    expect(run()).toEqual(run());
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
    fc.assert(fc.property(fc.integer({ min: 0, max: modernContent.locations.length - 1 }),
      fc.integer({ min: 0, max: modernContent.locations.length - 1 }), (start, end) => {
        const origin = modernContent.locations[start].id;
        const target = modernContent.locations[end].id;
        const seen = new Set([origin]);
        const queue: Array<[string, number]> = [[origin, 0]];
        let edges = 0;
        for (const [id, distance] of queue) {
          if (id === target) { edges = distance; break; }
          for (const neighbor of modernContent.locations.find(({ id: station }) => station === id)!.neighborIds) {
            if (!seen.has(neighbor)) { seen.add(neighbor); queue.push([neighbor, distance + 1]); }
          }
        }
        const fare = Math.min(8, 3 + Math.floor(edges / 4));
        expect(travelCost(modernContent, origin, target, null)).toBe(fare);
        expect(travelCost(modernContent, origin, target, 'courier')).toBe(Math.max(1, Math.floor(fare / 2)));
      }));
  });
});
