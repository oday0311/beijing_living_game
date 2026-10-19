import { describe, expect, it } from 'vitest';
import { classicContent } from '../content/classic';
import { createGame } from './create-game';
import { reduceGameState } from './reducer';
import { classicState, modernState, ScriptedRng, stubPack } from '../test/fixtures';
import { acknowledgeEvent, calculateScore, settleDay, travel } from './day-cycle';

const quietRolls = () => new ScriptedRng(Array(250).fill(0.998));

describe('classic travel and settlement', () => {
  it('settles classic travel in source order', () => {
    const state = classicState({ day: 1, debt: 5_500, bank: 1_000, locationId: 'xizhimen' });
    const result = travel(state, 'fuxingmen', classicContent, quietRolls());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toMatchObject({ day: 2, debt: 6_050, bank: 1_010, locationId: 'fuxingmen' });
      expect(result.state.journal.map(({ title }) => title).slice(0, 3)).toEqual(['换站', '存款利息', '债务利息']);
      expect(result.state.journal[1].delta).toEqual({ bank: 10 });
      expect(result.state.journal[2].delta).toEqual({ debt: 550 });
    }
  });

  it('rejects travelling to the current or unknown station without advancing time', () => {
    const state = classicState({ day: 8, locationId: 'fuxingmen' });
    expect(travel(state, 'fuxingmen', classicContent, quietRolls()))
      .toMatchObject({ ok: false, state, error: { code: 'SAME_LOCATION' } });
    expect(travel(state, 'missing', classicContent, quietRolls()))
      .toMatchObject({ ok: false, state, error: { code: 'UNKNOWN_LOCATION' } });
  });

  it('advances a modern day through the modern rules', () => {
    const state = modernState();
    expect(travel(state, 'loc_b', stubPack, quietRolls()))
      .toMatchObject({ ok: true, state: { day: 2, locationId: 'loc_b', cash: 97 } });
  });

  it('requires queued events to be acknowledged before another travel', () => {
    const state = classicState({ locationId: 'xizhimen', pendingEvents: [{
      id: 'notice', kind: 'system', title: 'Notice', body: 'Notice', artId: 'notice',
    }] });
    const rng = quietRolls();
    expect(travel(state, 'fuxingmen', classicContent, rng))
      .toMatchObject({ ok: false, state, error: { code: 'EVENT_PENDING' } });
    expect(rng.state).toBe(0);
    expect(travel(acknowledgeEvent(state), 'fuxingmen', classicContent, rng).ok).toBe(true);
  });

  it('queues market, health and money events while continuing every settlement step', () => {
    const rolls = Array(48).fill(0.998);
    rolls[11] = 0; // toy-demand
    rolls[29] = 0; // street-attack
    rolls[30] = 0; // beggar, immediately after the first health event
    const state = settleDay(classicState({ cash: 2050, debt: 5500, bank: 1000 }), classicContent, new ScriptedRng(rolls));
    expect(state).toMatchObject({ day: 2, cash: 1800, debt: 6050, bank: 1010, health: 97 });
    expect(state.market.toys).toBe(2 * (250 + Math.floor(0.998 * 600)));
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['toy-demand', 'street-attack', 'beggar']);
    expect(acknowledgeEvent(state).pendingEvents.map((event) => event.id)).toEqual(['street-attack', 'beggar']);
    expect(acknowledgeEvent(classicState()).pendingEvents).toEqual([]);
    expect(state.journal.filter(({ title }) => title === '行情变化' || title === '健康事件' || title === '资金事件')
      .map(({ title, delta }) => [title, delta])).toEqual([
        ['行情变化', undefined], ['健康事件', { health: -3 }], ['资金事件', { cash: -250 }],
      ]);
  });

  it('skips bank loss at zero balance and stops after the first triggered money event', () => {
    const rolls = Array(48).fill(0.998);
    rolls[45] = 0; // fees
    rolls[46] = 0; // permit, should not be visited
    const rng = new ScriptedRng(rolls);
    const state = settleDay(classicState({ bank: 0 }), classicContent, rng);
    expect(state.bank).toBe(0);
    expect(state.pendingEvents).toEqual([]);
    expect(rng.state).toBe(47); // the disabled hacker event still consumes its roll
    expect(settleDay(classicState(), classicContent, quietRolls()).rngState).toBe(49);
  });

  it('continues market rolls after an event targets an omitted good', () => {
    const rolls = Array(49).fill(0.998); // cosmetics is the omitted good
    rolls[11] = 0; // toy-demand
    rolls[18] = 0; // cosmetics-celebrity, ignored
    rolls[19] = 0; // liquor-rush
    const state = settleDay(classicState(), classicContent, new ScriptedRng(rolls));
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['toy-demand', 'liquor-rush']);
    expect(state.market.toys).toBe(1696);
    expect(state.market.liquor).toBe(7 * (1000 + Math.floor(0.998 * 2500)));
  });

  it('adds a forced-purchase lot and debt after interest', () => {
    const rolls = Array(49).fill(0.998);
    rolls[28] = 0; // forced-phone
    const state = settleDay(classicState({ debt: 5500 }), classicContent, new ScriptedRng(rolls));
    expect(state.debt).toBe(8550);
    expect(state.inventory.phones).toEqual({ quantity: 1, averageCost: 0 });
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['forced-phone']);
  });

  it('hospitalizes below 85 health, adding debt and time before the ordinary day advance', () => {
    const rolls = Array(52).fill(0.998);
    rolls[29] = 0; // street-attack takes health from 86 to 83
    rolls[30] = 0.5; // two days in hospital
    rolls[31] = 0; // nearby place
    rolls[32] = 0; // hospital bill: 2 * 1000
    const state = settleDay(classicState({ day: 5, health: 86, debt: 0 }), classicContent, new ScriptedRng(rolls));
    expect(state).toMatchObject({ day: 8, health: 93, debt: 2000, status: 'playing' });
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['street-attack', 'hospitalization']);
    expect(state.journal.find(({ title }) => title === '强制住院')?.delta).toEqual({ debt: 2000, health: 10 });
  });

  it('still hospitalizes at day 37 when health drops below the threshold', () => {
    const rolls = Array(52).fill(0.998);
    rolls[29] = 0; // street-attack
    rolls[30] = 0; // one hospital day
    rolls[31] = 0; // nearby place
    rolls[32] = 0; // 1000 bill
    const state = settleDay(classicState({ day: 37, health: 86, debt: 0 }), classicContent, new ScriptedRng(rolls));
    expect(state).toMatchObject({ day: 39, health: 93, debt: 1000, status: 'playing' });
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['street-attack', 'hospitalization', 'departure-warning']);
  });

  it('marks death below zero health and applies the high-debt health penalty', () => {
    const rolls = Array(48).fill(0.998);
    rolls[29] = 0; // day 39 still has omission rolls
    const state = settleDay(classicState({ day: 38, health: 2, debt: 100_000 }), classicContent, new ScriptedRng(rolls));
    expect(state).toMatchObject({ day: 39, health: -31, status: 'lost' });
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['street-attack', 'death', 'debt-penalty']);
    expect(state.journal.find(({ title }) => title === '债务惩罚')?.delta).toEqual({ health: -30 });
  });

  it('exposes every good on the final day and sells all remaining lots', () => {
    const state = settleDay(classicState({
      day: 39, cash: 0, bank: 100, wallet: 0, debt: 100, inventory: { vcd: { quantity: 2, averageCost: 5 } },
    }), classicContent, quietRolls());
    expect(Object.keys(state.market)).toHaveLength(classicContent.goods.length);
    expect(state).toMatchObject({ day: 40, inventory: {}, cash: 108, bank: 101, debt: 110, finalScore: 99, status: 'won' });
    expect(calculateScore(state)).toBe(99);
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['journey-complete', 'auto-liquidation']);
    expect(state.journal.find(({ title }) => title === '最终清仓')?.delta).toEqual({ cash: 108 });
    expect(state.journal.at(-1)).toMatchObject({ title: '最终得分', detail: expect.stringContaining('99') });
  });

  it('keeps normal omissions on arrival at day 39 and loses on a nonpositive final score', () => {
    const day39 = settleDay(classicState({ day: 38, health: 100, debt: 0 }), classicContent, quietRolls());
    expect(Object.keys(day39.market)).toHaveLength(classicContent.goods.length - 1);
    expect(day39.market.cosmetics).toBeUndefined();
    expect(day39.pendingEvents.map((event) => event.id)).toEqual(['departure-warning']);

    const final = settleDay(classicState({ day: 39, cash: 0, bank: 0, wallet: 0, debt: 100 }), classicContent, quietRolls());
    expect(final).toMatchObject({ day: 40, finalScore: -110, status: 'lost' });
  });

  it('liquidates and scores on day 40 even when a health event kills the player', () => {
    const rolls = Array(48).fill(0.998);
    rolls[26] = 0; // street-attack after the final all-goods price rolls
    rolls[27] = 0; // beggar after the fatal health event
    const state = settleDay(classicState({
      day: 39, health: 2, cash: 2050, bank: 0, wallet: 0, debt: 0,
      inventory: { vcd: { quantity: 2, averageCost: 5 } },
    }), classicContent, new ScriptedRng(rolls));
    expect(state).toMatchObject({ day: 40, health: -1, inventory: {}, cash: 1908, finalScore: 1908, status: 'lost' });
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['street-attack', 'death', 'beggar', 'journey-complete', 'auto-liquidation']);
  });

  it('restores original prices for all goods when hospitalization skips directly to day 40', () => {
    const rolls = Array(52).fill(0.998);
    rolls[41] = 0.5; // two hospital days
    rolls[42] = 0; // nearby place
    rolls[43] = 0; // 2000 bill
    const rng = new ScriptedRng(rolls);
    const state = settleDay(classicState({
      day: 37, health: 84, cash: 0, bank: 0, wallet: 0, debt: 0,
      inventory: { cosmetics: { quantity: 2, averageCost: 65 } },
    }), classicContent, rng);
    expect(Object.keys(state.market)).toHaveLength(classicContent.goods.length);
    expect(state.market.cosmetics).toBe(244);
    expect(state).toMatchObject({ day: 40, inventory: {}, cash: 488, debt: 2000, finalScore: -1512, status: 'lost' });
    expect(state.pendingEvents.map((event) => event.id)).toEqual(['hospitalization', 'journey-complete', 'auto-liquidation']);
    expect(rng.state).toBe(52);
  });

  it('replays five classic travels with stable balances, lots and event IDs', () => {
    const rolls = Array(226).fill(0.998);
    rolls[11] = 0; // day 1 toy-demand
    rolls[29] = 0; // day 1 street-attack
    rolls[30] = 0; // day 1 beggar
    rolls[58] = 0; // day 2 free-cigarettes
    rolls[77] = 0; // day 2 fees
    const rng = new ScriptedRng(rolls);
    const targets = ['fuxingmen', 'jianguomen', 'xizhimen', 'dongzhimen', 'beijingzhan'];
    const expected = [
      { day: 2, cash: 1800, bank: 1010, debt: 6050, health: 97, cigarettes: 2, events: ['toy-demand', 'street-attack', 'beggar'] },
      { day: 3, cash: 1800, bank: 850, debt: 6655, health: 97, cigarettes: 8, events: ['free-cigarettes', 'fees'] },
      { day: 4, cash: 1800, bank: 858, debt: 7320, health: 97, cigarettes: 8, events: [] },
      { day: 5, cash: 1800, bank: 866, debt: 8052, health: 97, cigarettes: 8, events: [] },
      { day: 6, cash: 1800, bank: 874, debt: 8857, health: 97, cigarettes: 8, events: [] },
    ];
    let state = classicState({
      day: 1, locationId: 'xizhimen', cash: 2050, bank: 1000, debt: 5500,
      inventory: { cigarettes: { quantity: 2, averageCost: 100 } },
    });
    const replay = targets.map((targetId) => {
      const result = travel(state, targetId, classicContent, rng);
      expect(result.ok).toBe(true);
      state = result.state;
      const snapshot = {
        day: state.day, cash: state.cash, bank: state.bank, debt: state.debt, health: state.health,
        cigarettes: state.inventory.cigarettes?.quantity, events: state.pendingEvents.map((event) => event.id),
      };
      while (state.pendingEvents.length > 0) state = acknowledgeEvent(state);
      return snapshot;
    });
    expect(replay).toEqual(expected);
    expect(state.inventory.cigarettes).toEqual({ quantity: 8, averageCost: 100 });
  });

  it('replays a seeded classic game from opening day through settlement using legal commands', () => {
    function replay(seed: number) {
      let state = createGame(classicContent, { playerName: '回放玩家', seed, identityId: null });
      let commands = 0;
      while (state.status === 'playing' && commands < 300) {
        while (state.pendingEvents.length) {
          const acknowledged = reduceGameState(state, { type: 'ACK_EVENT' }, classicContent);
          expect(acknowledged.ok).toBe(true);
          state = acknowledged.state;
          commands += 1;
        }
        for (const [itemId, lot] of Object.entries(state.inventory)) {
          if (!state.market[itemId]) continue;
          const sold = reduceGameState(state, { type: 'SELL', itemId, quantity: lot.quantity, account: 'cash' }, classicContent);
          expect(sold.ok).toBe(true);
          state = sold.state;
          commands += 1;
        }
        if (state.debt > 0 && state.cash > 1500) {
          const paid = reduceGameState(state, { type: 'REPAY_DEBT', amount: Math.min(state.debt, state.cash - 1000), account: 'cash' }, classicContent);
          expect(paid.ok).toBe(true);
          state = paid.state;
          commands += 1;
        }
        if (state.health < 85 && state.cash >= (100 - state.health) * 3500) {
          const healed = reduceGameState(state, { type: 'HEAL', points: 100 - state.health, account: 'cash' }, classicContent);
          expect(healed.ok).toBe(true);
          state = healed.state;
          commands += 1;
        }
        const cheapest = Object.entries(state.market).filter(([, price]) => price > 0).sort((a, b) => a[1] - b[1])[0];
        if (cheapest && state.locationId && state.cash >= cheapest[1] && state.debt > 0) {
          const occupied = Object.values(state.inventory).reduce((sum, lot) => sum + lot.quantity, 0);
          const quantity = Math.min(state.capacity - occupied, Math.floor(state.cash / cheapest[1]));
          if (quantity > 0) {
            const bought = reduceGameState(state, { type: 'BUY', itemId: cheapest[0], quantity, account: 'cash' }, classicContent);
            expect(bought.ok).toBe(true);
            state = bought.state;
            commands += 1;
          }
        }
        const targetId = state.locationId === 'xizhimen' ? 'fuxingmen' : 'xizhimen';
        const traveled = reduceGameState(state, { type: 'TRAVEL', targetId }, classicContent);
        expect(traveled.ok).toBe(true);
        expect(traveled.state.day).toBeGreaterThan(state.day);
        state = traveled.state;
        commands += 1;
      }
      while (state.pendingEvents.length && commands < 400) {
        state = reduceGameState(state, { type: 'ACK_EVENT' }, classicContent).state;
        commands += 1;
      }
      return { day: state.day, status: state.status, finalScore: state.finalScore, cash: state.cash,
        debt: state.debt, health: state.health, eventsLeft: state.pendingEvents.length, commands };
    }
    const first = replay(1);
    expect(first).toEqual(replay(1));
    expect(first).toEqual({ day: 40, status: 'won', finalScore: 30_970,
      cash: 30_970, debt: 0, health: 90, eventsLeft: 0, commands: 78 });
    expect(first.commands).toBeLessThan(400);
  });
});
