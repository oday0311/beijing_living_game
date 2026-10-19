import type { GameState, Mode } from '../engine/types';
import { defaultSettings, gameStateSchema, scoreSchema, settingsSchema } from './schema';
import type { GameSettings, ScoreEntry } from './schema';

export const CURRENT_SAVE_KEY = 'beijing-fushengji.save.v1';
export const BACKUP_SAVE_KEY = 'beijing-fushengji.save.backup.v1';
export const SETTINGS_KEY = 'beijing-fushengji.settings.v1';
export const SCORES_KEY = 'beijing-fushengji.scores.v1';

export type LoadGameResult =
  | { kind: 'empty' }
  | { kind: 'ok'; state: GameState }
  | { kind: 'corrupt'; raw: string }
  | { kind: 'incompatible'; raw: string };

function parseSave(raw: string): Exclude<LoadGameResult, { kind: 'empty' }> {
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

export function loadGame(storage: Storage = localStorage): LoadGameResult {
  const raw = storage.getItem(CURRENT_SAVE_KEY);
  return raw === null ? { kind: 'empty' } : parseSave(raw);
}

export function saveGame(state: GameState, storage: Storage = localStorage): void {
  writeGame(gameStateSchema.parse(state), storage, false);
}

function writeGame(state: GameState, storage: Storage, replaceInvalid: boolean): void {
  const current = storage.getItem(CURRENT_SAVE_KEY);
  if (current !== null) {
    if (parseSave(current).kind === 'ok') {
      storage.setItem(BACKUP_SAVE_KEY, current);
    } else if (!replaceInvalid) {
      throw new Error('Current save is invalid; export or clear it before saving');
    }
  }
  storage.setItem(CURRENT_SAVE_KEY, JSON.stringify(state));
}

export function restoreBackup(storage: Storage = localStorage): GameState | null {
  const raw = storage.getItem(BACKUP_SAVE_KEY);
  if (raw === null) return null;
  const result = parseSave(raw);
  if (result.kind !== 'ok') return null;
  storage.setItem(CURRENT_SAVE_KEY, raw);
  return result.state;
}

export function exportCorruptSave(storage: Storage = localStorage): string | null {
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
  storage.removeItem(CURRENT_SAVE_KEY);
}

export function saveSettings(settings: GameSettings, storage: Storage = localStorage): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settingsSchema.parse(settings)));
}

export function loadSettings(storage: Storage = localStorage): GameSettings {
  const raw = storage.getItem(SETTINGS_KEY);
  if (raw === null) return { ...defaultSettings };
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch { /* Invalid settings fall back to defaults. */ }
  return { ...defaultSettings };
}

export type ScoresByMode = Record<Mode, ScoreEntry[]>;

function emptyScores(): ScoresByMode {
  return { classic: [], modern: [] };
}

export function loadScores(storage: Storage = localStorage): ScoresByMode {
  const raw = storage.getItem(SCORES_KEY);
  if (raw === null) return emptyScores();
  try {
    const parsed = scoreSchema.array().safeParse(JSON.parse(raw));
    if (!parsed.success) return emptyScores();
    const scores = emptyScores();
    for (const entry of parsed.data) scores[entry.mode].push(entry);
    for (const mode of ['classic', 'modern'] as const) {
      scores[mode].sort((a, b) => b.score - a.score || a.finishedAt.localeCompare(b.finishedAt) || a.id.localeCompare(b.id));
      scores[mode] = scores[mode].slice(0, 10);
    }
    return scores;
  } catch {
    return emptyScores();
  }
}

export function recordScore(entry: ScoreEntry, storage: Storage = localStorage): ScoresByMode {
  const validated = scoreSchema.parse(entry);
  const scores = loadScores(storage);
  if (scores.classic.some(({ id }) => id === validated.id) || scores.modern.some(({ id }) => id === validated.id)) {
    return scores;
  }
  scores[validated.mode].push(validated);
  scores[validated.mode].sort((a, b) => b.score - a.score || a.finishedAt.localeCompare(b.finishedAt) || a.id.localeCompare(b.id));
  scores[validated.mode] = scores[validated.mode].slice(0, 10);
  storage.setItem(SCORES_KEY, JSON.stringify([...scores.classic, ...scores.modern]));
  return scores;
}
