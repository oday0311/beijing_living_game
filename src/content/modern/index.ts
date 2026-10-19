import type { Account } from '../../engine/types';
import type { ContentPack, EventDefinition, LocationDefinition } from '../contract';

const goods: ContentPack['goods'] = [
  { id: 'coffee-beans', name: '咖啡豆', category: 'drink', basePrice: 80, priceRange: 240 },
  { id: 'concert-ticket', name: '演出票', category: 'entertainment', basePrice: 280, priceRange: 1920 },
  { id: 'camping-gear', name: '露营装备', category: 'outdoor', basePrice: 220, priceRange: 980 },
  { id: 'power-bank', name: '充电宝', category: 'electronics', basePrice: 60, priceRange: 200 },
  { id: 'blind-box', name: '盲盒', category: 'collectibles', basePrice: 35, priceRange: 145 },
  { id: 'vintage-clothes', name: '复古衣物', category: 'apparel', basePrice: 90, priceRange: 590 },
  { id: 'smart-watch', name: '智能手表', category: 'electronics', basePrice: 450, priceRange: 1850 },
  { id: 'skincare-set', name: '护肤套装', category: 'health', basePrice: 180, priceRange: 720 },
  { id: 'pet-food', name: '宠物口粮', category: 'pet', basePrice: 120, priceRange: 480 },
  { id: 'camera-lens', name: '相机镜头', category: 'photography', basePrice: 900, priceRange: 4300 },
  { id: 'office-chair', name: '办公椅', category: 'home', basePrice: 350, priceRange: 1250 },
  { id: 'local-snacks', name: '本地零食', category: 'daily', basePrice: 30, priceRange: 130 },
];

const lines = {
  'line-4': ['zhongguancun', 'haidianhuangzhuang', 'xizhimen'],
  'line-10': ['haidianhuangzhuang', 'sanyuanqiao', 'shuangjing', 'guomao'],
  'line-2': ['xizhimen', 'fuxingmen', 'chaoyangmen', 'dongzhimen'],
  'line-6': ['nanluoguxiang', 'chaoyangmen', 'hujialou', 'tongzhoubeiguan'],
} as const;

const stations = [
  ['zhongguancun', '中关村', ['electronics', 'photography']],
  ['haidianhuangzhuang', '海淀黄庄', ['electronics', 'drink']],
  ['xizhimen', '西直门', ['daily', 'drink']],
  ['sanyuanqiao', '三元桥', ['home', 'health']],
  ['shuangjing', '双井', ['pet', 'home']],
  ['guomao', '国贸', ['entertainment', 'health']],
  ['fuxingmen', '复兴门', ['drink', 'home']],
  ['nanluoguxiang', '南锣鼓巷', ['apparel', 'daily']],
  ['chaoyangmen', '朝阳门', ['apparel', 'collectibles']],
  ['dongzhimen', '东直门', ['outdoor', 'pet']],
  ['hujialou', '呼家楼', ['photography', 'collectibles']],
  ['tongzhoubeiguan', '通州北关', ['daily', 'outdoor']],
] as const;

const neighbors = new Map<string, Set<string>>();
for (const stationIds of Object.values(lines)) {
  for (let index = 1; index < stationIds.length; index += 1) {
    const left = stationIds[index - 1];
    const right = stationIds[index];
    if (!neighbors.has(left)) neighbors.set(left, new Set());
    if (!neighbors.has(right)) neighbors.set(right, new Set());
    neighbors.get(left)?.add(right);
    neighbors.get(right)?.add(left);
  }
}

const locations: LocationDefinition[] = stations.map(([id, name, favoredCategories]) => {
  const acceptedAccounts: Account[] = id === 'nanluoguxiang' || id === 'tongzhoubeiguan'
    ? ['cash', 'wallet'] : ['cash', 'bank', 'wallet'];
  return {
    id, name,
    lineIds: Object.entries(lines).filter(([, stationIds]) => (stationIds as readonly string[]).includes(id)).map(([lineId]) => lineId),
    neighborIds: [...(neighbors.get(id) ?? [])],
    acceptedAccounts,
    services: id === 'xizhimen' || id === 'guomao' ? ['bank', 'hospital', 'housing']
      : id === 'haidianhuangzhuang' || id === 'chaoyangmen' ? ['bank', 'hospital']
        : id === 'dongzhimen' || id === 'sanyuanqiao' ? ['hospital', 'housing'] : ['bank'],
    demand: Object.fromEntries(favoredCategories.map((category) => [category, 1.25])),
  };
});

function event(
  id: string,
  kind: EventDefinition['kind'],
  title: string,
  body: string,
  effect: EventDefinition['effect'],
  frequency = 100,
): EventDefinition {
  return { id, kind, title, body, artId: id, frequency, effect };
}

const market: EventDefinition[] = [
  event('market/coffee-festival', 'market', '咖啡节', '咖啡节的摊位比座位多，连路过的人都开始讨论烘焙度。', { kind: 'price-trend', target: 'coffee-beans', multiplier: 1.8, duration: 3 }),
  event('market/extra-show', 'market', '临时加场', '热门演出临时加场，票务页面的刷新键成了今日最忙的按钮。', { kind: 'price-trend', target: 'concert-ticket', multiplier: 2.5, duration: 2 }),
  event('market/show-cancelled', 'market', '演出取消', '一场演出取消了，大家把闲下来的晚上安排得比原计划还满。', { kind: 'price-trend', target: 'concert-ticket', multiplier: 0.35, duration: 2 }),
  event('market/camping-season', 'market', '露营季', '草坪预约表排得整整齐齐，露营装备忽然很抢手。', { kind: 'price-trend', target: 'camping-gear', multiplier: 2, duration: 3 }),
  event('market/rain-stockup', 'market', '骤雨囤货', '一场急雨让充电宝成了通勤包里的明星物件。', { kind: 'price-trend', target: 'power-bank', multiplier: 1.7, duration: 2 }),
  event('market/blindbox-collab', 'market', '盲盒联名', '新联名款刚亮相，大家已经在研究如何给展示柜腾位置。', { kind: 'price-trend', target: 'blind-box', multiplier: 2.2, duration: 3 }),
  event('market/vintage-fair', 'market', '复古市集', '复古市集来了，旧外套突然都有了值得讲述的故事。', { kind: 'price-trend', target: 'vintage-clothes', multiplier: 1.9, duration: 3 }),
  event('market/watch-update', 'market', '智能表更新', '智能手表出了新版，旧款只好认真发挥报时本领。', { kind: 'price-trend', target: 'smart-watch', multiplier: 0.55, duration: 2 }),
  event('market/skincare-stream', 'market', '护肤直播', '直播间把护肤步骤排成了一张日程表，套装销量随之上涨。', { kind: 'price-trend', target: 'skincare-set', multiplier: 2, duration: 2 }),
  event('market/pet-expo', 'market', '宠物展', '宠物展上的试吃台排起长队，主人们负责拎袋子。', { kind: 'price-trend', target: 'pet-food', multiplier: 1.8, duration: 3 }),
  event('market/photo-week', 'market', '摄影周', '摄影周里，每一片树叶似乎都值得换个镜头再拍一次。', { kind: 'price-trend', target: 'camera-lens', multiplier: 1.7, duration: 3 }),
  event('market/home-office', 'market', '居家办公', '居家办公热起来后，大家开始认真对待那把吱呀作响的椅子。', { kind: 'price-trend', target: 'office-chair', multiplier: 1.6, duration: 4 }),
  event('market/souvenir-week', 'market', '伴手礼节', '伴手礼节到了，零食袋的设计比行李箱还讲究。', { kind: 'price-trend', target: 'local-snacks', multiplier: 1.9, duration: 2 }),
  event('market/logistics-delay', 'market', '物流延误', '配送时间集体学会了弹性，所有商品的现货都显得更珍贵。', { kind: 'price-trend', target: 'all', multiplier: 1.25, duration: 2 }),
  event('market/season-clearance', 'market', '换季清仓', '换季清仓的标牌摆满橱窗，衣架上的衣服也排队等新主人。', { kind: 'price-trend', target: 'apparel', multiplier: 0.5, duration: 2 }),
  event('market/community-group-buy', 'market', '社区团购', '邻居们把团购清单做成表格，日用品价格安静地降了下来。', { kind: 'price-trend', target: 'daily', multiplier: 0.65, duration: 2 }),
];

const health: EventDefinition[] = [
  event('health/heavy-rain', 'health', '暴雨', '雨伞挡住了雨，没挡住绕路的想法。', { kind: 'health-delta', target: 'health', amount: -2, secondary: { kind: 'transit-fare-delta', target: 'transit-fare', amount: 1, duration: 1 } }),
  event('health/heat-wave', 'health', '热浪', '气温一上来，饮料柜成了最受欢迎的室内景点。', { kind: 'health-delta', target: 'health', amount: -4, secondary: { kind: 'category-trend', target: 'drink', multiplier: 1.4, duration: 2 } }),
  event('health/cold-snap', 'health', '寒潮', '冷风一吹，野餐计划改成了认真研究天气预报。', { kind: 'health-delta', target: 'health', amount: -3, secondary: { kind: 'category-trend', target: 'outdoor', multiplier: 0.7, duration: 2 } }),
  event('health/light-haze', 'health', '轻雾霾', '远处的楼今天有点朦胧，大家开始关心护肤和健康用品。', { kind: 'health-delta', target: 'health', amount: -2, secondary: { kind: 'category-trend', target: 'health', multiplier: 1.5, duration: 2 } }),
  event('health/clear-wind', 'health', '晴朗大风', '阳光很好，风把出游计划吹到了每个人的日历上。', { kind: 'health-delta', target: 'health', amount: 2, secondary: { kind: 'category-trend', target: 'outdoor', multiplier: 1.3, duration: 1 } }),
  event('health/pollen', 'health', '花粉', '花开得很认真，鼻子也跟着加班。', { kind: 'health-delta', target: 'health', amount: -1, secondary: { kind: 'event-weight', target: 'health-event-weight', multiplier: 1.5, duration: 2 } }),
  event('health/subway-delay', 'health', '地铁延误', '车厢广播很有耐心地重复消息，迟到记录也多了一行。', { kind: 'account-delta', target: 'cash', amount: -10, journalNotice: '地铁延误' }),
  event('health/clean-air', 'health', '空气优良', '今天的空气清清爽爽，散步的理由又多了一个。', { kind: 'health-delta', target: 'health', amount: 3, secondary: { kind: 'event-weight', target: 'health-event-weight', multiplier: 0.5, duration: 1 } }),
];

const money: EventDefinition[] = [
  event('money/wallet-freeze', 'money', '钱包冻结一天', '钱包今天例行核对，暂时只能看不能付。', { kind: 'wallet-freeze', target: 'walletFrozenDays', amount: 1, duration: 1 }),
  event('money/subscription-mistap', 'money', '误点订阅', '手指比大脑快一步，订阅服务先发来了欢迎消息。', { kind: 'account-delta', target: 'wallet', amount: -88 }),
  event('money/bank-promotion', 'money', '银行优惠', '账户里出现一笔优惠返还，备注写得比活动规则还简洁。', { kind: 'account-delta', target: 'bank', amount: 200 }),
  event('money/repayment-reward', 'money', '准时还款奖励', '准时还款被系统记了一笔，信用记录又整齐了一点。', { kind: 'counter-delta', target: 'onTimeRepayments', amount: 1 }),
  event('money/refund-arrives', 'money', '退款到账', '那笔差点忘记的退款到账了，钱包悄悄变厚。', { kind: 'account-delta', target: 'wallet', amount: 160 }),
  event('money/credit-review', 'money', '信用复核', '例行复核给信用等级降了一档，提醒写得格外客气。', { kind: 'credit-tier-delta', target: 'credit', amount: -1 }),
  event('money/rent-relief', 'money', '租金减免', '房租结算时少了一笔，连收据看起来都轻快。', { kind: 'account-delta', target: 'cash', amount: 300 }),
  event('money/scam-message', 'money', '诈骗短信', '一条可疑短信冒充优惠提醒，钱包最多损失五百元。', { kind: 'account-loss-capped', target: 'wallet', amount: 500 }),
];

const identity: EventDefinition[] = [
  event('identity/courier-route', 'identity', '跑腿骑手：熟路', '常跑的路今天格外顺，下次乘车免付车费。', { kind: 'free-transit-use', target: 'courier', amount: 1 }),
  event('identity/designer-radar', 'identity', '自由设计师：灵感雷达', '灵感雷达亮了，这轮所有趋势剩余天数一目了然。', { kind: 'reveal-trends', target: 'designer', duration: 1 }),
  event('identity/shopkeeper-shelf', 'identity', '社区店主：巧置货架', '店主把货架重新摆好，额外腾出了五格位置。', { kind: 'capacity-bonus', target: 'shopkeeper', amount: 5, maxBonus: 25 }),
  event('identity/graduate-review', 'identity', '应届毕业生：成长记录', '新的成长记录帮信用等级前进一步。', { kind: 'credit-tier-delta', target: 'graduate', amount: 1, condition: 'below-A' }),
];

export const modernContent: ContentPack = {
  mode: 'modern',
  daysTotal: 40,
  initial: {
    cash: 2000, bank: 0, wallet: 500, debt: 5500, health: 100,
    fame: 100, credit: 'C', capacity: 100, locationId: 'xizhimen',
  },
  goods,
  locations,
  identities: [
    { id: 'courier', name: '跑腿骑手', description: '熟悉换乘路线，交通费用减半。', effect: { kind: 'transit', value: 0.5 } },
    { id: 'designer', name: '自由设计师', description: '能提前一天看见市场趋势。', effect: { kind: 'trend-visibility', value: 1 } },
    { id: 'shopkeeper', name: '社区店主', description: '起步多二十格货架空间。', effect: { kind: 'capacity', value: 20 } },
    { id: 'graduate', name: '应届毕业生', description: '正向信用成长加倍。', effect: { kind: 'credit-growth', value: 2 } },
  ],
  weather: [
    { id: 'clear', name: '晴朗', aqiLabel: '优', healthEventWeight: 0.5, categoryMultipliers: { outdoor: 1 } },
    { id: 'rain', name: '降雨', aqiLabel: '良', healthEventWeight: 1, categoryMultipliers: { electronics: 1.7 } },
    { id: 'heat', name: '炎热', aqiLabel: '良', healthEventWeight: 1, categoryMultipliers: { drink: 1.4 } },
    { id: 'cold', name: '寒冷', aqiLabel: '良', healthEventWeight: 1, categoryMultipliers: { outdoor: 0.7 } },
    { id: 'haze', name: '轻雾霾', aqiLabel: '轻度污染', healthEventWeight: 1.5, categoryMultipliers: { health: 1.5 } },
    { id: 'wind', name: '大风', aqiLabel: '优', healthEventWeight: 1, categoryMultipliers: { outdoor: 1.3 } },
  ],
  events: { market, health, money, identity },
};
