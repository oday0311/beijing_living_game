import type { ContentPack } from '../content/contract';
import { SeededRng } from './rng';
import { generateMarket } from './market';
import type { GameState } from './types';

export interface CreateGameOptions {
  playerName: string;
  seed: number;
  identityId: string | null;
}

export function createGame(pack: ContentPack, options: CreateGameOptions): GameState {
  const rng = new SeededRng(options.seed);
  const market = generateMarket(pack, rng, { day: 1, trends: [], weatherId: null });

  return {
    schemaVersion: 1,
    mode: pack.mode,
    playerName: options.playerName.trim(),
    seed: options.seed,
    rngState: rng.state,
    day: 1,
    daysTotal: pack.daysTotal,
    ...pack.initial,
    inventory: {},
    market,
    weatherId: null,
    trends: [],
    identityId: options.identityId,
    walletFrozenDays: 0,
    modern: pack.mode === 'modern' ? {
      onTimeRepayments: 0,
      dailyWalletTransferred: 0,
      shopkeeperCapacityBonus: 0,
      freeTransitUses: 0,
      revealTrendDaysBonus: 0,
    } : null,
    pendingEvents: [],
    journal: [],
    status: 'playing',
    finalScore: null,
  };
}
