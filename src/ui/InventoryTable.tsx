import type { ContentPack } from '../content/contract';
import type { GameState } from '../engine/types';

export function InventoryTable({ state, pack }: { state: GameState; pack: ContentPack }) {
  const lots = Object.entries(state.inventory).filter(([, lot]) => lot.quantity > 0);
  return <table className="desk-table" aria-label="当前存货"><thead><tr><th scope="col">商品</th><th scope="col">数量</th><th scope="col">均价</th></tr></thead><tbody>
    {lots.length === 0 ? <tr><td colSpan={3} className="desk-empty">暂无存货</td></tr> : lots.map(([id, lot]) =>
      <tr key={id}><th scope="row">{pack.goods.find((good) => good.id === id)?.name ?? id}</th><td>{lot.quantity} 件</td><td>¥{lot.averageCost.toLocaleString()}</td></tr>)}
  </tbody></table>;
}
