import type { ContentPack, EffectDefinition, EventDefinition, WeatherDefinition } from '../content/contract';
import { failure, success } from './command-result';
import type { CommandResult, CreditTier, GameState, RandomSource, Trend } from './types';

const CREDIT_TERMS = {
  D: { limit: 0, dailyRate: 0.15 },
  C: { limit: 5_000, dailyRate: 0.10 },
  B: { limit: 15_000, dailyRate: 0.08 },
  A: { limit: 30_000, dailyRate: 0.06 },
  S: { limit: 60_000, dailyRate: 0.04 },
} as const;
const tiers: CreditTier[] = ['D', 'C', 'B', 'A', 'S'];

export function creditTerms(tier: CreditTier): { limit: number; dailyRate: number } {
  return CREDIT_TERMS[tier];
}

export function moveCredit(tier: CreditTier, change: number): CreditTier {
  return tiers[Math.max(0, Math.min(tiers.length - 1, tiers.indexOf(tier) + change))];
}

export function applyTrends(basePrice: number, category: string, trends: Trend[], itemId?: string, demand = 1): number {
  const multiplier = trends.reduce((value, trend) =>
    trend.daysLeft > 0 && (trend.category === category || trend.category === itemId || trend.category === 'all')
      ? value * trend.multiplier : value, demand);
  return Math.max(1, Math.trunc(basePrice * Math.max(0.35, Math.min(4, multiplier))));
}

export function ageTrends(trends: Trend[]): Trend[] {
  return trends.map((trend) => ({ ...trend, daysLeft: Math.max(0, trend.daysLeft - 1) }))
    .filter((trend) => trend.daysLeft > 0);
}

export function travelCost(pack: ContentPack, origin: string, destination: string, identityId: string | null): number {
  const locations = new Map(pack.locations.map((location) => [location.id, location]));
  if (!locations.has(origin) || !locations.has(destination)) throw new RangeError('Unknown station');
  const seen = new Set([origin]);
  const queue: Array<[string, number]> = [[origin, 0]];
  for (const [id, edges] of queue) {
    if (id === destination) {
      const fare = Math.min(8, 3 + Math.floor(edges / 4));
      const benefit = pack.identities.find((identity) => identity.id === identityId)?.effect;
      return benefit?.kind === 'transit' ? Math.max(1, Math.floor(fare * benefit.value)) : fare;
    }
    for (const neighbor of locations.get(id)?.neighborIds ?? []) {
      if (locations.has(neighbor) && !seen.has(neighbor)) { seen.add(neighbor); queue.push([neighbor, edges + 1]); }
    }
  }
  throw new RangeError('Stations are disconnected');
}

function visible(event: EventDefinition) {
  return { id: event.id, kind: event.kind, title: event.title, body: event.body, artId: event.artId };
}

function addTrend(state: GameState, event: EventDefinition, effect: EffectDefinition): GameState {
  if (!effect.target || !effect.multiplier || !effect.duration) return state;
  const next: Trend = { id: event.id, category: effect.target, multiplier: effect.multiplier,
    daysLeft: effect.duration, reason: event.title };
  return { ...state, trends: [...state.trends.filter((trend) => trend.id !== next.id), next] };
}

export function applyIdentity(state: GameState, event?: EventDefinition): GameState {
  if (!event || event.effect.target !== state.identityId || !state.modern) return state;
  const effect = event.effect;
  let next = state;
  if (effect.kind === 'free-transit-use') {
    next = { ...state, modern: { ...state.modern, freeTransitUses: state.modern.freeTransitUses + (effect.amount ?? 0) } };
  } else if (effect.kind === 'reveal-trends') {
    next = { ...state, modern: { ...state.modern, revealTrendDaysBonus: state.modern.revealTrendDaysBonus + (effect.duration ?? 0) } };
  } else if (effect.kind === 'capacity-bonus') {
    const bonus = Math.min(effect.maxBonus ?? 0, state.modern.shopkeeperCapacityBonus + (effect.amount ?? 0));
    next = { ...state, capacity: state.capacity + bonus - state.modern.shopkeeperCapacityBonus,
      modern: { ...state.modern, shopkeeperCapacityBonus: bonus } };
  } else if (effect.kind === 'credit-tier-delta' && (!effect.condition || state.credit !== 'A' && state.credit !== 'S')) {
    next = { ...state, credit: moveCredit(state.credit, effect.amount ?? 0) };
  }
  return { ...next, pendingEvents: [...next.pendingEvents, visible(event)] };
}

export function applyWeather(state: GameState, weather: WeatherDefinition, pack: ContentPack): GameState {
  const event = pack.events.health.find((candidate) => candidate.id === weather.eventId);
  if (!event) throw new RangeError(`Unknown weather event: ${weather.eventId}`);
  return applyEvent({ ...state, weatherId: weather.id }, event);
}

export function applyEvent(state: GameState, event: EventDefinition): GameState {
  const effect = event.effect;
  let next = state;
  if (effect.kind === 'price-trend' || effect.kind === 'category-trend' || effect.kind === 'event-weight') {
    next = addTrend(next, event, effect);
  } else if (effect.kind === 'health-delta') {
    next = { ...next, health: Math.min(100, next.health + (effect.amount ?? 0)) };
  } else if (effect.kind === 'account-delta' && (effect.target === 'cash' || effect.target === 'bank' || effect.target === 'wallet')) {
    next = { ...next, [effect.target]: Math.max(0, next[effect.target] + (effect.amount ?? 0)) };
  } else if (effect.kind === 'account-loss-capped' && effect.target === 'wallet') {
    next = { ...next, wallet: Math.max(0, next.wallet - (effect.amount ?? 0)) };
  } else if (effect.kind === 'wallet-freeze') {
    next = { ...next, walletFrozenDays: Math.max(next.walletFrozenDays, effect.duration ?? effect.amount ?? 0) };
  } else if (effect.kind === 'counter-delta' && effect.target === 'onTimeRepayments' && next.modern) {
    next = advanceRepayments(next, effect.amount ?? 0);
  } else if (effect.kind === 'credit-tier-delta') {
    next = { ...next, credit: moveCredit(next.credit, effect.amount ?? 0),
      modern: next.modern ? { ...next.modern, onTimeRepayments: 0 } : null };
  }
  if (effect.secondary?.kind === 'category-trend' || effect.secondary?.kind === 'event-weight') {
    next = addTrend(next, event, effect.secondary);
  }
  return { ...next, pendingEvents: [...next.pendingEvents, visible(event)] };
}

export function advanceRepayments(state: GameState, count: number): GameState {
  if (!state.modern) return state;
  const total = state.modern.onTimeRepayments + count * (state.identityId === 'graduate' ? 2 : 1);
  const steps = Math.floor(total / 3);
  return { ...state, credit: moveCredit(state.credit, steps),
    modern: { ...state.modern, onTimeRepayments: total % 3 } };
}

export function borrowModern(state: GameState, amount: number): CommandResult {
  if (!Number.isSafeInteger(amount) || amount <= 0) return failure(state, 'INVALID_QUANTITY', 'Borrow a positive integer amount.');
  if (amount > creditTerms(state.credit).limit - state.debt) return failure(state, 'CREDIT_LIMIT', 'Credit limit exceeded.');
  if (!Number.isSafeInteger(state.bank + amount) || !Number.isSafeInteger(state.debt + amount)) {
    return failure(state, 'INVALID_QUANTITY', 'Amount exceeds supported range.');
  }
  return success(state, { bank: state.bank + amount, debt: state.debt + amount },
    { title: 'Borrow', detail: `${amount}`, delta: { bank: amount, debt: amount } });
}

export function settleWallet(state: GameState): GameState {
  return { ...state, walletFrozenDays: Math.max(0, state.walletFrozenDays - 1),
    modern: state.modern ? { ...state.modern, dailyWalletTransferred: 0 } : null };
}

export function settleModernDay(state: GameState, pack: ContentPack, rng: RandomSource): GameState {
  let next = settleWallet(state);
  next = { ...next, bank: next.bank + Math.trunc(next.bank * 0.01),
    debt: next.debt + Math.trunc(next.debt * creditTerms(next.credit).dailyRate) };
  if (pack.weather.length) next = applyWeather(next, pack.weather[rng.int(pack.weather.length)], pack);
  const weatherEventIds = new Set(pack.weather.map(({ eventId }) => eventId));
  const weight = next.trends.filter(({ category, daysLeft }) => category === 'health-event-weight' && daysLeft > 0)
    .reduce((product, trend) => product * trend.multiplier, 1);
  for (const event of pack.events.health) {
    if (weatherEventIds.has(event.id)) continue;
    if (rng.int(1000) < Math.min(1000, Math.trunc(10 * Math.min(2, weight)))) {
      next = applyEvent(next, event);
      break;
    }
  }
  for (const event of pack.events.market) {
    if (rng.int(1000) % event.frequency === 0) next = applyEvent(next, event);
  }
  for (const event of pack.events.money) {
    if (rng.int(1000) % event.frequency === 0) { next = applyEvent(next, event); break; }
  }
  for (const event of pack.events.identity) {
    if (event.effect.target === next.identityId && rng.int(1000) % event.frequency === 0) {
      next = applyIdentity(next, event);
      break;
    }
  }
  return next;
}
