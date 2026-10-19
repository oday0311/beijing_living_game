import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { GameProvider } from './GameProvider';
import { useGame } from './useGame';
import { CURRENT_SAVE_KEY, loadGame, loadScores, saveGame } from '../persistence/storage';
import { event, memoryStorage, stateWith } from '../test/fixtures';

describe('GameProvider', () => {
  it('loads a saved game for continuation without entering it automatically', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ playerName: '小北', day: 4 }), storage);
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage}>{children}</GameProvider> });
    expect(result.current.state).toBeNull();
    expect(result.current.loadResult).toMatchObject({ kind: 'ok', state: { day: 4 } });
    act(() => result.current.continueGame());
    expect(result.current.state?.day).toBe(4);
  });

  it('saves successful commands and leaves failed commands unchanged', () => {
    const storage = memoryStorage();
    const initialState = stateWith({ cash: 100 });
    saveGame(initialState, storage);
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage} initialState={initialState}>{children}</GameProvider> });
    let outcome = { applied: false, persisted: false };
    act(() => { outcome = result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 10 }); });
    expect(outcome).toEqual({ applied: true, persisted: true });
    const transferred = result.current.state;
    expect(transferred?.bank).toBe(60);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { bank: 60, cash: 90 } });
    act(() => { outcome = result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 999 }); });
    expect(outcome).toEqual({ applied: false, persisted: false });
    expect(result.current.state).toBe(transferred);
    expect(result.current.error).not.toBeNull();
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: transferred });
  });

  it('preserves state when persistence fails', () => {
    const storage = memoryStorage();
    const initialState = stateWith();
    saveGame(initialState, storage);
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage} initialState={initialState}>{children}</GameProvider> });
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === CURRENT_SAVE_KEY) throw new Error('quota');
      setItem(key, value);
    };
    let outcome = { applied: true, persisted: true };
    act(() => { outcome = result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 10 }); });
    expect(outcome).toEqual({ applied: false, persisted: false });
    expect(result.current.state).toBe(initialState);
    expect(result.current.error).toMatch(/保存失败/);
  });

  it('does not replace a corrupt save before explicit abandonment', () => {
    const storage = memoryStorage();
    storage.setItem(CURRENT_SAVE_KEY, '{broken');
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage}>{children}</GameProvider> });
    act(() => result.current.startGame({ mode: 'classic', playerName: '小北', identityId: null }));
    expect(result.current.state).toBeNull();
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBe('{broken');
    act(() => result.current.abandonGame());
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBeNull();
  });

  it('plays in memory when browser storage is unavailable', () => {
    const storage = memoryStorage();
    storage.getItem = () => { throw new Error('blocked'); };
    storage.setItem = () => { throw new Error('blocked'); };
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage}>{children}</GameProvider> });
    expect(result.current.storageAvailable).toBe(false);
    act(() => result.current.startGame({ mode: 'classic', playerName: '小北', identityId: null }));
    expect(result.current.state).not.toBeNull();
    let outcome = { applied: false, persisted: true };
    act(() => { outcome = result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 10 }); });
    expect(outcome).toEqual({ applied: true, persisted: false });
    expect(result.current.state?.bank).toBe(10);
    expect(result.current.error).toBeNull();
  });

  it('reports event acknowledgement as applied only when the queue changes', () => {
    const storage = memoryStorage();
    const initialState = stateWith({ pendingEvents: [event('Notice')] });
    saveGame(initialState, storage);
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage} initialState={initialState}>{children}</GameProvider> });
    let outcome = { applied: false, persisted: false };
    act(() => { outcome = result.current.dispatch({ type: 'ACK_EVENT' }); });
    expect(outcome).toEqual({ applied: true, persisted: true });
    expect(result.current.state?.pendingEvents).toHaveLength(0);
    act(() => { outcome = result.current.dispatch({ type: 'ACK_EVENT' }); });
    expect(outcome).toEqual({ applied: false, persisted: false });
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { pendingEvents: [] } });
  });

  it('saves final-day events through reload and records the score once', () => {
    const storage = memoryStorage();
    const initialState = stateWith({ day: 39, locationId: 'xizhimen', cash: 10000, debt: 0 });
    saveGame(initialState, storage);
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage} initialState={initialState}>{children}</GameProvider> });
    act(() => result.current.dispatch({ type: 'TRAVEL', targetId: 'fuxingmen' }));
    expect(result.current.state?.day).toBe(40);
    const queued = result.current.state?.pendingEvents.map(({ id }) => id);
    expect(queued?.length).toBeGreaterThan(0);
    expect(loadScores(storage).modern).toHaveLength(1);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 40, pendingEvents: result.current.state?.pendingEvents } });
    const resumed = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage}>{children}</GameProvider> });
    act(() => resumed.result.current.continueGame());
    expect(resumed.result.current.state?.pendingEvents.map(({ id }) => id)).toEqual(queued);
    while (resumed.result.current.state?.pendingEvents.length) {
      act(() => resumed.result.current.dispatch({ type: 'ACK_EVENT' }));
    }
    expect(resumed.result.current.state?.finalScore).toBe(result.current.state?.finalScore);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { pendingEvents: [], finalScore: result.current.state?.finalScore } });
    expect(loadScores(storage).modern).toHaveLength(1);
    act(() => resumed.result.current.returnToStart());
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 40 } });
    act(() => resumed.result.current.abandonGame());
    expect(loadGame(storage)).toEqual({ kind: 'empty' });
  });
});
