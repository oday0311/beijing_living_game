import type { ContentPack, EventDefinition } from '../content/contract';
import { failure } from './command-result';
import { generateMarketWithAllPrices, inventoryCount } from './market';
import { ageTrends, journal, refreshTrendForecast, routeLines, settleModernDay, travelCost, travelRoute } from './modern';
import type { CommandResult, GameEvent, GameState, JournalEntry, RandomSource } from './types';

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

export interface TravelQuote {
  path: string[];
  lineIds: string[];
  transfers: number;
  fare: number;
  freeTransitUsed: boolean;
}

export function quoteTravel(state: GameState, targetId: string, pack: ContentPack): TravelQuote {
  if (pack.mode === 'classic') return {
    path: state.locationId ? [state.locationId, targetId] : [targetId],
    lineIds: ['classic'], transfers: 0, fare: 0, freeTransitUsed: false,
  };
  const origin = state.locationId ?? '';
  const path = travelRoute(pack, origin, targetId);
  const lineIds = routeLines(pack, path);
  const freeTransitUsed = (state.modern?.freeTransitUses ?? 0) > 0;
  let fare = freeTransitUsed ? 0 : travelCost(pack, origin, targetId, state.identityId);
  const weather = pack.weather.find(({ id }) => id === state.weatherId);
  const weatherEvent = pack.events.health.find(({ id }) => id === weather?.eventId);
  if (!freeTransitUsed && weatherEvent?.effect.secondary?.kind === 'transit-fare-delta') {
    fare = Math.min(8, Math.max(1, fare + (weatherEvent.effect.secondary.amount ?? 0)));
  }
  return { path, lineIds, transfers: Math.max(0, lineIds.length - 1), fare, freeTransitUsed };
}

export function settleDay(state: GameState, pack: ContentPack, rng: RandomSource): GameState {
  if (pack.mode === 'modern') {
    const settled = settleModernDay(state, pack, rng);
    const { prices: market } = generateMarketWithAllPrices(pack, rng, settled);
    const day = Math.min(state.daysTotal, state.day + 1);
    let cash = settled.cash;
    let inventory = settled.inventory;
    let pendingEvents = settled.pendingEvents;
    let journalEntries = settled.journal;
    let finalScore = settled.finalScore;
    let status = settled.health < 0 ? 'lost' as const : settled.status;
    if (day === state.daysTotal) {
      const proceeds = Object.entries(inventory).reduce((sum, [id, lot]) => sum + lot.quantity * (market[id] ?? 0), 0);
      cash += proceeds;
      inventory = {};
      finalScore = cash + settled.bank + settled.wallet - settled.debt;
      status = settled.health >= 0 && finalScore > 0 ? 'won' : 'lost';
      pendingEvents = [...pendingEvents, systemEvent('journey-complete', 'Forty days have passed.')];
      if (proceeds > 0) {
        pendingEvents.push(systemEvent('auto-liquidation', 'Remaining goods were sold at final market prices.'));
        journalEntries = journal(settled, 'Auto-liquidation', 'Remaining inventory sold at final prices.', { cash: proceeds }, day).journal;
      }
    }
    if (settled.health >= 0 && day === state.daysTotal - 1 && state.day < day) {
      pendingEvents = [...pendingEvents, systemEvent('departure-warning', 'Tomorrow is the last day in Beijing.')];
    }
    return refreshTrendForecast({ ...settled, day, cash, inventory, market, pendingEvents, journal: journalEntries, finalScore, status,
      trends: ageTrends(settled.trends), rngState: rng.state,
      modern: settled.modern ? { ...settled.modern,
        revealAllThroughDay: settled.modern.revealAllThroughDay === day ? day : null } : null });
  }
  const { prices: market, allPrices } = generateMarketWithAllPrices(pack, rng, state);
  let cash = state.cash;
  let bank = state.bank + Math.trunc(state.bank * 0.01);
  let debt = state.debt + Math.trunc(state.debt * 0.1);
  let health = state.health;
  let hospitalDays = 0;
  const inventory = { ...state.inventory };
  const pendingEvents = [...state.pendingEvents];
  const journalEntries = [...state.journal];
  const settlementDay = Math.min(state.daysTotal, state.day + 1);
  function record(title: string, detail: string, delta?: JournalEntry['delta']) {
    journalEntries.push({ id: `${settlementDay}:${journalEntries.length + 1}`, day: settlementDay,
      title, detail, ...(delta ? { delta } : {}) });
  }
  record('存款利息', `存款 ${state.bank} 元，增加 ${bank - state.bank} 元`, { bank: bank - state.bank });
  record('债务利息', `债务 ${state.debt} 元，增加 ${debt - state.debt} 元`, { debt: debt - state.debt });

  for (const event of pack.events.market) {
    if (!triggered(event, 950, rng)) continue;
    const { target, kind, amount, multiplier, debtAmount } = event.effect;
    if (!target || market[target] === undefined) continue;
    pendingEvents.push(visibleEvent(event));
    const oldPrice = market[target];
    const goodName = pack.goods.find(({ id }) => id === target)?.name ?? target;
    if (kind === 'price-multiply' && multiplier) market[target] *= multiplier;
    if (kind === 'price-divide' && multiplier) market[target] = Math.trunc(market[target] / multiplier);
    if (market[target] !== oldPrice) record('行情变化', `${event.title} ${goodName}：${oldPrice} → ${market[target]} 元`);
    if (kind === 'grant-goods' || kind === 'forced-purchase') {
      if (kind === 'forced-purchase') {
        debt += debtAmount ?? 0;
        record('行情变化', `${event.title} 债务增加 ${debtAmount ?? 0} 元`, { debt: debtAmount ?? 0 });
      }
      const count = Math.min(amount ?? 0, Math.max(0, state.capacity - inventoryCount({ ...state, inventory })));
      if (count === 0) {
        pendingEvents.push(systemEvent('storage-full', `Storage is full at ${state.capacity} goods.`));
        record('货架已满', `${goodName}无法入库，容量上限 ${state.capacity} 件`);
        break;
      }
      const lot = inventory[target];
      inventory[target] = { quantity: (lot?.quantity ?? 0) + count, averageCost: lot?.averageCost ?? 0 };
      record('行情变化', `${event.title} ${goodName}入库 ${count} 件`);
    }
  }

  for (const event of pack.events.health) {
    if (!triggered(event, 1000, rng)) continue;
    pendingEvents.push(visibleEvent(event));
    const loss = event.effect.amount ?? 0;
    health -= loss;
    record('健康事件', `${event.title} 健康减少 ${loss} 点`, { health: -loss });
    break;
  }

  // The original game checks remaining days before advancing the current day.
  if (health < 85 && state.day < 38) {
    hospitalDays = 1 + rng.int(2);
    rng.int(29); // Location flavor text has no state effect, but consumes a roll.
    const bill = hospitalDays * (1000 + rng.int(8500));
    debt += bill;
    const previousHealth = health;
    health = Math.min(100, health + 10);
    pendingEvents.push(systemEvent('hospitalization', `Hospitalized for ${hospitalDays} day(s); debt increased by ${bill}.`));
    record('强制住院', `住院 ${hospitalDays} 天，债务增加 ${bill} 元，健康恢复 ${health - previousHealth} 点`,
      { debt: bill, health: health - previousHealth });
  } else if (health > 0 && health < 20) {
    pendingEvents.push(systemEvent('health-crisis', 'Health is critically low.'));
  }
  const diedDuringHealth = health < 0;
  if (diedDuringHealth) {
    pendingEvents.push(systemEvent('death', 'The journey ended after a fatal loss of health.'));
    record('旅程中止', `健康降至 ${health} 点`);
  }

  for (const event of pack.events.money) {
    if (!triggered(event, 1000, rng)) continue;
    const rate = event.effect.amount ?? 0;
    if (event.effect.target === 'bank') {
      if (bank > 0) {
        pendingEvents.push(visibleEvent(event));
        const previousBank = bank;
        bank = Math.trunc(bank / 100) * (100 - rate);
        record('资金事件', `${event.title} 存款减少 ${previousBank - bank} 元`, { bank: bank - previousBank });
      }
    } else {
      pendingEvents.push(visibleEvent(event));
      const previousCash = cash;
      cash = Math.trunc(cash / 100) * (100 - rate);
      record('资金事件', `${event.title} 现金减少 ${previousCash - cash} 元`, { cash: cash - previousCash });
    }
    break;
  }
  if (pack.mode === 'classic') rng.int(1000);

  if (debt > 100_000) {
    health -= 30;
    pendingEvents.push(systemEvent('debt-penalty', 'High debt caused a 30 point health penalty.'));
    record('债务惩罚', `债务 ${debt} 元超过 100000 元，健康减少 30 点`, { health: -30 });
    if (health < 0 && !diedDuringHealth) {
      pendingEvents.push(systemEvent('death', 'The journey ended after a fatal loss of health.'));
      record('旅程中止', `健康降至 ${health} 点`);
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
      for (const [id, lot] of remaining) {
        const proceeds = lot.quantity * (market[id] ?? 0);
        cash += proceeds;
        record('最终清仓', `${pack.goods.find((good) => good.id === id)?.name ?? id} ${lot.quantity} 件 × ${market[id] ?? 0} 元，收入 ${proceeds} 元`, { cash: proceeds });
      }
      pendingEvents.push(systemEvent('auto-liquidation', 'Remaining goods were sold at final market prices.'));
    }
    for (const id of Object.keys(inventory)) delete inventory[id];
    finalScore = cash + bank + state.wallet - debt;
    status = health >= 0 && finalScore > 0 ? 'won' : 'lost';
    record('最终得分', `现金 ${cash} + 存款 ${bank} + 电子余额 ${state.wallet} - 债务 ${debt} = ${finalScore} 分`);
  }

  return {
    ...state, day, cash, bank, debt, health, inventory, market, pendingEvents, journal: journalEntries,
    status, finalScore, rngState: rng.state,
  };
}

export function travel(state: GameState, targetId: string, pack: ContentPack, rng: RandomSource): CommandResult {
  if (state.status !== 'playing') return failure(state, 'GAME_ENDED', 'The game has ended.');
  if (state.pendingEvents.length > 0) return failure(state, 'EVENT_PENDING', 'Acknowledge pending events before travelling.');
  if (targetId === state.locationId) return failure(state, 'SAME_LOCATION', 'Choose another station.');
  if (!pack.locations.some((location) => location.id === targetId)) {
    return failure(state, 'UNKNOWN_LOCATION', 'This station does not exist.');
  }
  let departing = { ...state, locationId: targetId };
  let fare = 0;
  if (pack.mode === 'modern') {
    let quote: TravelQuote;
    try { quote = quoteTravel(state, targetId, pack); }
    catch { return failure(state, 'UNKNOWN_LOCATION', 'No route to this station.'); }
    fare = quote.fare;
    if (state.cash < fare) return failure(state, 'INSUFFICIENT_FUNDS', 'Cash cannot cover transit fare.');
    departing = { ...departing, cash: state.cash - fare,
      modern: state.modern ? { ...state.modern, freeTransitUses: state.modern.freeTransitUses - (quote.freeTransitUsed ? 1 : 0) } : null };
  }
  const withTravel = pack.mode === 'modern'
    ? journal(departing, 'Travel', targetId, fare ? { cash: -fare } : undefined)
    : journal(departing, '换站', pack.locations.find(({ id }) => id === targetId)?.name ?? targetId);
  const next = settleDay(withTravel, pack, rng);
  return { ok: true, state: next };
}
