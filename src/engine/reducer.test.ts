import { describe, expect, it } from 'vitest';
import { classicContent } from '../content/classic';
import { createGame } from './create-game';
import { reduceGameState } from './reducer';

describe('command reducer', () => {
  it('dispatches a purchase with exactly one journal entry', () => {
    const state = { ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }), locationId: 'jianguomen', market: { vcd: 40 }, cash: 1000 };
    const result = reduceGameState(state, { type: 'BUY', itemId: 'vcd', quantity: 1, account: 'cash' }, classicContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.cash).toBe(960);
      expect(result.state.journal).toHaveLength(1);
    }
  });

  it('rejects commands after the game ends with the original state reference', () => {
    const state = { ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }), status: 'lost' as const };
    const result = reduceGameState(state, { type: 'BORROW', amount: 100 }, classicContent);
    expect(result).toMatchObject({ ok: false, error: { code: 'GAME_ENDED' } });
    expect(result.state).toBe(state);
  });
});
