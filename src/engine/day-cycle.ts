import type { ContentPack, EventDefinition } from '../content/contract';
import { failure } from './command-result';
import { generateMarketWithAllPrices, inventoryCount } from './market';
import type { CommandResult, GameEvent, GameState, RandomSource } from './types';

function visibleEvent(event: EventDefinition): GameEvent {
  const { id, kind, title, body, artId } = event;
  return { id, kind, title, body, artId };
}

function systemEvent(id: string, body: string): GameEvent {
  return { id, kind: 'system', title: body, body, artId: id };
}

function triggered(event: EventDefinition, pool: number, rng: RandomSource): boolean {
  return rng.int(pool) % event.frequency === 0;
}

export function calculateScore(state: GameState): number {
  return state.cash + state.bank + state.wallet - state.debt;
}

export function acknowledgeEvent(state: GameState): GameState {
  if (state.pendingEvents.length === 0) return state;
  return { ...state, pendingEvents: state.pendingEvents.slice(1) };
}

export function settleDay(state: GameState, pack: ContentPack, rng: RandomSource): GameState {
  const { prices: market, allPrices } = generateMarketWithAllPrices(pack, rng, state);
  let cash = state.cash;
  let bank = state.bank + Math.trunc(state.bank * 0.01);
  let debt = state.debt + Math.trunc(state.debt * 0.1);
  let health = state.health;
  let hospitalDays = 0;
  const inventory = { ...state.inventory };
  const pendingEvents = [...state.pendingEvents];

  for (const event of pack.events.market) {
    if (!triggered(event, 950, rng)) continue;
    const { target, kind, amount, multiplier, debtAmount } = event.effect;
    if (!target || market[target] === undefined) continue;
    pendingEvents.push(visibleEvent(event));
    if (kind === 'price-multiply' && multiplier) market[target] *= multiplier;
    if (kind === 'price-divide' && multiplier) market[target] = Math.trunc(market[target] / multiplier);
    if (kind === 'grant-goods' || kind === 'forced-purchase') {
      if (kind === 'forced-purchase') debt += debtAmount ?? 0;
      const count = Math.min(amount ?? 0, Math.max(0, state.capacity - inventoryCount({ ...state, inventory })));
      if (count === 0) {
        pendingEvents.push(systemEvent('storage-full', `Storage is full at ${state.capacity} goods.`));
        break;
      }
      const lot = inventory[target];
      inventory[target] = { quantity: (lot?.quantity ?? 0) + count, averageCost: lot?.averageCost ?? 0 };
    }
  }

  for (const event of pack.events.health) {
    if (!triggered(event, 1000, rng)) continue;
    pendingEvents.push(visibleEvent(event));
    health -= event.effect.amount ?? 0;
    break;
  }

  // The original game checks remaining days before advancing the current day.
  if (health < 85 && state.day < 38) {
    hospitalDays = 1 + rng.int(2);
    rng.int(29); // Location flavor text has no state effect, but consumes a roll.
    const bill = hospitalDays * (1000 + rng.int(8500));
    debt += bill;
    health = Math.min(100, health + 10);
    pendingEvents.push(systemEvent('hospitalization', `Hospitalized for ${hospitalDays} day(s); debt increased by ${bill}.`));
  } else if (health > 0 && health < 20) {
    pendingEvents.push(systemEvent('health-crisis', 'Health is critically low.'));
  }
  const diedDuringHealth = health < 0;
  if (diedDuringHealth) {
    pendingEvents.push(systemEvent('death', 'The journey ended after a fatal loss of health.'));
  }

  for (const event of pack.events.money) {
    if (!triggered(event, 1000, rng)) continue;
    const rate = event.effect.amount ?? 0;
    if (event.effect.target === 'bank') {
      if (bank > 0) {
        pendingEvents.push(visibleEvent(event));
        bank = Math.trunc(bank / 100) * (100 - rate);
      }
    } else {
      pendingEvents.push(visibleEvent(event));
      cash = Math.trunc(cash / 100) * (100 - rate);
    }
    break;
  }
  if (pack.mode === 'classic') rng.int(1000);

  if (debt > 100_000) {
    health -= 30;
    pendingEvents.push(systemEvent('debt-penalty', 'High debt caused a 30 point health penalty.'));
    if (health < 0 && !diedDuringHealth) {
      pendingEvents.push(systemEvent('death', 'The journey ended after a fatal loss of health.'));
    }
  }

  const day = Math.min(state.daysTotal, state.day + 1 + hospitalDays);
  if (health >= 0 && day === state.daysTotal - 1 && state.day < day) {
    pendingEvents.push(systemEvent('departure-warning', 'Tomorrow is the last day in Beijing.'));
  }

  let status = state.status;
  let finalScore = state.finalScore;
  if (health < 0) {
    status = 'lost';
  }
  if (day === state.daysTotal) {
    pendingEvents.push(systemEvent('journey-complete', 'Forty days have passed.'));
    for (const [id, price] of Object.entries(allPrices)) {
      if (market[id] === undefined) market[id] = price;
    }
    const remaining = Object.entries(inventory).filter(([, lot]) => lot.quantity > 0);
    if (remaining.length > 0) {
      for (const [id, lot] of remaining) cash += lot.quantity * (market[id] ?? 0);
      pendingEvents.push(systemEvent('auto-liquidation', 'Remaining goods were sold at final market prices.'));
    }
    for (const id of Object.keys(inventory)) delete inventory[id];
    finalScore = cash + bank + state.wallet - debt;
    status = health >= 0 && finalScore > 0 ? 'won' : 'lost';
  }

  return {
    ...state, day, cash, bank, debt, health, inventory, market, pendingEvents,
    status, finalScore, rngState: rng.state,
  };
}

export function travel(state: GameState, targetId: string, pack: ContentPack, rng: RandomSource): CommandResult {
  if (state.status !== 'playing') return failure(state, 'GAME_ENDED', 'The game has ended.');
  if (pack.mode !== 'classic') return failure(state, 'FEATURE_UNAVAILABLE', 'Modern day rules are not available yet.');
  if (state.pendingEvents.length > 0) return failure(state, 'EVENT_PENDING', 'Acknowledge pending events before travelling.');
  if (targetId === state.locationId) return failure(state, 'SAME_LOCATION', 'Choose another station.');
  if (!pack.locations.some((location) => location.id === targetId)) {
    return failure(state, 'UNKNOWN_LOCATION', 'This station does not exist.');
  }
  const next = settleDay({ ...state, locationId: targetId }, pack, rng);
  return {
    ok: true,
    state: {
      ...next,
      journal: [...state.journal, {
        id: `${state.day}:${state.journal.length + 1}`, day: state.day,
        title: 'Travel', detail: targetId,
      }],
    },
  };
}
