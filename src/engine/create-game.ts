import type { ContentPack } from '../content/contract';
import { SeededRng } from './rng';
import { generateMarket } from './market';
import { ageTrends, applyWeather, installmentAmount, planMarketEvents, refreshTrendForecast } from './modern';
import type { GameState } from './types';

export interface CreateGameOptions {
  playerName: string;
  seed: number;
  identityId: string | null;
}

export function createGame(pack: ContentPack, options: CreateGameOptions): GameState {
  const rng = new SeededRng(options.seed);
  const identity = pack.identities.find(({ id }) => id === options.identityId);
  const capacityBonus = pack.mode === 'modern' && identity?.effect.kind === 'capacity' ? identity.effect.value : 0;

  let state: GameState = {
    schemaVersion: 1,
    mode: pack.mode,
    playerName: options.playerName.trim(),
    seed: options.seed,
    rngState: rng.state,
    day: 1,
    daysTotal: pack.daysTotal,
    ...pack.initial,
    capacity: pack.initial.capacity + capacityBonus,
    inventory: {},
    market: {},
    weatherId: null,
    trends: [],
    identityId: options.identityId,
    walletFrozenDays: 0,
    modern: pack.mode === 'modern' ? {
      onTimeRepayments: 0,
      dailyWalletTransferred: 0,
      shopkeeperCapacityBonus: 0,
      freeTransitUses: 0,
      revealTrendDaysBonus: identity?.effect.kind === 'trend-visibility' ? identity.effect.value : 0,
      revealAllThroughDay: null,
      forecastMarketEvents: [],
      visibleTrendForecast: [],
      repaymentDueDay: pack.initial.debt > 0 ? 5 : null,
      repaymentDueAmount: installmentAmount(pack.initial.debt),
      repaidTowardDue: 0,
      lastOnTimeRepaymentDay: null,
      overduePenalties: 0,
    } : null,
    pendingEvents: [],
    journal: [],
    status: 'playing',
    finalScore: null,
  };
  if (pack.mode === 'modern' && pack.weather.length > 0) {
    state = applyWeather(state, pack.weather[rng.int(pack.weather.length)], pack);
  }
  state = { ...state, market: generateMarket(pack, rng, state),
    trends: pack.mode === 'modern' ? ageTrends(state.trends) : state.trends };
  if (pack.mode === 'modern' && state.modern) {
    state = refreshTrendForecast({ ...state, modern: { ...state.modern, forecastMarketEvents: [
      planMarketEvents(pack, rng, 2, state.identityId),
      planMarketEvents(pack, rng, 3, state.identityId),
    ] } });
  }
  return { ...state, rngState: rng.state };
}
