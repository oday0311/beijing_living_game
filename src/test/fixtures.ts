import type { ContentPack } from '../content/contract';
import { createGame } from '../engine/create-game';
import type { GameEvent, GameState, RandomSource, Trend } from '../engine/types';

export const stubPack: ContentPack = {
  mode: 'modern',
  daysTotal: 40,
  initial: {
    cash: 100,
    bank: 50,
    wallet: 20,
    debt: 0,
    health: 100,
    fame: 0,
    credit: 'D',
    capacity: 10,
    locationId: 'loc_a',
  },
  goods: [
    { id: 'item_a', name: 'Item A', category: 'daily', basePrice: 100, priceRange: 10 },
    { id: 'item_b', name: 'Item B', category: 'luxury', basePrice: 50, priceRange: 10 },
  ],
  locations: [
    { id: 'loc_a', name: 'Location A', lineIds: ['line_a'], neighborIds: ['loc_b'], acceptedAccounts: ['cash', 'bank', 'wallet'], services: ['bank', 'hospital', 'housing'], demand: {} },
    { id: 'loc_b', name: 'Location B', lineIds: ['line_a'], neighborIds: ['loc_a'], acceptedAccounts: ['cash', 'bank', 'wallet'], services: [], demand: {} },
  ],
  identities: [],
  weather: [],
  events: { market: [], health: [], money: [], identity: [] },
};

export function stateWith(partial: Partial<GameState> = {}): GameState {
  return { ...createGame(stubPack, { playerName: 'Player', seed: 1, identityId: null }), ...partial };
}

export function classicState(partial: Partial<GameState> = {}): GameState {
  return stateWith({ mode: 'classic', modern: null, ...partial });
}

export function modernState(partial: Partial<GameState> = {}): GameState {
  return stateWith({ mode: 'modern', ...partial });
}

export function trend(partial: Partial<Trend> = {}): Trend {
  return { id: 'trend_a', category: 'daily', multiplier: 1.2, daysLeft: 2, reason: 'Demand', ...partial };
}

export function event(title: string): GameEvent {
  return { id: 'event_a', kind: 'system', title, body: title, artId: 'event_a' };
}

export class MaxRng implements RandomSource {
  readonly state = 0;

  int(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive safe integer');
    }
    return maxExclusive - 1;
  }
}

export class ScriptedRng implements RandomSource {
  private index = 0;

  constructor(private readonly values: number[]) {}

  get state(): number {
    return this.index;
  }

  int(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive safe integer');
    }
    const value = this.values[this.index++];
    if (value === undefined || !Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('ScriptedRng requires a normalized value in [0, 1)');
    }
    return Math.floor(value * maxExclusive);
  }
}

export function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear() { data.clear(); },
    getItem(key: string) { return data.get(String(key)) ?? null; },
    key(index: number) { return [...data.keys()][index] ?? null; },
    removeItem(key: string) { data.delete(String(key)); },
    setItem(key: string, value: string) { data.set(String(key), String(value)); },
  };
}
