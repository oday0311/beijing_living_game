import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import { X } from 'lucide-react';
import type { ContentPack } from '../content/contract';
import type { JournalEntry } from '../engine/types';
import { useModalFocus } from './useModalFocus';

type JournalCategory = '全部' | '交易' | '行情' | '健康' | '资金' | '系统';
const categories: JournalCategory[] = ['全部', '交易', '行情', '健康', '资金', '系统'];
const accountName: Record<string, string> = { cash: '现金', bank: '存款', wallet: '电子余额' };

function journalCopy(entry: JournalEntry, pack: ContentPack): { title: string; detail: string } {
  const amount = Number(entry.detail);
  const money = Number.isFinite(amount) ? `¥${amount.toLocaleString()}` : entry.detail;
  if (entry.title === 'Travel') return {
    title: '换站', detail: pack.locations.find(({ id }) => id === entry.detail)?.name ?? entry.detail,
  };
  if (entry.title === 'Purchase' || entry.title === 'Sale') {
    const match = entry.detail.match(/^(\d+) (.+)$/);
    const good = pack.goods.find(({ id }) => id === match?.[2]);
    return { title: entry.title === 'Purchase' ? '买入' : '卖出',
      detail: match ? `${good?.name ?? match[2]} ${match[1]} 件` : entry.detail };
  }
  if (entry.title === 'Transfer') {
    const [from, to] = entry.detail.split(' to ');
    return { title: '转账', detail: `${accountName[from] ?? from} → ${accountName[to] ?? to}` };
  }
  const titles: Record<string, string> = {
    'Bank interest': '存款利息', 'Debt interest': '债务利息', Borrow: '借款',
    'Debt repayment': '偿还债务', Treatment: '治疗', 'Housing upgrade': '扩建住房',
    'Auto-liquidation': '存货清仓', 'Overdue penalty': '逾期提醒', 'On-time repayment': '准时还款',
  };
  const detail = entry.title === 'Treatment' ? `${entry.detail.match(/\d+/)?.[0] ?? entry.detail} 点健康`
    : entry.title === 'Housing upgrade' ? `${entry.detail.match(/\d+/)?.[0] ?? entry.detail} 件容量`
      : entry.title === 'Auto-liquidation' ? '剩余存货已按最后行情出售。'
        : entry.title === 'On-time repayment' ? '本次准时还款已计入信用记录。'
          : entry.title === 'Overdue penalty' ? '还款期限已过。'
            : ['Bank interest', 'Debt interest', 'Borrow', 'Debt repayment'].includes(entry.title) ? money : entry.detail;
  return { title: titles[entry.title] ?? entry.title, detail };
}

export function journalCategory(entry: JournalEntry, pack: ContentPack): Exclude<JournalCategory, '全部'> {
  const text = `${entry.title} ${entry.detail}`.toLowerCase();
  if (/^(buy|sell|purchase|sale|买入|卖出|购入|售出)/.test(text)) return '交易';
  if (/^(travel|前往|换站|旅行)/.test(text)) return '系统';
  if (pack.events.market.some(({ title }) => title === entry.title)) return '行情';
  if (pack.events.health.some(({ title }) => title === entry.title)) return '健康';
  if (pack.events.money.some(({ title }) => title === entry.title)) return '资金';
  if (/market|price|trend|行情|价格|需求|市场|清仓/.test(text)) return '行情';
  if (entry.delta?.health !== undefined || /health|hospital|健康|住院|热浪|暴雨|寒潮|雾霾|花粉/.test(text)) return '健康';
  if (entry.delta && ['cash', 'bank', 'wallet', 'debt', 'credit'].some((key) => key in entry.delta!)) return '资金';
  return '系统';
}

export function JournalDrawer({ entries, pack, onClose, fallbackFocus }: {
  entries: JournalEntry[]; pack: ContentPack; onClose: () => void; fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const [filter, setFilter] = useState<JournalCategory>('全部');
  const [dayFilter, setDayFilter] = useState('all');
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose, fallbackFocus);
  const availableDays = [...new Set(entries.map(({ day }) => day))].sort((a, b) => b - a);
  const visible = entries.filter((entry) => (dayFilter === 'all' || entry.day === Number(dayFilter))
    && (filter === '全部' || journalCategory(entry, pack) === filter));
  const days = [...new Set(visible.map(({ day }) => day))].sort((a, b) => b - a);
  return <div className="dialog-backdrop"><div ref={ref} className="journal-drawer" role="dialog" aria-modal="true" aria-labelledby="journal-title">
    <header className="journal-header"><h2 id="journal-title">旅程日记</h2><button type="button" onClick={onClose} aria-label="关闭日记" title="关闭日记"><X size={20} /></button></header>
    <div className="journal-filters" role="group" aria-label="日记类型">{categories.map((category) =>
      <button key={category} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div>
    <label className="journal-day-filter" htmlFor="journal-day-select">日期
      <select id="journal-day-select" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
        <option value="all">全部天数</option>
        {availableDays.map((day) => <option key={day} value={day}>第 {day} 天</option>)}
      </select>
    </label>
    <div className="journal-scroll">{visible.length === 0 ? <p className="empty-note">暂无记录</p> : days.map((day) => <section key={day} className="journal-day">
      <h3>第 {day} 天</h3><ol>{visible.filter((entry) => entry.day === day).map((entry) => <li key={entry.id}>
        <span className="journal-type">{journalCategory(entry, pack)}</span><div><strong>{journalCopy(entry, pack).title}</strong><p>{journalCopy(entry, pack).detail}</p></div>
      </li>)}</ol>
    </section>)}</div>
  </div></div>;
}
