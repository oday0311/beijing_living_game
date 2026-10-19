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

  it('keeps the previous valid save as backup', () => {
    const storage = memoryStorage();
    saveGame(stateWith({ day: 3 }), storage);
    saveGame(stateWith({ day: 4 }), storage);
    expect(loadGame(storage)).toMatchObject({ kind: 'ok', state: { day: 4 } });
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
});
