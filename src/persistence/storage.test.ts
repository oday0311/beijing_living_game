import { describe, expect, it } from 'vitest';
import { classicContent } from '../content/classic';
import { modernContent } from '../content/modern';
import { createGame } from '../engine/create-game';
import { memoryStorage, stateWith } from '../test/fixtures';
import {
  BACKUP_SAVE_KEY, CURRENT_SAVE_KEY, clearCurrentGame, exportCorruptSave,
  exportGame, importGame, loadGame, loadScores, loadSettings, recordScore,
  restoreBackup, saveGame, saveSettings,
} from './storage';

describe('local game saves', () => {
  it('continues with every deterministic field intact', () => {
    const storage = memoryStorage();
    const state = stateWith({ day: 9, rngState: 4294967295, seed: 42 });
    saveGame(state, storage);
    expect(loadGame(storage)).toEqual({ kind: 'ok', state });
  });

  it('round trips initial states from both real content packs', () => {
    for (const pack of [classicContent, modernContent]) {
      const storage = memoryStorage();
      const state = createGame(pack, { playerName: 'Player', seed: 987654, identityId: null });
      saveGame(state, storage);
      expect(loadGame(storage)).toEqual({ kind: 'ok', state });
    }
  });

  it('normalizes fractional seeds so new games remain saveable', () => {
    const storage = memoryStorage();
    const state = createGame(classicContent, { playerName: 'Player', seed: 7.9, identityId: null });
    expect(state.seed).toBe(7);
    saveGame(state, storage);
    expect(loadGame(storage)).toEqual({ kind: 'ok', state });
  });

  it('rejects an unfinished day 40 and inconsistent final scores', () => {
    const storage = memoryStorage();
    for (const state of [
      stateWith({ day: 40, status: 'playing', finalScore: null }),
      stateWith({ day: 12, status: 'playing', finalScore: 1 }),
      stateWith({ day: 40, status: 'won', finalScore: null }),
      stateWith({ day: 39, status: 'won', finalScore: 1 }),
      stateWith({ day: 40, status: 'lost', finalScore: null }),
      stateWith({ day: 39, status: 'lost', finalScore: 1 }),
    ]) {
      expect(importGame(JSON.stringify(state), storage).kind).toBe('corrupt');
    }
    expect(importGame(JSON.stringify(stateWith({ day: 39, status: 'lost', finalScore: null })), storage).kind).toBe('ok');
  });

  it('keeps the previous valid save as backup', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ day: 3 }), storage);
    saveGame(stateWith({ day: 4 }), storage);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 4 } });
    expect(restoreBackup(storage)).toMatchObject({ day: 3 });
  });

  it('preserves both previous slots when writing the current slot fails', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ day: 2 }), storage);
    saveGame(stateWith({ day: 3 }), storage);
    const originalCurrent = storage.getItem(CURRENT_SAVE_KEY);
    const originalBackup = storage.getItem(BACKUP_SAVE_KEY);
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === CURRENT_SAVE_KEY) throw new DOMException('blocked', 'QuotaExceededError');
      setItem(key, value);
    };
    expect(() => saveGame(stateWith({ day: 4 }), storage)).toThrow();
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBe(originalCurrent);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it('rolls back the current slot when the backup write fails', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ day: 2 }), storage);
    saveGame(stateWith({ day: 3 }), storage);
    const originalCurrent = storage.getItem(CURRENT_SAVE_KEY);
    const originalBackup = storage.getItem(BACKUP_SAVE_KEY);
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === BACKUP_SAVE_KEY) throw new DOMException('blocked', 'QuotaExceededError');
      setItem(key, value);
    };
    expect(() => saveGame(stateWith({ day: 4 }), storage)).toThrow();
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBe(originalCurrent);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it('recovers the old current after both backup write and rollback fail', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ day: 2 }), storage);
    saveGame(stateWith({ day: 3 }), storage);
    const originalBackup = storage.getItem(BACKUP_SAVE_KEY);
    const setItem = storage.setItem.bind(storage);
    let currentWrites = 0;
    storage.setItem = (key, value) => {
      if (key === CURRENT_SAVE_KEY && ++currentWrites === 2) {
        throw new DOMException('blocked', 'QuotaExceededError');
      }
      if (key === BACKUP_SAVE_KEY) throw new DOMException('blocked', 'QuotaExceededError');
      setItem(key, value);
    };
    expect(() => saveGame(stateWith({ day: 4 }), storage)).toThrow();
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 3 } });
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
    storage.setItem = setItem;
    saveGame(stateWith({ day: 5 }), storage);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 5 } });
    expect(restoreBackup(storage)).toMatchObject({ day: 3 });
  });

  it('preserves malformed raw data for export and does not overwrite it on automatic save', () => {
    const storage = memoryStorage();
    storage.setItem(CURRENT_SAVE_KEY, '{broken');
    expect(loadGame(storage)).toEqual({ kind: 'corrupt', raw: '{broken' });
    expect(exportCorruptSave(storage)).toBe('{broken');
    expect(() => saveGame(stateWith(), storage)).toThrow();
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBe('{broken');
  });

  it('does not hide corrupt current data behind an interrupted transaction', () => {
    const storage = memoryStorage();
    storage.setItem('beijing-fushengji.save.transaction.v1',
      JSON.stringify({ previousCurrent: exportGame(stateWith({ day: 3 })) }));
    storage.setItem(CURRENT_SAVE_KEY, '{broken');
    expect(loadGame(storage)).toEqual({ kind: 'corrupt', raw: '{broken' });
    expect(exportCorruptSave(storage)).toBe('{broken');
    expect(() => saveGame(stateWith({ day: 4 }), storage)).toThrow();
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBe('{broken');
  });

  it('rejects an incompatible version without rewriting either copy', () => {
    const storage = memoryStorage();
    const raw = JSON.stringify({ ...stateWith(), schemaVersion: 2 });
    storage.setItem(CURRENT_SAVE_KEY, raw);
    expect(loadGame(storage)).toEqual({ kind: 'incompatible', raw });
    expect(exportCorruptSave(storage)).toBe(raw);
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBe(raw);
  });

  it('rejects structurally invalid JSON without changing a valid save', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ day: 7 }), storage);
    const original = storage.getItem(CURRENT_SAVE_KEY);
    const bad = JSON.stringify({ ...stateWith(), rngState: 'lost' });
    expect(importGame(bad, storage)).toMatchObject({ kind: 'corrupt', raw: bad });
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBe(original);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 7 } });
  });

  it('round trips exported JSON and keeps the previous save as backup', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ day: 2 }), storage);
    const imported = stateWith({ day: 17, rngState: 1234 });
    expect(importGame(exportGame(imported), storage)).toEqual({ kind: 'ok', state: imported });
    expect(restoreBackup(storage)).toMatchObject({ day: 2 });
  });

  it('explicitly imports a valid save over corrupt data without backing up the corrupt text', () => {
    const storage = memoryStorage();
    storage.setItem(CURRENT_SAVE_KEY, '{broken');
    const imported = stateWith({ day: 17 });
    expect(importGame(exportGame(imported), storage)).toEqual({ kind: 'ok', state: imported });
    expect(loadGame(storage)).toEqual({ kind: 'ok', state: imported });
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBeNull();
  });

  it('rejects forged state without silently stripping fields', () => {
    const storage = memoryStorage();
    const forged = JSON.stringify({ ...stateWith(), extraCommand: 'TRANSFER' });
    expect(importGame(forged, storage).kind).toBe('corrupt');
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBeNull();
  });

  it('rejects a mode and state mismatch without changing storage', () => {
    const storage = memoryStorage();
    const bad = JSON.stringify({ ...stateWith(), mode: 'classic' });
    expect(importGame(bad, storage).kind).toBe('corrupt');
    expect(storage.getItem(CURRENT_SAVE_KEY)).toBeNull();
  });

  it('restores a backup on explicit request after a corrupt save is offered for export', () => {
    const storage = memoryStorage();
    storage.setItem(BACKUP_SAVE_KEY, exportGame(stateWith({ day: 5 })));
    storage.setItem(CURRENT_SAVE_KEY, '{broken');
    expect(exportCorruptSave(storage)).toBe('{broken');
    expect(restoreBackup(storage)).toMatchObject({ day: 5 });
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 5 } });
    clearCurrentGame(storage);
    expect(loadGame(storage)).toEqual({ kind: 'empty' });
    expect(restoreBackup(storage)).toMatchObject({ day: 5 });
  });

  it('returns a safe state when storage reads are blocked', () => {
    const storage = memoryStorage();
    storage.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    expect(loadGame(storage)).toEqual({ kind: 'unavailable' });
    expect(exportCorruptSave(storage)).toBeNull();
    expect(restoreBackup(storage)).toBeNull();
    expect(loadSettings(storage)).toEqual({ soundEnabled: true, animationsEnabled: true, compactDisplay: false });
    expect(loadScores(storage)).toEqual({ classic: [], modern: [] });
  });
});

describe('settings and scores', () => {
  it('loads defaults after invalid settings and round trips valid settings', () => {
    const storage = memoryStorage();
    const defaults = loadSettings(storage);
    storage.setItem('beijing-fushengji.settings.v1', '{broken');
    expect(loadSettings(storage)).toEqual(defaults);
    const settings = { soundEnabled: false, animationsEnabled: false, compactDisplay: true };
    saveSettings(settings, storage);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('ranks ten per mode and ignores duplicate IDs after refresh', () => {
    const storage = memoryStorage();
    for (let index = 0; index < 12; index += 1) {
      recordScore({ id: `classic-${index}`, playerName: 'Player', mode: 'classic',
        score: index, health: 100, fame: 0, finishedAt: '2026-10-19T00:00:00.000Z' }, storage);
    }
    recordScore({ id: 'modern-1', playerName: 'Player', mode: 'modern',
      score: 50, health: 80, fame: 20, finishedAt: '2026-10-19T00:00:00.000Z' }, storage);
    recordScore({ id: 'classic-11', playerName: 'Player', mode: 'classic',
      score: 999, health: 100, fame: 0, finishedAt: '2026-10-19T00:00:00.000Z' }, storage);
    expect(loadScores(storage).classic.map(({ score }) => score)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(loadScores(storage).modern).toHaveLength(1);
  });

  it('shows valid score entries but preserves mixed corrupt raw data on record', () => {
    const storage = memoryStorage();
    const valid = { id: 'valid', playerName: 'Player', mode: 'classic' as const,
      score: 30, health: 100, fame: 0, finishedAt: '2026-10-19T00:00:00.000Z' };
    const raw = JSON.stringify([valid, { id: 'bad', score: 'not-a-number' }]);
    storage.setItem('beijing-fushengji.scores.v1', raw);
    expect(loadScores(storage).classic).toEqual([valid]);
    expect(() => recordScore({ ...valid, id: 'next' }, storage)).toThrow();
    expect(storage.getItem('beijing-fushengji.scores.v1')).toBe(raw);
  });
});
