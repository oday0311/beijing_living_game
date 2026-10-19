import type { ContentPack } from '../content/contract';
import type { GameState } from '../engine/types';
import { marketTargetName } from './marketDisplay';

const money = (value: number) => `¥${value.toLocaleString()}`;

export function StatusStrip({ state, pack }: { state: GameState; pack: ContentPack }) {
  const occupied = Object.values(state.inventory).reduce((sum, lot) => sum + lot.quantity, 0);
  const weather = pack.weather.find(({ id }) => id === state.weatherId);
  const weatherEffect = pack.events.health.find(({ id }) => id === weather?.eventId)?.effect;
  const health = weatherEffect?.kind === 'health-delta' ? weatherEffect.amount ?? 0 : 0;
  const secondary = weatherEffect?.secondary;
  const impact = weather ? [
    health ? `健康 ${health > 0 ? '+' : ''}${health}` : null,
    secondary?.kind === 'category-trend' && secondary.target
      ? `${marketTargetName(pack, secondary.target)}价格 ×${secondary.multiplier}` : null,
    secondary?.kind === 'transit-fare-delta' ? `车费 +${secondary.amount ?? 0}` : null,
    secondary?.kind === 'event-weight' ? `健康事件概率 ×${secondary.multiplier}` : null,
  ].filter(Boolean).join('；') || '无额外影响' : '待更新';
  return <dl className="desk-status">
    <div><dt>现金</dt><dd>{money(state.cash)}</dd></div>
    <div><dt>存款</dt><dd>{money(state.bank)}</dd></div>
    {state.mode === 'modern' && <div><dt>电子余额</dt><dd>{money(state.wallet)}</dd></div>}
    <div><dt>债务</dt><dd>{money(state.debt)}</dd></div>
    <div><dt>健康</dt><dd>{state.health} / 100</dd></div>
    <div><dt>名声</dt><dd>{state.fame}</dd></div>
    <div><dt>容量</dt><dd>{occupied} / {state.capacity}</dd></div>
    {state.mode === 'modern' && <><div><dt>信用</dt><dd>{state.credit}</dd></div>
      <div><dt>天气</dt><dd>{weather?.name ?? '待更新'}</dd></div>
      <div><dt>AQI</dt><dd>{weather?.aqiLabel ?? '待更新'}</dd></div>
      <div className="desk-weather-effect"><dt>天气影响</dt><dd>{impact}</dd></div></>}
  </dl>;
}
