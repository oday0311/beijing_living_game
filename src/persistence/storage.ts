import type { GameState, Mode } from '../engine/types';
import { defaultSettings, gameStateSchema, scoreSchema, settingsSchema } from './schema';
import type { GameSettings, ScoreEntry } from './schema';

export const CURRENT_SAVE_KEY = 'beijing-fushengji.save.v1';
export const BACKUP_SAVE_KEY = 'beijing-fushengji.save.backup.v1';
const SAVE_TRANSACTION_KEY = 'beijing-fushengji.save.transaction.v1';
const CLEAR_TOMBSTONE_KEY = 'beijing-fushengji.save.clearing.v1';
export const SETTINGS_KEY = 'beijing-fushengji.settings.v1';
export const SCORES_KEY = 'beijing-fushengji.scores.v1';

export type LoadGameResult =
  | { kind: 'empty' }
  | { kind: 'unavailable' }
  | { kind: 'ok'; state: GameState }
  | { kind: 'corrupt'; raw: string }
  | { kind: 'incompatible'; raw: string };

function parseSave(raw: string): Extract<LoadGameResult, { kind: 'ok' | 'corrupt' | 'incompatible' }> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt', raw };
  }
  if (typeof data === 'object' && data !== null && 'schemaVersion' in data && data.schemaVersion !== 1) {
    return { kind: 'incompatible', raw };
  }
  const parsed = gameStateSchema.safeParse(data);
  return parsed.success ? { kind: 'ok', state: parsed.data } : { kind: 'corrupt', raw };
}

interface SaveTransaction {
  phase: 'pending' | 'committed';
  previousCurrent: string;
  previousBackup: string | null;
  nextCurrent: string;
}

function readTransaction(storage: Storage): SaveTransaction | null {
  const raw = storage.getItem(SAVE_TRANSACTION_KEY);
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data === 'object' && data !== null &&
      'phase' in data && (data.phase === 'pending' || data.phase === 'committed') &&
      'previousCurrent' in data && typeof data.previousCurrent === 'string' &&
      'previousBackup' in data && (data.previousBackup === null || typeof data.previousBackup === 'string') &&
      'nextCurrent' in data && typeof data.nextCurrent === 'string' &&
      parseSave(data.previousCurrent).kind === 'ok' && parseSave(data.nextCurrent).kind === 'ok') {
      return data as SaveTransaction;
    }
  } catch { /* A damaged transaction marker cannot be trusted. */ }
  throw new Error('Save transaction marker is corrupt');
}

function restorePreviousBackup(storage: Storage, raw: string | null): void {
  if (raw === null) storage.removeItem(BACKUP_SAVE_KEY);
  else storage.setItem(BACKUP_SAVE_KEY, raw);
}

function recoverPendingSave(storage: Storage, replaceInvalid: boolean): void {
  const transaction = readTransaction(storage);
  if (transaction === null) return;
  if (transaction.phase === 'committed') {
    try { storage.removeItem(SAVE_TRANSACTION_KEY); }
    catch { /* The committed marker may be replaced by the next transaction. */ }
    return;
  }
  const current = storage.getItem(CURRENT_SAVE_KEY);
  if (current !== null && parseSave(current).kind !== 'ok') {
    if (!replaceInvalid) throw new Error('Current save is invalid; export or clear it before saving');
    restorePreviousBackup(storage, transaction.previousBackup);
    storage.removeItem(SAVE_TRANSACTION_KEY);
    return;
  }
  storage.setItem(CURRENT_SAVE_KEY, transaction.previousCurrent);
  restorePreviousBackup(storage, transaction.previousBackup);
  storage.removeItem(SAVE_TRANSACTION_KEY);
}

export function loadGame(storage?: Storage): LoadGameResult {
  try {
    const target = storage ?? localStorage;
    if (target.getItem(CLEAR_TOMBSTONE_KEY) !== null) return { kind: 'empty' };
    const raw = target.getItem(CURRENT_SAVE_KEY);
    const parsedCurrent = raw === null ? null : parseSave(raw);
    if (parsedCurrent !== null && parsedCurrent.kind !== 'ok') return parsedCurrent;
    const transaction = readTransaction(target);
    if (transaction?.phase === 'pending') return parseSave(transaction.previousCurrent);
    if (transaction?.phase === 'committed') return parseSave(transaction.nextCurrent);
    return parsedCurrent ?? { kind: 'empty' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export function saveGame(state: GameState, storage: Storage = localStorage): void {
  writeGame(gameStateSchema.parse(state), storage, false);
}

function writeGame(state: GameState, storage: Storage, replaceInvalid: boolean): void {
  if (storage.getItem(CLEAR_TOMBSTONE_KEY) !== null) {
    storage.removeItem(SAVE_TRANSACTION_KEY);
    storage.setItem(CURRENT_SAVE_KEY, JSON.stringify(state));
    storage.removeItem(CLEAR_TOMBSTONE_KEY);
    return;
  }
  recoverPendingSave(storage, replaceInvalid);
  const current = storage.getItem(CURRENT_SAVE_KEY);
  const validCurrent = current !== null && parseSave(current).kind === 'ok';
  if (current !== null && !validCurrent && !replaceInvalid) {
    throw new Error('Current save is invalid; export or clear it before saving');
  }
  const nextCurrent = JSON.stringify(state);
  const transaction: SaveTransaction | null = validCurrent ? {
    phase: 'pending', previousCurrent: current, previousBackup: storage.getItem(BACKUP_SAVE_KEY), nextCurrent,
  } : null;
  if (transaction) storage.setItem(SAVE_TRANSACTION_KEY, JSON.stringify(transaction));
  try {
    storage.setItem(CURRENT_SAVE_KEY, nextCurrent);
    if (transaction) {
      storage.setItem(BACKUP_SAVE_KEY, transaction.previousCurrent);
      storage.setItem(SAVE_TRANSACTION_KEY, JSON.stringify({ ...transaction, phase: 'committed' }));
    }
  } catch (error) {
    if (transaction) {
      try {
        storage.setItem(CURRENT_SAVE_KEY, transaction.previousCurrent);
        restorePreviousBackup(storage, transaction.previousBackup);
        storage.removeItem(SAVE_TRANSACTION_KEY);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Failed to update backup and restore current save', { cause: rollbackError });
      }
    }
    throw error;
  }
  if (transaction) {
    try { storage.removeItem(SAVE_TRANSACTION_KEY); }
    catch { /* The matching backup marks a completed transaction on the next read. */ }
  }
}

export function restoreBackup(storage?: Storage): GameState | null {
  try {
    const target = storage ?? localStorage;
    if (target.getItem(CLEAR_TOMBSTONE_KEY) !== null) {
      const raw = target.getItem(BACKUP_SAVE_KEY);
      if (raw === null) return null;
      const result = parseSave(raw);
      if (result.kind !== 'ok') return null;
      target.removeItem(SAVE_TRANSACTION_KEY);
      target.setItem(CURRENT_SAVE_KEY, raw);
      target.removeItem(CLEAR_TOMBSTONE_KEY);
      return result.state;
    }
    recoverPendingSave(target, true);
    const raw = target.getItem(BACKUP_SAVE_KEY);
    if (raw === null) return null;
    const result = parseSave(raw);
    if (result.kind !== 'ok') return null;
    target.removeItem(SAVE_TRANSACTION_KEY);
    target.setItem(CURRENT_SAVE_KEY, raw);
    return result.state;
  } catch {
    return null;
  }
}

export function exportCorruptSave(storage?: Storage): string | null {
  const result = loadGame(storage);
  return result.kind === 'corrupt' || result.kind === 'incompatible' ? result.raw : null;
}

export function exportGame(state: GameState): string {
  return JSON.stringify(gameStateSchema.parse(state));
}

export function importGame(raw: string, storage: Storage = localStorage): Exclude<LoadGameResult, { kind: 'empty' }> {
  const result = parseSave(raw);
  if (result.kind === 'ok') writeGame(result.state, storage, true);
  return result;
}

export function clearCurrentGame(storage: Storage = localStorage): void {
  storage.setItem(CLEAR_TOMBSTONE_KEY, '1');
  storage.removeItem(CURRENT_SAVE_KEY);
  storage.removeItem(SAVE_TRANSACTION_KEY);
  storage.removeItem(CLEAR_TOMBSTONE_KEY);
}

export function saveSettings(settings: GameSettings, storage: Storage = localStorage): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settingsSchema.parse(settings)));
}

export function loadSettings(storage?: Storage): GameSettings {
  try {
    const raw = (storage ?? localStorage).getItem(SETTINGS_KEY);
    if (raw === null) return { ...defaultSettings };
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch { /* Invalid settings fall back to defaults. */ }
  return { ...defaultSettings };
}

export type ScoresByMode = Record<Mode, ScoreEntry[]>;

function emptyScores(): ScoresByMode {
  return { classic: [], modern: [] };
}

function readScores(storage: Storage): { scores: ScoresByMode; corrupt: boolean } {
  const raw = storage.getItem(SCORES_KEY);
  if (raw === null) return { scores: emptyScores(), corrupt: false };
  const scores = emptyScores();
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries)) return { scores, corrupt: true };
    let corrupt = false;
    for (const entry of entries) {
      const parsed = scoreSchema.safeParse(entry);
      if (parsed.success) scores[parsed.data.mode].push(parsed.data);
      else corrupt = true;
    }
    for (const mode of ['classic', 'modern'] as const) {
      scores[mode].sort((a, b) => b.score - a.score || a.finishedAt.localeCompare(b.finishedAt) || a.id.localeCompare(b.id));
      scores[mode] = scores[mode].slice(0, 10);
    }
    return { scores, corrupt };
  } catch {
    return { scores, corrupt: true };
  }
}

export function loadScores(storage?: Storage): ScoresByMode {
  try {
    return readScores(storage ?? localStorage).scores;
  } catch {
    return emptyScores();
  }
}

export function recordScore(entry: ScoreEntry, storage: Storage = localStorage): ScoresByMode {
  const validated = scoreSchema.parse(entry);
  const { scores, corrupt } = readScores(storage);
  if (corrupt) throw new Error('Score data is corrupt; preserve it before recording another score');
  if (scores.classic.some(({ id }) => id === validated.id) || scores.modern.some(({ id }) => id === validated.id)) {
    return scores;
  }
  scores[validated.mode].push(validated);
  scores[validated.mode].sort((a, b) => b.score - a.score || a.finishedAt.localeCompare(b.finishedAt) || a.id.localeCompare(b.id));
  scores[validated.mode] = scores[validated.mode].slice(0, 10);
  storage.setItem(SCORES_KEY, JSON.stringify([...scores.classic, ...scores.modern]));
  return scores;
}
