import type { CommandResult, EngineErrorCode, GameState, JournalEntry } from './types';

export function failure(state: GameState, code: EngineErrorCode, message: string): CommandResult {
  return { ok: false, state, error: { code, message } };
}

export function success(
  state: GameState,
  changes: Partial<GameState>,
  entry: Omit<JournalEntry, 'id' | 'day'>,
): CommandResult {
  return {
    ok: true,
    state: {
      ...state,
      ...changes,
      journal: [...state.journal, { id: `${state.day}:${state.journal.length + 1}`, day: state.day, ...entry }],
    },
  };
}
