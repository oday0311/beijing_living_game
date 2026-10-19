import { describe, expect, it } from 'vitest';
import { createGame } from './create-game';
import { SeededRng } from './rng';
import { stubPack } from '../test/fixtures';

describe('SeededRng', () => {
  it('produces the same sequence from the same seed', () => {
    const first = new SeededRng(20261019);
    const second = new SeededRng(20261019);

    expect([first.int(100), first.int(100), first.int(100)])
      .toEqual([second.int(100), second.int(100), second.int(100)]);
    expect(first.state).toBe(second.state);
  });

  it('advances an unsigned xorshift32 state and keeps results in bounds', () => {
    const rng = new SeededRng(1);

    expect(rng.int(100)).toBe(69);
    expect(rng.state).toBe(270369);
    expect(rng.int(1)).toBe(0);
    expect(rng.state).toBeGreaterThanOrEqual(0);
    expect(rng.state).toBeLessThanOrEqual(0xffffffff);
  });

  it('rejects non-positive bounds and advances from a zero seed', () => {
    const rng = new SeededRng(0);

    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(-1)).toThrow(RangeError);
    expect(rng.int(100)).toBeGreaterThanOrEqual(0);
    expect(rng.state).not.toBe(0);
  });
});

describe('game initialization', () => {
  it('creates a reproducible visible day-one state', () => {
    const first = createGame(stubPack, {
      playerName: '  Tie Niu  ', seed: 20261019, identityId: null,
    });
    const second = createGame(stubPack, {
      playerName: '  Tie Niu  ', seed: 20261019, identityId: null,
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 1,
      mode: 'modern',
      playerName: 'Tie Niu',
      seed: 20261019,
      day: 1,
      daysTotal: 40,
      inventory: {},
      pendingEvents: [],
      journal: [],
      status: 'playing',
      finalScore: null,
      identityId: null,
      walletFrozenDays: 0,
    });
    expect(first.modern).toEqual({
      onTimeRepayments: 0,
      dailyWalletTransferred: 0,
      shopkeeperCapacityBonus: 0,
      freeTransitUses: 0,
      revealTrendDaysBonus: 0,
    });
  });

  it('copies initial balances and generates each market price from the seeded stream', () => {
    const state = createGame(stubPack, {
      playerName: 'Player', seed: 1, identityId: null,
    });
    expect(state).toMatchObject(stubPack.initial);
    expect(state.market).toEqual({ item_a: 109, item_b: 59 });
    expect(state.rngState).toBe(67634689);
  });

  it('does not change the supplied content while initializing a classic game', () => {
    const pack = structuredClone(stubPack);
    pack.mode = 'classic';
    const before = structuredClone(pack);

    const state = createGame(pack, {
      playerName: 'Player', seed: 8, identityId: null,
    });

    expect(pack).toEqual(before);
    expect(state.mode).toBe('classic');
    expect(state.modern).toBeNull();
  });
});
