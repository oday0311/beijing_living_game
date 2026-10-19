import { describe, expect, it } from 'vitest';
import { createGame } from '../../engine/create-game';
import { modernContent } from './index';

const ranges = [
  ['coffee-beans', 80, 319], ['concert-ticket', 280, 2199],
  ['camping-gear', 220, 1199], ['power-bank', 60, 259],
  ['blind-box', 35, 179], ['vintage-clothes', 90, 679],
  ['smart-watch', 450, 2299], ['skincare-set', 180, 899],
  ['pet-food', 120, 599], ['camera-lens', 900, 5199],
  ['office-chair', 350, 1599], ['local-snacks', 30, 159],
] as const;

const lines = {
  'line-4': ['zhongguancun', 'haidianhuangzhuang', 'xizhimen'],
  'line-10': ['haidianhuangzhuang', 'sanyuanqiao', 'shuangjing', 'guomao'],
  'line-2': ['xizhimen', 'fuxingmen', 'chaoyangmen', 'dongzhimen'],
  'line-6': ['nanluoguxiang', 'chaoyangmen', 'hujialou', 'tongzhoubeiguan'],
} as const;

describe('modern content', () => {
  it('ships the approved scope, opening balances and identities', () => {
    expect(modernContent.mode).toBe('modern');
    expect(modernContent.goods).toHaveLength(12);
    expect(modernContent.locations).toHaveLength(12);
    expect(new Set(modernContent.locations.flatMap((location) => location.lineIds)).size).toBe(4);
    expect(modernContent.identities).toHaveLength(4);
    expect(modernContent.weather).toHaveLength(6);
    expect(Object.values(modernContent.events).flat()).toHaveLength(36);
    expect(modernContent.initial).toEqual({
      cash: 2000, bank: 0, wallet: 500, debt: 5500, health: 100,
      fame: 100, credit: 'C', capacity: 100, locationId: 'xizhimen',
    });
    expect(modernContent.identities.map(({ id, effect }) => [id, effect])).toEqual([
      ['courier', { kind: 'transit', value: 0.5 }],
      ['designer', { kind: 'trend-visibility', value: 1 }],
      ['shopkeeper', { kind: 'capacity', value: 20 }],
      ['graduate', { kind: 'credit-growth', value: 2 }],
    ]);
    const first = createGame(modernContent, { playerName: 'Player', seed: 27, identityId: 'courier' });
    const again = createGame(modernContent, { playerName: 'Player', seed: 27, identityId: 'courier' });
    expect(first).toEqual(again);
    expect(first).toMatchObject({ ...modernContent.initial, identityId: 'courier' });
  });

  it('uses all approved inclusive goods price ranges', () => {
    expect(modernContent.goods.map(({ id, basePrice, priceRange }) =>
      [id, basePrice, basePrice + priceRange - 1])).toEqual(ranges);
  });

  it('has the ordered, bidirectional lines and a connected station graph', () => {
    const locations = new Map(modernContent.locations.map((location) => [location.id, location]));
    expect(locations.size).toBe(12);
    for (const [lineId, stationIds] of Object.entries(lines)) {
      expect(modernContent.locations.filter((location) => location.lineIds.includes(lineId)).map((location) => location.id))
        .toEqual(stationIds);
      for (let index = 1; index < stationIds.length; index += 1) {
        expect(locations.get(stationIds[index - 1])?.neighborIds).toContain(stationIds[index]);
        expect(locations.get(stationIds[index])?.neighborIds).toContain(stationIds[index - 1]);
      }
    }
    expect(locations.get('haidianhuangzhuang')?.lineIds).toEqual(['line-4', 'line-10']);
    expect(locations.get('xizhimen')?.lineIds).toEqual(['line-4', 'line-2']);
    expect(locations.get('chaoyangmen')?.lineIds).toEqual(['line-2', 'line-6']);
    for (const origin of locations.keys()) {
      const seen = new Set([origin]);
      const queue = [origin];
      for (const id of queue) {
        for (const neighbor of locations.get(id)?.neighborIds ?? []) {
          expect(locations.get(neighbor)?.neighborIds).toContain(id);
          if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
        }
      }
      expect(seen.size).toBe(locations.size);
    }
    for (const location of locations.values()) {
      expect(location.acceptedAccounts.length).toBeGreaterThan(0);
      expect(location.services.length).toBeGreaterThan(0);
      expect(Object.keys(location.demand).length).toBeGreaterThan(0);
    }
  });

  it('defines weather states separately from direct-effect events', () => {
    expect(modernContent.weather.map((weather) => weather.id)).toEqual([
      'clear', 'rain', 'heat', 'cold', 'haze', 'wind',
    ]);
    for (const weather of modernContent.weather) {
      expect(weather.aqiLabel).toBeTruthy();
      expect(weather.healthEventWeight).toBeGreaterThan(0);
      for (const multiplier of Object.values(weather.categoryMultipliers)) {
        expect(multiplier).toBeGreaterThan(0);
      }
    }
  });

  it('defines the exact event groups and referenced effects', () => {
    expect(Object.fromEntries(Object.entries(modernContent.events).map(([group, events]) => [group, events.length])))
      .toEqual({ market: 16, health: 8, money: 8, identity: 4 });
    const goods = new Set(modernContent.goods.map((good) => good.id));
    const categories = new Set(modernContent.goods.map((good) => good.category));
    const identities = new Set(modernContent.identities.map((identity) => identity.id));
    const locations = new Set(modernContent.locations.map((location) => location.id));
    const eventIds = new Set<string>();
    const references = new Set([...goods, ...categories, ...identities, ...locations,
      'all', 'cash', 'bank', 'wallet', 'health', 'credit', 'capacity', 'transit-fare',
      'health-event-weight', 'walletFrozenDays', 'onTimeRepayments', 'freeTransitUses',
      'revealTrendDaysBonus']);
    for (const [group, events] of Object.entries(modernContent.events)) {
      for (const event of events) {
        expect(event.id).toMatch(new RegExp(`^${group}/`));
        expect(eventIds.has(event.id)).toBe(false);
        eventIds.add(event.id);
        expect(event.title).toBeTruthy();
        expect(event.body).toBeTruthy();
        expect(event.artId).toBeTruthy();
        expect(event.frequency).toBeGreaterThan(0);
        expect(event.effect.kind).toBeTruthy();
        for (const effect of [event.effect, event.effect.secondary].filter((value) => value !== undefined)) {
          if (effect.target !== undefined) expect(references.has(effect.target)).toBe(true);
          if (effect.multiplier !== undefined) expect(effect.multiplier).toBeGreaterThan(0);
          if (effect.duration !== undefined) {
            expect(Number.isInteger(effect.duration)).toBe(true);
            expect(effect.duration).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(JSON.stringify(modernContent.events)).not.toMatch(/有限公司|委员会|集团董事长|先生实名/);
  });

  it('keeps the approved market trend matrix', () => {
    expect(modernContent.events.market.map(({ id, title, effect }) =>
      [id, title, effect.target, effect.multiplier, effect.duration])).toEqual([
      ['market/coffee-festival', '咖啡节', 'coffee-beans', 1.8, 3],
      ['market/extra-show', '临时加场', 'concert-ticket', 2.5, 2],
      ['market/show-cancelled', '演出取消', 'concert-ticket', 0.35, 2],
      ['market/camping-season', '露营季', 'camping-gear', 2, 3],
      ['market/rain-stockup', '骤雨囤货', 'power-bank', 1.7, 2],
      ['market/blindbox-collab', '盲盒联名', 'blind-box', 2.2, 3],
      ['market/vintage-fair', '复古市集', 'vintage-clothes', 1.9, 3],
      ['market/watch-update', '智能表更新', 'smart-watch', 0.55, 2],
      ['market/skincare-stream', '护肤直播', 'skincare-set', 2, 2],
      ['market/pet-expo', '宠物展', 'pet-food', 1.8, 3],
      ['market/photo-week', '摄影周', 'camera-lens', 1.7, 3],
      ['market/home-office', '居家办公', 'office-chair', 1.6, 4],
      ['market/souvenir-week', '伴手礼节', 'local-snacks', 1.9, 2],
      ['market/logistics-delay', '物流延误', 'all', 1.25, 2],
      ['market/season-clearance', '换季清仓', 'apparel', 0.5, 2],
      ['market/community-group-buy', '社区团购', 'daily', 0.65, 2],
    ]);
    expect(modernContent.events.market.every(({ effect }) => effect.kind === 'price-trend')).toBe(true);
  });

  it('keeps all direct weather, money and identity effects explicit', () => {
    const effects = Object.fromEntries(Object.values(modernContent.events).flat().map(({ id, effect }) => [id, effect]));
    expect(effects['health/heavy-rain']).toEqual({
      kind: 'health-delta', target: 'health', amount: -2,
      secondary: { kind: 'transit-fare-delta', target: 'transit-fare', amount: 1, duration: 1 },
    });
    expect(effects['health/heat-wave']).toEqual({
      kind: 'health-delta', target: 'health', amount: -4,
      secondary: { kind: 'category-trend', target: 'drink', multiplier: 1.4, duration: 2 },
    });
    expect(effects['health/cold-snap']).toEqual({
      kind: 'health-delta', target: 'health', amount: -3,
      secondary: { kind: 'category-trend', target: 'outdoor', multiplier: 0.7, duration: 2 },
    });
    expect(effects['health/light-haze']).toEqual({
      kind: 'health-delta', target: 'health', amount: -2,
      secondary: { kind: 'category-trend', target: 'health', multiplier: 1.5, duration: 2 },
    });
    expect(effects['health/clear-wind']).toEqual({
      kind: 'health-delta', target: 'health', amount: 2,
      secondary: { kind: 'category-trend', target: 'outdoor', multiplier: 1.3, duration: 1 },
    });
    expect(effects['health/pollen']).toEqual({
      kind: 'health-delta', target: 'health', amount: -1,
      secondary: { kind: 'event-weight', target: 'health-event-weight', multiplier: 1.5, duration: 2 },
    });
    expect(effects['health/subway-delay']).toEqual({
      kind: 'account-delta', target: 'cash', amount: -10, journalNotice: '地铁延误',
    });
    expect(effects['health/clean-air']).toEqual({
      kind: 'health-delta', target: 'health', amount: 3,
      secondary: { kind: 'event-weight', target: 'health-event-weight', multiplier: 0.5, duration: 1 },
    });
    expect(effects['money/wallet-freeze']).toEqual({ kind: 'wallet-freeze', target: 'walletFrozenDays', amount: 1, duration: 1 });
    expect(effects['money/subscription-mistap']).toEqual({ kind: 'account-delta', target: 'wallet', amount: -88 });
    expect(effects['money/bank-promotion']).toEqual({ kind: 'account-delta', target: 'bank', amount: 200 });
    expect(effects['money/repayment-reward']).toEqual({ kind: 'counter-delta', target: 'onTimeRepayments', amount: 1 });
    expect(effects['money/refund-arrives']).toEqual({ kind: 'account-delta', target: 'wallet', amount: 160 });
    expect(effects['money/credit-review']).toEqual({ kind: 'credit-tier-delta', target: 'credit', amount: -1 });
    expect(effects['money/rent-relief']).toEqual({ kind: 'account-delta', target: 'cash', amount: 300 });
    expect(effects['money/scam-message']).toEqual({ kind: 'account-loss-capped', target: 'wallet', amount: 500 });
    expect(effects['identity/courier-route']).toEqual({ kind: 'free-transit-use', target: 'courier', amount: 1 });
    expect(effects['identity/designer-radar']).toEqual({ kind: 'reveal-trends', target: 'designer', duration: 1 });
    expect(effects['identity/shopkeeper-shelf']).toEqual({ kind: 'capacity-bonus', target: 'shopkeeper', amount: 5, maxBonus: 25 });
    expect(effects['identity/graduate-review']).toEqual({ kind: 'credit-tier-delta', target: 'graduate', amount: 1, condition: 'below-A' });
  });
});
