import { createContext, useContext } from 'react';
import type { GameCommand, GameState, Mode } from '../engine/types';
import type { LoadGameResult } from '../persistence/storage';

export interface StartGameOptions {
  mode: Mode;
  playerName: string;
  identityId: string | null;
}

export interface DispatchResult {
  applied: boolean;
  persisted: boolean;
}

export interface GameSession {
  state: GameState | null;
  loadResult: LoadGameResult;
  storageAvailable: boolean;
  error: string | null;
  dispatch: (command: GameCommand) => DispatchResult;
  startGame: (options: StartGameOptions) => void;
  continueGame: () => void;
  restoreSavedGame: () => void;
  importSavedGame: (raw: string) => boolean;
  abandonGame: () => void;
  returnToStart: () => void;
  clearError: () => void;
  accelerateToFinalDayForTest: () => void;
}

export const GameContext = createContext<GameSession | null>(null);

export function useGame(): GameSession {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
}
