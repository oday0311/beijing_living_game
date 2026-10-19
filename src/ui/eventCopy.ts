import type { GameEvent } from '../engine/types';

const systemCopy: Record<string, { title: string; body: string }> = {
  'journey-complete': { title: '旅程结束', body: '四十天的北京旅程已经结束。' },
  'auto-liquidation': { title: '存货清仓', body: '剩余商品已按最后一天的行情自动售出。' },
  'departure-warning': { title: '最后一天将至', body: '明天是这次北京旅程的最后一天。' },
  'health-crisis': { title: '健康告急', body: '健康状况严重下降，请留意接下来的旅程。' },
  death: { title: '旅程中止', body: '健康下降导致这次旅程提前结束。' },
  'debt-penalty': { title: '债务惩罚', body: '高额债务使健康减少 30 点。' },
  'overdue-penalty': { title: '逾期提醒', body: '还款期限已过，信用受到影响。' },
};

export function eventCopy(event: GameEvent): Pick<GameEvent, 'title' | 'body'> {
  if (event.id === 'hospitalization') {
    const numbers = event.body.match(/\d+/g);
    return { title: '住院治疗', body: numbers?.length === 2
      ? `住院 ${Number(numbers[0])} 天，债务增加 ¥${Number(numbers[1]).toLocaleString()}。`
      : /[\u3400-\u9fff]/.test(event.body) ? event.body : '住院期间产生了新的治疗费用。' };
  }
  if (event.id === 'storage-full') {
    const amount = event.body.match(/\d+/)?.[0];
    return { title: '货架已满', body: amount ? `货架容量为 ${amount} 件，无法再存入商品。` : '货架已满，无法再存入商品。' };
  }
  if (systemCopy[event.id]) return systemCopy[event.id];
  if (event.kind === 'system') {
    return {
      title: /[\u3400-\u9fff]/.test(event.title) ? event.title : '城市消息',
      body: /[\u3400-\u9fff]/.test(event.body) ? event.body : '发生了一件新事，请查看旅程记录。',
    };
  }
  return { title: event.title, body: event.body };
}
