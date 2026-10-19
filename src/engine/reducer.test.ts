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

  it('rejects classic wallet transfers through command dispatch', () => {
    const state = { ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }), wallet: 10 };
    const result = reduceGameState(state, { type: 'TRANSFER', from: 'wallet', to: 'cash', amount: 1 }, classicContent);
    expect(result).toMatchObject({ ok: false, error: { code: 'ACCOUNT_UNSUPPORTED' } });
    expect(result.state).toBe(state);
  });

  it('dispatches travel and persists its random state', () => {
    const state = { ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }), locationId: 'jianguomen' };
    const result = reduceGameState(state, { type: 'TRAVEL', targetId: 'fuxingmen' }, classicContent);
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({ day: 2, locationId: 'fuxingmen' });
    expect(result.state.rngState).not.toBe(state.rngState);
    expect(result.state.journal[0]).toMatchObject({ title: '换站', detail: '复兴门' });
    expect(result.state.journal.at(-1)).toMatchObject({ title: '债务利息', delta: { debt: 550 } });
  });

  it('allows the final event to be acknowledged after the game ends', () => {
    const state = {
      ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }),
      status: 'won' as const,
      pendingEvents: [{ id: 'end', kind: 'system' as const, title: 'End', body: 'End', artId: 'end' }],
    };
    const result = reduceGameState(state, { type: 'ACK_EVENT' }, classicContent);
    expect(result).toMatchObject({ ok: true, state: { pendingEvents: [] } });
    expect(state.pendingEvents).toHaveLength(1);
  });

  it('does not advance time while a queued event awaits acknowledgement', () => {
    const state = {
      ...createGame(classicContent, { playerName: 'Player', seed: 1, identityId: null }),
      locationId: 'xizhimen',
      pendingEvents: [{ id: 'notice', kind: 'system' as const, title: 'Notice', body: 'Notice', artId: 'notice' }],
    };
    const blocked = reduceGameState(state, { type: 'TRAVEL', targetId: 'fuxingmen' }, classicContent);
    expect(blocked).toMatchObject({ ok: false, state, error: { code: 'EVENT_PENDING' } });
    expect(blocked.state).toBe(state);
    const acknowledged = reduceGameState(state, { type: 'ACK_EVENT' }, classicContent);
    const travelled = reduceGameState(acknowledged.state, { type: 'TRAVEL', targetId: 'fuxingmen' }, classicContent);
    expect(travelled).toMatchObject({ ok: true, state: { day: 2, locationId: 'fuxingmen' } });
  });
});
