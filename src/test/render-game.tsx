import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import type { GameCommand, GameState } from '../engine/types';
import { GameProvider } from '../game/GameProvider';
import { useGame } from '../game/useGame';
import { AppContent } from '../App';
import { memoryStorage } from './fixtures';
import { saveGame } from '../persistence/storage';

export function renderGame(initialState: GameState, children: ReactNode, storage = memoryStorage()) {
  saveGame(initialState, storage);
  let currentDispatch: ((command: GameCommand) => void) | null = null;
  function Capture() {
    currentDispatch = useGame().dispatch;
    return <>{children}</>;
  }
  const dispatch = vi.fn((command: GameCommand) => currentDispatch?.(command));
  const user = userEvent.setup();
  const renderResult = render(<GameProvider storage={storage} initialState={initialState}><Capture /></GameProvider>);
  return { user, dispatch, storage, ...renderResult };
}

export function renderAppWithState(initialState: GameState) {
  const storage = memoryStorage();
  return renderGame(initialState, <AppContent storage={storage} />, storage);
}
