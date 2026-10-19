import type { KeyboardEvent } from 'react';
import type { ContentPack } from '../content/contract';
import type { GameState } from '../engine/types';

export function MarketTable({ state, pack, selectedId, onSelect }: {
  state: GameState; pack: ContentPack; selectedId: string | null; onSelect: (id: string) => void;
}) {
  function keySelect(event: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
  }
  return <table className="desk-table" aria-label="今日行情"><thead><tr><th scope="col">商品</th><th scope="col">单价</th><th scope="col">持有</th></tr></thead><tbody>
    {pack.goods.filter(({ id }) => state.market[id] !== undefined).map((good) =>
      <tr key={good.id} tabIndex={0} aria-selected={selectedId === good.id} onClick={() => onSelect(good.id)} onKeyDown={(event) => keySelect(event, good.id)}>
        <th scope="row">{good.name}</th><td>¥{state.market[good.id].toLocaleString()}</td><td>{state.inventory[good.id]?.quantity ?? 0} 件</td>
      </tr>)}
  </tbody></table>;
}
