import type { KeyboardEvent } from 'react';
import type { ContentPack } from '../content/contract';
import type { GameState } from '../engine/types';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { marketTargetName, multiplierDirection } from './marketDisplay';

export function MarketTable({ state, pack, selectedId, onSelect }: {
  state: GameState; pack: ContentPack; selectedId: string | null; onSelect: (id: string) => void;
}) {
  function keySelect(event: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
  }
  return <>{state.mode === 'modern' && <div className="market-signals" aria-label="当前趋势">
    <h3>当前趋势</h3>{state.trends.filter(({ daysLeft }) => daysLeft > 0).length === 0 ? <p>暂无活跃趋势</p> :
      <ul>{state.trends.filter(({ daysLeft }) => daysLeft > 0).map((trend) => <li key={trend.id}>
        {trend.multiplier > 1 ? <ArrowUpRight size={16} aria-hidden="true" /> : trend.multiplier < 1
          ? <ArrowDownRight size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
        <span>{marketTargetName(pack, trend.category)} · {multiplierDirection(trend.multiplier)} ×{trend.multiplier} · {trend.reason} · 剩余 {trend.daysLeft} 天</span>
      </li>)}</ul>}
  </div>}
  <table className="desk-table" aria-label="今日行情"><thead><tr><th scope="col">商品</th><th scope="col">单价</th><th scope="col">持有</th></tr></thead><tbody>
    {pack.goods.filter(({ id }) => state.market[id] !== undefined).map((good) =>
      <tr key={good.id} tabIndex={0} aria-selected={selectedId === good.id} onClick={() => onSelect(good.id)} onKeyDown={(event) => keySelect(event, good.id)}>
        <th scope="row">{good.name}</th><td>¥{state.market[good.id].toLocaleString()}</td><td>{state.inventory[good.id]?.quantity ?? 0} 件</td>
      </tr>)}
  </tbody></table></>;
}
