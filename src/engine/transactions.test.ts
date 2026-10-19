import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classicContent } from '../content/classic';
import { createGame } from './create-game';
import { buy, sell, transfer } from './transactions';
import type { GameState } from './types';

function stateWith(partial: Partial<GameState> = {}): GameState {
  return {
    ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }),
    locationId: 'jianguomen', market: { vcd: 40 }, ...partial,
  };
}

describe('trading', () => {
  it('merges purchases using integer weighted average cost', () => {
    const state = stateWith({ cash: 10_000, capacity: 100, inventory: { vcd: { quantity: 10, averageCost: 20 } } });
    const result = buy(state, { itemId: 'vcd', quantity: 5, account: 'cash' }, classicContent);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.inventory.vcd).toEqual({ quantity: 15, averageCost: 26 });
      expect(result.state.cash).toBe(9800);
      expect(result.state.journal).toHaveLength(1);
    }
    expect(state.inventory.vcd).toEqual({ quantity: 10, averageCost: 20 });
  });

  it('leaves the exact state unchanged when capacity is insufficient', () => {
    const state = stateWith({ capacity: 10, inventory: { vcd: { quantity: 10, averageCost: 20 } } });
    const result = buy(state, { itemId: 'vcd', quantity: 1, account: 'cash' }, classicContent);

    expect(result).toMatchObject({ ok: false, error: { code: 'CAPACITY_EXCEEDED' } });
    expect(result.state).toBe(state);
  });

  it('rejects missing goods, unavailable market prices, invalid quantities and unsupported accounts', () => {
    const state = stateWith();
    for (const [command, code] of [
      [{ itemId: 'missing', quantity: 1, account: 'cash' }, 'ITEM_UNAVAILABLE'],
      [{ itemId: 'vcd', quantity: 0, account: 'cash' }, 'INVALID_QUANTITY'],
      [{ itemId: 'vcd', quantity: 1.5, account: 'cash' }, 'INVALID_QUANTITY'],
      [{ itemId: 'vcd', quantity: 1, account: 'bank' }, 'ACCOUNT_UNSUPPORTED'],
    ] as const) {
      const result = buy(state, command, classicContent);
      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(result.state).toBe(state);
    }
    const noPrice = stateWith({ market: {} });
    expect(buy(noPrice, { itemId: 'vcd', quantity: 1, account: 'cash' }, classicContent))
      .toMatchObject({ ok: false, state: noPrice, error: { code: 'ITEM_UNAVAILABLE' } });
  });

  it('rejects unaffordable purchases without changing balances or inventory', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 39 }), fc.integer({ min: 1, max: 100 }), (cash, quantity) => {
      const state = stateWith({ cash, inventory: { vcd: { quantity: 2, averageCost: 10 } } });
      const result = buy(state, { itemId: 'vcd', quantity, account: 'cash' }, classicContent);
      expect(result).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
      expect(result.state).toBe(state);
      expect(state.cash).toBe(cash);
      expect(state.inventory.vcd).toEqual({ quantity: 2, averageCost: 10 });
    }));
  });

  it('credits proceeds and removes a completely sold lot', () => {
    const state = stateWith({ cash: 100, inventory: { vcd: { quantity: 3, averageCost: 20 } } });
    const result = sell(state, { itemId: 'vcd', quantity: 3, account: 'cash' }, classicContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.cash).toBe(220);
      expect(result.state.inventory).toEqual({});
      expect(result.state.journal).toHaveLength(1);
    }
  });

  it('rejects overselling atomically', () => {
    const state = stateWith({ inventory: { vcd: { quantity: 2, averageCost: 20 } } });
    const result = sell(state, { itemId: 'vcd', quantity: 3, account: 'cash' }, classicContent);
    expect(result).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_INVENTORY' } });
    expect(result.state).toBe(state);
  });
});

describe('transfers', () => {
  it('moves money between cash and bank with one journal entry', () => {
    const state = stateWith({ cash: 100, bank: 10 });
    const result = transfer(state, { from: 'cash', to: 'bank', amount: 80 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([result.state.cash, result.state.bank]).toEqual([20, 90]);
      expect(result.state.journal).toHaveLength(1);
    }
  });

  it('does not overdraw either account or transfer invalid amounts', () => {
    const state = stateWith({ cash: 100, bank: 10 });
    for (const command of [
      { from: 'cash', to: 'bank', amount: 101 },
      { from: 'bank', to: 'cash', amount: 11 },
    ] as const) {
      const result = transfer(state, command);
      expect(result).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
      expect(result.state).toBe(state);
    }
    for (const amount of [0, -1, 1.5, Number.NaN]) {
      const result = transfer(state, { from: 'cash', to: 'bank', amount });
      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
      expect(result.state).toBe(state);
    }
  });
});
