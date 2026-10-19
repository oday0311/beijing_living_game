import type { ContentPack, EventDefinition, LocationDefinition } from '../contract';

function event(
  id: string,
  kind: EventDefinition['kind'],
  body: string,
  frequency: number,
  effect: EventDefinition['effect'],
): EventDefinition {
  return { id, kind, title: body, body, artId: id, frequency, effect };
}

// Source: SelectionDlg.cpp:320-360 (names) and 1177-1205 (prices), GB18030.
const goods: ContentPack['goods'] = [
  { id: 'cigarettes', name: '进口香烟', category: 'tobacco', basePrice: 100, priceRange: 350 },
  { id: 'cars', name: '走私汽车', category: 'vehicles', basePrice: 15000, priceRange: 15000 },
  { id: 'vcd', name: '盗版VCD、游戏', category: 'media', basePrice: 5, priceRange: 50 },
  { id: 'liquor', name: '假白酒（剧毒！）', category: 'liquor', basePrice: 1000, priceRange: 2500 },
  { id: 'book', name: '《上海小宝贝》（禁书）', category: 'books', basePrice: 5000, priceRange: 9000 },
  { id: 'toys', name: '进口玩具', category: 'toys', basePrice: 250, priceRange: 600 },
  { id: 'phones', name: '水货手机', category: 'electronics', basePrice: 750, priceRange: 750 },
  { id: 'cosmetics', name: '伪劣化妆品', category: 'cosmetics', basePrice: 65, priceRange: 180 },
];

// Source: SelectionDlg.cpp:107-141 (GB18030).
const marketEvents: EventDefinition[] = [
  event('toy-demand', 'market', '专家提议提高大学生“动手素质”，进口玩具颇受欢迎!', 170, { kind: 'price-multiply', target: 'toys', multiplier: 2 }),
  event('liquor-cure', 'market', '有人自豪地说：生病不用打针吃药，喝假白酒（剧毒）就可以!', 139, { kind: 'price-multiply', target: 'liquor', multiplier: 3 }),
  event('book-hospital', 'market', '医院的秘密报告：“《上海小宝贝》功效甚过伟哥”!', 100, { kind: 'price-multiply', target: 'book', multiplier: 5 }),
  event('vcd-prize', 'market', '文盲说：“2000年诺贝尔文学奖？呸！不如盗版VCD港台片。”', 41, { kind: 'price-multiply', target: 'vcd', multiplier: 4 }),
  event('car-editorial', 'market', '《北京经济小报》社论：“走私汽车大力推进汽车消费!”', 37, { kind: 'price-multiply', target: 'cars', multiplier: 3 }),
  event('cosmetics-editorial', 'market', '《北京真理报》社论：“提倡爱美，落到实处”，伪劣化妆品大受欢迎!', 23, { kind: 'price-multiply', target: 'cosmetics', multiplier: 4 }),
  event('book-shortage', 'market', '8858.com电子书店也不敢卖《上海小宝贝》，黑市一册可卖天价!', 37, { kind: 'price-multiply', target: 'book', multiplier: 8 }),
  event('cosmetics-celebrity', 'market', '谢不疯在晚会上说：“我酷!我使用伪劣化妆品!”，伪劣化妆品供不应求!', 15, { kind: 'price-multiply', target: 'cosmetics', multiplier: 7 }),
  event('liquor-rush', 'market', '北京有人狂饮山西假酒，可以卖出天价!', 40, { kind: 'price-multiply', target: 'liquor', multiplier: 7 }),
  event('phone-jobs', 'market', '北京的大学生们开始找工作，水货手机大受欢迎！!', 29, { kind: 'price-multiply', target: 'phones', multiplier: 7 }),
  event('car-rich', 'market', '北京的富人疯狂地购买走私汽车！价格狂升!', 35, { kind: 'price-multiply', target: 'cars', multiplier: 8 }),
  event('cigarette-flood', 'market', '市场上充斥着来自福建的走私香烟!', 17, { kind: 'price-divide', target: 'cigarettes', multiplier: 8 }),
  event('toy-slump', 'market', '北京的孩子们都忙于上网学习，进口玩具没人愿意买。', 24, { kind: 'price-divide', target: 'toys', multiplier: 5 }),
  event('vcd-flood', 'market', '盗版业十分兴旺，“中国硅谷”——中关村全是卖盗版VCD的村姑!', 18, { kind: 'price-divide', target: 'vcd', multiplier: 8 }),
  event('free-cars', 'market', '厦门的老同学资助俺两部走私汽车！发了！！', 160, { kind: 'grant-goods', target: 'cars', amount: 2 }),
  event('free-cigarettes', 'market', '工商局扫荡后，俺在黑暗角落里发现了老乡丢失的进口香烟。', 45, { kind: 'grant-goods', target: 'cigarettes', amount: 6 }),
  event('free-liquor', 'market', '俺老乡回家前把一些山西假白酒（剧毒）给俺!', 35, { kind: 'grant-goods', target: 'liquor', amount: 4 }),
  event('forced-phone', 'market', '媒体报道：又有日本出口到中国的产品出事了! 出事后日本人死不认帐,拒绝赔偿。村长得知此消息，托人把他用的水货手机（无任何厂商标识）硬卖给您，收您2500元。', 140, { kind: 'forced-purchase', target: 'phones', amount: 1, debtAmount: 2500 }),
];

// Source: SelectionDlg.cpp:143-167 (GB18030).
const healthEvents: EventDefinition[] = [
  event('street-attack', 'health', '大街上两个流氓打了俺!', 117, { kind: 'health-loss', amount: 3 }),
  event('underpass-attack', 'health', '俺在过街地道被人打了蒙棍! ', 157, { kind: 'health-loss', amount: 20 }),
  event('inspection-chase', 'health', '工商局的追俺超过三个胡同。 ', 21, { kind: 'health-loss', amount: 1 }),
  event('traffic-stress', 'health', '北京拥挤的交通让俺心焦! ', 100, { kind: 'health-loss', amount: 1 }),
  event('minibus-slap', 'health', '开小巴的打俺一耳光!', 35, { kind: 'health-loss', amount: 1 }),
  event('workers-attack', 'health', '一群民工打了俺!', 313, { kind: 'health-loss', amount: 10 }),
  event('brick-attack', 'health', '附近胡同的一个小青年砸俺一砖头!', 120, { kind: 'health-loss', amount: 5 }),
  event('guard-shock', 'health', '附近写字楼一个假保安用电棍电击俺!', 29, { kind: 'health-loss', amount: 3 }),
  event('river-smell', 'health', '北京臭黑的小河熏着我了! ', 43, { kind: 'health-loss', amount: 1 }),
  event('registration-taunt', 'health', '守自行车的王大婶嘲笑俺没北京户口!', 45, { kind: 'health-loss', amount: 1 }),
  event('heatwave', 'health', '北京高温40度!俺热...', 48, { kind: 'health-loss', amount: 1 }),
  event('sandstorm', 'health', '申奥添了新风景，北京又来沙尘暴!', 33, { kind: 'health-loss', amount: 1 }),
];

// Source: SelectionDlg.cpp:169-189 (GB18030).
const moneyEvents: EventDefinition[] = [
  event('beggar', 'money', '俺怜悯地铁口扮演成乞丐的老太太。', 60, { kind: 'money-loss-percent', target: 'cash', amount: 10 }),
  event('street-demand', 'money', '一个汉子在街头拦住俺：“哥们，给点钱用!”。', 125, { kind: 'money-loss-percent', target: 'cash', amount: 10 }),
  event('pickpocket', 'money', '一个大个子碰了俺一下，说：“别挤了!”。', 100, { kind: 'money-loss-percent', target: 'cash', amount: 40 }),
  event('fine', 'money', '三个带红袖章的老太太揪住俺：“你是外地人?罚款!”', 65, { kind: 'money-loss-percent', target: 'cash', amount: 20 }),
  event('fees', 'money', '两个猛男揪住俺：“交长话附加费、上网费。”', 35, { kind: 'money-loss-percent', target: 'bank', amount: 15 }),
  event('permit', 'money', '副主任说：“办经商证?晚上不要去我家给我送钱哦。”', 27, { kind: 'money-loss-percent', target: 'bank', amount: 10 }),
  event('oxygen-bar', 'money', '北京空气污染得厉害,俺去氧吧吸氧...', 40, { kind: 'money-loss-percent', target: 'cash', amount: 5 }),
];

const stationNames = [
  ['jianguomen', '建国门'], ['beijingzhan', '北京站'], ['xizhimen', '西直门'],
  ['chongwenmen', '崇文门'], ['dongzhimen', '东直门'], ['fuxingmen', '复兴门'],
  ['jishuitan', '积水潭'], ['changchunjie', '长椿街'], ['gongzhufen', '公主坟'],
  ['pingguoyuan', '苹果园'],
] as const;

// Source: SelectionDlg.cpp:1548-1572 (GB18030); the first ten named places are the selectable stations.
const locations: LocationDefinition[] = stationNames.map(([id, name]) => ({
  id,
  name,
  lineIds: ['classic'],
  neighborIds: stationNames.filter(([otherId]) => otherId !== id).map(([otherId]) => otherId),
  acceptedAccounts: ['cash'],
  services: ['bank', 'hospital', 'housing'],
  demand: {},
}));

export const classicContent: ContentPack = {
  mode: 'classic',
  daysTotal: 40,
  // Source: SelectionDlg.cpp:320-360 and 528-529 (GB18030); debt includes the first 10% pass at 1413.
  initial: {
    cash: 2000, bank: 0, wallet: 0, debt: 5500, health: 100,
    fame: 100, credit: 'C', capacity: 100, locationId: null,
  },
  goods,
  locations,
  identities: [],
  weather: [],
  events: { market: marketEvents, health: healthEvents, money: moneyEvents, identity: [] },
};
