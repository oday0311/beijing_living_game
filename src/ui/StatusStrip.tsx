import type { ContentPack } from '../content/contract';
import type { GameState } from '../engine/types';

const money = (value: number) => `¥${value.toLocaleString()}`;

export function StatusStrip({ state, pack }: { state: GameState; pack: ContentPack }) {
  const occupied = Object.values(state.inventory).reduce((sum, lot) => sum + lot.quantity, 0);
  const weather = pack.weather.find(({ id }) => id === state.weatherId);
  return <dl className="desk-status">
    <div><dt>现金</dt><dd>{money(state.cash)}</dd></div>
    <div><dt>存款</dt><dd>{money(state.bank)}</dd></div>
    {state.mode === 'modern' && <div><dt>电子余额</dt><dd>{money(state.wallet)}</dd></div>}
    <div><dt>债务</dt><dd>{money(state.debt)}</dd></div>
    <div><dt>健康</dt><dd>{state.health} / 100</dd></div>
    <div><dt>名声</dt><dd>{state.fame}</dd></div>
    <div><dt>容量</dt><dd>{occupied} / {state.capacity}</dd></div>
    {state.mode === 'modern' && <><div><dt>信用</dt><dd>{state.credit}</dd></div>
      <div><dt>天气</dt><dd>{weather?.name ?? '待更新'}</dd></div></>}
  </dl>;
}
