import { describe, expect, it } from 'vitest';
import { classicContent } from '../content/classic';
import { modernContent } from '../content/modern';
import { createGame } from './create-game';
import { borrow, heal, quoteService, repayDebt, upgradeHousing } from './services';
import type { GameState } from './types';

function stateWith(partial: Partial<GameState> = {}): GameState {
  return { ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }), ...partial };
}

describe('classic services', () => {
  it('repays debt from cash and rejects amounts above cash or debt', () => {
    const state = stateWith({ cash: 500, debt: 300 });
    const excessDebt = repayDebt(state, { amount: 301, account: 'cash' }, classicContent);
    expect(excessDebt).toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(excessDebt.state).toBe(state);
    const poor = stateWith({ cash: 500, debt: 1000 });
    const insufficientCash = repayDebt(poor, { amount: 501, account: 'cash' }, classicContent);
    expect(insufficientCash).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(insufficientCash.state).toBe(poor);
    const result = repayDebt(state, { amount: 200, account: 'cash' }, classicContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([result.state.cash, result.state.debt]).toEqual([300, 100]);
      expect(result.state.journal).toHaveLength(1);
    }
  });

  it('charges 3,500 cash per healed point and caps health at 100', () => {
    const state = stateWith({ cash: 20_000, health: 98 });
    const result = heal(state, { points: 5, account: 'cash' }, classicContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([result.state.cash, result.state.health]).toEqual([13_000, 100]);
      expect(result.state.journal).toHaveLength(1);
    }
    const poor = stateWith({ cash: 3499, health: 99 });
    const failed = heal(poor, { points: 1, account: 'cash' }, classicContent);
    expect(failed).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(failed.state).toBe(poor);
  });

  it('charges 25,000 at 30,000 cash and half cash plus 2,000 above it', () => {
    for (const [cash, expected] of [[30_000, 5000], [30_001, 13_000]] as const) {
      const state = stateWith({ cash, capacity: 100 });
      const result = upgradeHousing(state, { account: 'cash' }, classicContent);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.cash).toBe(expected);
        expect(result.state.capacity).toBe(110);
        expect(result.state.journal).toHaveLength(1);
      }
    }
  });

  it('rejects upgrades below 30,000 cash and any upgrade exceeding capacity 140', () => {
    for (const state of [
      stateWith({ cash: 29_999 }),
      stateWith({ cash: 100_000, capacity: 140 }),
      stateWith({ cash: 100_000, capacity: 135 }),
    ]) {
      const result = upgradeHousing(state, { account: 'cash' }, classicContent);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
    }
  });

  it('leaves borrowing unavailable until credit rules are implemented', () => {
    const state = stateWith();
    const result = borrow(state, { amount: 1000 }, classicContent);
    expect(result).toMatchObject({ ok: false, error: { code: 'FEATURE_UNAVAILABLE' } });
    expect(result.state).toBe(state);
  });

  it('offers modern services only at declared stations and accepts their payment accounts', () => {
    const state = stateWith({ mode: 'modern', locationId: 'xizhimen', cash: 100_000,
      bank: 10_000, wallet: 10_000, debt: 1000, health: 90 });
    expect(repayDebt(state, { amount: 100, account: 'cash' }, modernContent))
      .toMatchObject({ ok: true, state: { cash: 99_900, debt: 900 } });
    expect(quoteService(state, 'heal', 2, modernContent)).toMatchObject({ cost: 7000, points: 2 });
    expect(heal(state, { points: 2, account: 'bank' }, modernContent))
      .toMatchObject({ ok: true, state: { bank: 3000, health: 92 } });
    expect(heal(state, { points: 2, account: 'wallet' }, modernContent))
      .toMatchObject({ ok: true, state: { wallet: 3000, health: 92 } });
    expect(upgradeHousing(state, { account: 'bank' }, modernContent))
      .toMatchObject({ ok: true, state: { bank: 5000, capacity: 110 } });
    const limited = { ...state, locationId: 'dongzhimen' };
    expect(quoteService(limited, 'heal', 1, modernContent)?.accounts).toEqual(['cash', 'wallet']);
    expect(heal(limited, { points: 1, account: 'bank' }, modernContent))
      .toMatchObject({ ok: false, state: limited, error: { code: 'ACCOUNT_UNSUPPORTED' } });
    expect(upgradeHousing(limited, { account: 'wallet' }, modernContent))
      .toMatchObject({ ok: true, state: { wallet: 5000, capacity: 110 } });
    const poor = { ...state, bank: 100 };
    const failed = heal(poor, { points: 2, account: 'bank' }, modernContent);
    expect(failed).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(failed.state).toBe(poor);
    const frozen = { ...state, walletFrozenDays: 1 };
    expect(heal(frozen, { points: 1, account: 'wallet' }, modernContent))
      .toMatchObject({ ok: false, state: frozen, error: { code: 'WALLET_FROZEN' } });
    for (const locationId of ['zhongguancun', 'nanluoguxiang']) {
      const elsewhere = { ...state, locationId };
      expect(heal(elsewhere, { points: 1, account: 'cash' }, modernContent))
        .toMatchObject({ ok: false, state: elsewhere, error: { code: 'FEATURE_UNAVAILABLE' } });
      expect(upgradeHousing(elsewhere, { account: 'cash' }, modernContent))
        .toMatchObject({ ok: false, state: elsewhere, error: { code: 'FEATURE_UNAVAILABLE' } });
    }
  });
});
