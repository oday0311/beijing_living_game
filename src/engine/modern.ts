import type { ContentPack, EffectDefinition, EventDefinition, WeatherDefinition } from '../content/contract';
import { failure, success } from './command-result';
import type { CommandResult, CreditTier, GameState, RandomSource, Trend, TrendForecast, JournalEntry } from './types';

const CREDIT_TERMS = {
  D: { limit: 0, dailyRate: 0.15 },
  C: { limit: 5_000, dailyRate: 0.10 },
  B: { limit: 15_000, dailyRate: 0.08 },
  A: { limit: 30_000, dailyRate: 0.06 },
  S: { limit: 60_000, dailyRate: 0.04 },
} as const;
const tiers: CreditTier[] = ['D', 'C', 'B', 'A', 'S'];
const REPAYMENT_PERIOD = 5;

export function installmentAmount(debt: number): number {
  return debt > 0 ? Math.max(1, Math.ceil(debt * 0.1)) : 0;
}

export function journal(state: GameState, title: string, detail: string,
  delta?: JournalEntry['delta'], day = state.day): GameState {
  return { ...state, journal: [...state.journal, {
    id: `${day}:${state.journal.length + 1}`, day, title, detail, ...(delta ? { delta } : {}),
  }] };
}

export function eventWeight(pack: ContentPack, identityId: string | null, group: 'market' | 'health' | 'money' | 'identity'): number {
  return pack.identities.find(({ id }) => id === identityId)?.eventWeights?.[group] ?? 1;
}

export function triggeredModern(event: EventDefinition, group: 'market' | 'health' | 'money' | 'identity',
  pack: ContentPack, identityId: string | null, rng: RandomSource, extraWeight = 1): boolean {
  const threshold = Math.min(1000, Math.max(0, (1000 / event.frequency) * eventWeight(pack, identityId, group) * extraWeight));
  return rng.int(1000) < threshold;
}

export function planMarketEvents(pack: ContentPack, rng: RandomSource, day: number, identityId: string | null): TrendForecast {
  return { day, trends: pack.events.market.filter((event) =>
    triggeredModern(event, 'market', pack, identityId, rng)).map((event) => ({
    id: event.id, category: event.effect.target ?? '', multiplier: event.effect.multiplier ?? 1,
    daysLeft: event.effect.duration ?? 1, reason: event.title,
  })) };
}

export function refreshTrendForecast(state: GameState): GameState {
  if (!state.modern) return state;
  const horizon = state.modern.revealAllThroughDay === state.day ? 2 : state.modern.revealTrendDaysBonus;
  return { ...state, modern: { ...state.modern,
    visibleTrendForecast: state.modern.forecastMarketEvents
      .filter(({ day }) => day > state.day && day <= state.day + horizon) } };
}

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

export function applyIdentity(state: GameState, event?: EventDefinition, eventDay = state.day): GameState {
  if (!event || event.effect.target !== state.identityId || !state.modern) return state;
  const effect = event.effect;
  if (effect.kind === 'credit-tier-delta' && (state.modern.lastQualifiedRepaymentDay !== state.day
    || state.modern.graduateGrowthDay === state.day || state.credit === 'A' || state.credit === 'S')) return state;
  let next = state;
  if (effect.kind === 'free-transit-use') {
    next = { ...state, modern: { ...state.modern, freeTransitUses: state.modern.freeTransitUses + (effect.amount ?? 0) } };
  } else if (effect.kind === 'reveal-trends') {
    next = { ...state, modern: { ...state.modern, revealAllThroughDay: eventDay } };
  } else if (effect.kind === 'capacity-bonus') {
    const bonus = Math.min(effect.maxBonus ?? 0, state.modern.shopkeeperCapacityBonus + (effect.amount ?? 0));
    next = { ...state, capacity: state.capacity + bonus - state.modern.shopkeeperCapacityBonus,
      modern: { ...state.modern, shopkeeperCapacityBonus: bonus } };
  } else if (effect.kind === 'credit-tier-delta') {
    next = { ...state, credit: moveCredit(state.credit, effect.amount ?? 0),
      modern: { ...state.modern, graduateGrowthDay: state.day } };
  }
  next = { ...next, pendingEvents: [...next.pendingEvents, visible(event)] };
  return refreshTrendForecast(journal(next, event.title, event.body,
    next.capacity !== state.capacity ? { capacity: next.capacity - state.capacity } : next.credit !== state.credit
      ? { credit: tiers.indexOf(next.credit) - tiers.indexOf(state.credit) } : next.bank !== state.bank
        ? { bank: next.bank - state.bank } : undefined, eventDay));
}

export function applyWeather(state: GameState, weather: WeatherDefinition, pack: ContentPack, eventDay = state.day): GameState {
  const event = pack.events.health.find((candidate) => candidate.id === weather.eventId);
  if (!event) throw new RangeError(`Unknown weather event: ${weather.eventId}`);
  return applyEvent({ ...state, weatherId: weather.id }, event, eventDay);
}

export function applyEvent(state: GameState, event: EventDefinition, eventDay = state.day): GameState {
  const effect = event.effect;
  if (effect.condition === 'on-time-repayment' && state.modern?.lastQualifiedRepaymentDay !== state.day) return state;
  if (effect.kind === 'counter-delta' && effect.target === 'onTimeRepayments'
    && (!state.modern?.pendingQualifiedRepayment || state.modern.lastQualifiedRepaymentDay !== state.day)) return state;
  if (effect.kind === 'credit-tier-delta' && event.id === 'money/credit-review') return state;
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
  } else if (effect.kind === 'counter-delta' && effect.target === 'onTimeRepayments') {
    next = completeQualifiedRepayment(next);
  } else if (effect.kind === 'credit-tier-delta') {
    next = { ...next, credit: moveCredit(next.credit, effect.amount ?? 0),
      modern: next.modern ? { ...next.modern, onTimeRepayments: 0 } : null };
  }
  if (effect.secondary?.kind === 'category-trend' || effect.secondary?.kind === 'event-weight') {
    next = addTrend(next, event, effect.secondary);
  }
  next = { ...next, pendingEvents: [...next.pendingEvents, visible(event)] };
  const delta: JournalEntry['delta'] = {};
  for (const account of ['cash', 'bank', 'wallet', 'debt', 'health', 'walletFrozenDays'] as const) {
    if (next[account] !== state[account]) delta[account] = next[account] - state[account];
  }
  if (next.credit !== state.credit) delta.credit = tiers.indexOf(next.credit) - tiers.indexOf(state.credit);
  if (next.modern && state.modern && next.modern.onTimeRepayments !== state.modern.onTimeRepayments) {
    delta.onTimeRepayments = next.modern.onTimeRepayments - state.modern.onTimeRepayments;
  }
  return journal(next, event.title, effect.journalNotice ?? event.body,
    Object.keys(delta).length ? delta : undefined, eventDay);
}

export function advanceRepayments(state: GameState, count: number): GameState {
  if (!state.modern) return state;
  const total = state.modern.onTimeRepayments + count * (state.identityId === 'graduate' ? 2 : 1);
  const steps = Math.floor(total / 3);
  return { ...state, credit: moveCredit(state.credit, steps),
    modern: { ...state.modern, onTimeRepayments: total % 3 } };
}

export function completeQualifiedRepayment(state: GameState): GameState {
  if (!state.modern?.pendingQualifiedRepayment || state.modern.lastQualifiedRepaymentDay !== state.day) return state;
  const advanced = advanceRepayments(state, 1);
  return { ...advanced, modern: { ...advanced.modern!, pendingQualifiedRepayment: false } };
}

export function borrowModern(state: GameState, amount: number): CommandResult {
  if (!Number.isSafeInteger(amount) || amount <= 0) return failure(state, 'INVALID_QUANTITY', 'Borrow a positive integer amount.');
  if (amount > creditTerms(state.credit).limit - state.debt) return failure(state, 'CREDIT_LIMIT', 'Credit limit exceeded.');
  if (!Number.isSafeInteger(state.bank + amount) || !Number.isSafeInteger(state.debt + amount)) {
    return failure(state, 'INVALID_QUANTITY', 'Amount exceeds supported range.');
  }
  const modern = state.modern && state.debt === 0
    ? { ...state.modern, repaymentDueDay: state.day + REPAYMENT_PERIOD - 1,
      repaymentDueAmount: installmentAmount(amount), repaidTowardDue: 0 }
    : state.modern ? { ...state.modern,
      repaymentDueAmount: Math.max(state.modern.repaymentDueAmount, installmentAmount(state.debt + amount)) } : null;
  return success(state, { bank: state.bank + amount, debt: state.debt + amount, modern },
    { title: 'Borrow', detail: `${amount}`, delta: { bank: amount, debt: amount } });
}

export function recordRepayment(state: GameState, amount: number, remainingDebt: number): GameState {
  const modern = state.modern;
  if (!modern || modern.repaymentDueDay === null) return state;
  if (remainingDebt === 0) {
    const qualified = modern.lastQualifiedRepaymentDay !== state.day
      && state.day <= modern.repaymentDueDay && state.day >= modern.repaymentDueDay - REPAYMENT_PERIOD + 1;
    return { ...state, modern: { ...modern, repaymentDueDay: null,
      repaymentDueAmount: 0, repaidTowardDue: 0,
      lastQualifiedRepaymentDay: qualified ? state.day : modern.lastQualifiedRepaymentDay,
      pendingQualifiedRepayment: qualified || modern.pendingQualifiedRepayment } };
  }
  const inWindow = state.day >= modern.repaymentDueDay - REPAYMENT_PERIOD + 1 && state.day <= modern.repaymentDueDay;
  if (!inWindow) return state;
  const progress = modern.repaidTowardDue + amount;
  if (progress < modern.repaymentDueAmount) {
    return { ...state, modern: { ...modern, repaidTowardDue: progress } };
  }
  const qualified = modern.lastQualifiedRepaymentDay !== state.day;
  return { ...state, modern: { ...modern, repaymentDueDay: modern.repaymentDueDay + REPAYMENT_PERIOD,
    repaymentDueAmount: installmentAmount(remainingDebt), repaidTowardDue: 0,
    lastQualifiedRepaymentDay: qualified ? state.day : modern.lastQualifiedRepaymentDay,
    pendingQualifiedRepayment: qualified || modern.pendingQualifiedRepayment } };
}

export function penalizeOverdue(state: GameState, review: EventDefinition | undefined): GameState {
  if (!state.modern || state.modern.repaymentDueDay === null
    || state.day + 1 <= state.modern.repaymentDueDay || state.debt <= 0) return state;
  const next = { ...state, credit: moveCredit(state.credit, -1), modern: { ...state.modern,
    onTimeRepayments: 0, pendingQualifiedRepayment: false,
    overduePenalties: state.modern.overduePenalties + 1,
    repaymentDueDay: state.modern.repaymentDueDay + REPAYMENT_PERIOD,
    repaymentDueAmount: installmentAmount(state.debt), repaidTowardDue: 0 } };
  const notice = review ? visible(review) : {
    id: 'overdue-penalty', kind: 'money' as const, title: 'Overdue penalty',
    body: 'The repayment deadline passed.', artId: 'overdue-penalty',
  };
  return journal({ ...next, pendingEvents: [...next.pendingEvents, notice] }, notice.title,
    notice.body, { credit: tiers.indexOf(next.credit) - tiers.indexOf(state.credit) }, state.day + 1);
}

export function settleWallet(state: GameState): GameState {
  return { ...state, walletFrozenDays: Math.max(0, state.walletFrozenDays - 1),
    modern: state.modern ? { ...state.modern, dailyWalletTransferred: 0 } : null };
}

export function settleModernDay(state: GameState, pack: ContentPack, rng: RandomSource): GameState {
  let next = settleWallet(state);
  const bankInterest = Math.trunc(next.bank * 0.01);
  const debtInterest = Math.trunc(next.debt * creditTerms(next.credit).dailyRate);
  next = journal({ ...next, bank: next.bank + bankInterest }, 'Bank interest', `${bankInterest}`, { bank: bankInterest }, state.day + 1);
  next = journal({ ...next, debt: next.debt + debtInterest }, 'Debt interest', `${debtInterest}`, { debt: debtInterest }, state.day + 1);
  next = penalizeOverdue(next, pack.events.money.find(({ id }) => id === 'money/credit-review'));
  if (pack.weather.length) next = applyWeather(next, pack.weather[rng.int(pack.weather.length)], pack, state.day + 1);
  const weatherEventIds = new Set(pack.weather.map(({ eventId }) => eventId));
  const weight = next.trends.filter(({ category, daysLeft }) => category === 'health-event-weight' && daysLeft > 0)
    .reduce((product, trend) => product * trend.multiplier, 1);
  for (const event of pack.events.health) {
    if (weatherEventIds.has(event.id)) continue;
    if (triggeredModern(event, 'health', pack, next.identityId, rng, Math.min(2, weight))) {
      next = applyEvent(next, event, state.day + 1);
      break;
    }
  }
  const scheduled = next.modern?.forecastMarketEvents.find(({ day }) => day === state.day + 1);
  const events = scheduled ?? planMarketEvents(pack, rng, state.day + 1, next.identityId);
  for (const forecast of events.trends) {
    const event = pack.events.market.find(({ id }) => id === forecast.id);
    if (event) next = applyEvent(next, event, state.day + 1);
  }
  for (const event of pack.events.money) {
    if (event.id === 'money/credit-review') continue;
    if (triggeredModern(event, 'money', pack, next.identityId, rng)) {
      const applied = applyEvent(next, event, state.day + 1);
      if (applied !== next) { next = applied; break; }
    }
  }
  if (next.modern?.pendingQualifiedRepayment) {
    const credited = completeQualifiedRepayment(next);
    if (credited !== next) {
      next = journal(credited, 'On-time repayment', 'A qualifying repayment was recorded.', {
        ...(credited.credit !== next.credit ? { credit: tiers.indexOf(credited.credit) - tiers.indexOf(next.credit) } : {}),
        onTimeRepayments: credited.modern!.onTimeRepayments - next.modern!.onTimeRepayments,
      }, state.day + 1);
    }
  }
  for (const event of pack.events.identity) {
    if (event.effect.target === next.identityId && triggeredModern(event, 'identity', pack, next.identityId, rng)) {
      next = applyIdentity(next, event, state.day + 1);
      break;
    }
  }
  if (next.modern) {
    const retained = next.modern.forecastMarketEvents
      .filter(({ day }) => day > state.day + 1 && day <= state.daysTotal);
    const lastDay = Math.max(state.day + 1, ...retained.map(({ day }) => day));
    const forecastMarketEvents = lastDay < state.daysTotal
      ? [...retained, planMarketEvents(pack, rng, lastDay + 1, next.identityId)] : retained;
    next = { ...next, modern: { ...next.modern, forecastMarketEvents } };
  }
  return next;
}
