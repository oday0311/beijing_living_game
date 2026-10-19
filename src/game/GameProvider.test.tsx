import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { GameProvider } from './GameProvider';
import { useGame } from './useGame';
import { CURRENT_SAVE_KEY, loadGame, loadScores, saveGame } from '../persistence/storage';
import { memoryStorage, stateWith } from '../test/fixtures';

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
    act(() => result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 10 }));
    const transferred = result.current.state;
    expect(transferred?.bank).toBe(60);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { bank: 60, cash: 90 } });
    act(() => result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 999 }));
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
    act(() => result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 10 }));
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
    act(() => result.current.dispatch({ type: 'TRANSFER', from: 'cash', to: 'bank', amount: 10 }));
    expect(result.current.state?.bank).toBe(10);
    expect(result.current.error).toBeNull();
  });

  it('records a completed game before clearing its current save', () => {
    const storage = memoryStorage();
    const initialState = stateWith({ day: 39, locationId: 'xizhimen', cash: 10000, debt: 0 });
    saveGame(initialState, storage);
    const { result } = renderHook(useGame, { wrapper: ({ children }: { children: ReactNode }) =>
      <GameProvider storage={storage} initialState={initialState}>{children}</GameProvider> });
    act(() => result.current.dispatch({ type: 'TRAVEL', targetId: 'fuxingmen' }));
    expect(result.current.state?.day).toBe(40);
    expect(loadScores(storage).modern).toHaveLength(1);
    expect(loadGame(storage)).toEqual({ kind: 'empty' });
  });
});
