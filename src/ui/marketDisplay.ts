import type { ContentPack } from '../content/contract';

const categoryNames: Record<string, string> = {
  drink: '饮品', entertainment: '演出', outdoor: '户外', electronics: '电子产品',
  collectibles: '收藏品', apparel: '服饰', health: '健康用品', pet: '宠物用品',
  photography: '摄影器材', home: '家居', daily: '日用品', all: '全部商品',
  'health-event-weight': '健康事件概率', 'transit-fare': '车费',
};

export function marketTargetName(pack: ContentPack, target: string): string {
  return pack.goods.find(({ id }) => id === target)?.name ?? categoryNames[target] ?? target;
}

export function multiplierDirection(multiplier: number): string {
  return multiplier > 1 ? '上涨' : multiplier < 1 ? '下跌' : '持平';
}
