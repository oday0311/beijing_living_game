import { describe, expect, it } from 'vitest';
import { classicContent } from './index';
import { createGame } from '../../engine/create-game';

describe('classic content', () => {
  it('matches the original goods, station names, and event counts', () => {
    expect(classicContent.goods.map((item) => item.name)).toEqual([
      '进口香烟', '走私汽车', '盗版VCD、游戏', '假白酒（剧毒！）',
      '《上海小宝贝》（禁书）', '进口玩具', '水货手机', '伪劣化妆品',
    ]);
    expect(classicContent.locations.map((item) => item.name)).toEqual([
      '建国门', '北京站', '西直门', '崇文门', '东直门',
      '复兴门', '积水潭', '长椿街', '公主坟', '苹果园',
    ]);
    expect(classicContent.events.market).toHaveLength(18);
    expect(classicContent.events.health).toHaveLength(12);
    expect(classicContent.events.money).toHaveLength(7);
  });

  it('starts at the source balances after the first debt interest pass', () => {
    const game = createGame(classicContent, {
      playerName: 'Player', seed: 1, identityId: null,
    });
    expect(game).toMatchObject({
      mode: 'classic', day: 1, cash: 2000, bank: 0, wallet: 0,
      debt: 5500, health: 100, fame: 100, credit: 'C',
      capacity: 100, locationId: null, modern: null,
    });
  });

  it('retains original event frequencies and structured consequences', () => {
    expect(classicContent.events.market[0]).toMatchObject({
      frequency: 170, effect: { kind: 'price-multiply', target: 'toys', multiplier: 2 },
    });
    expect(classicContent.events.market[17]).toMatchObject({
      frequency: 140, effect: { kind: 'forced-purchase', target: 'phones', amount: 1, debtAmount: 2500 },
    });
    expect(classicContent.events.health[1]).toMatchObject({
      frequency: 157, effect: { kind: 'health-loss', amount: 20 },
    });
    expect(classicContent.events.money[2]).toMatchObject({
      frequency: 100, effect: { kind: 'money-loss-percent', target: 'cash', amount: 40 },
    });
    expect(classicContent.events.money[4]).toMatchObject({
      effect: { kind: 'money-loss-percent', target: 'bank', amount: 15 },
    });
  });
});
