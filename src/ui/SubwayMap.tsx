import { useState } from 'react';
import type { ContentPack } from '../content/contract';
import { quoteTravel } from '../engine/day-cycle';
import type { GameState } from '../engine/types';
import { ConfirmDialog } from './ConfirmDialog';

const positions: Record<string, [number, number]> = {
  zhongguancun: [8, 14], haidianhuangzhuang: [21, 28], xizhimen: [34, 44],
  sanyuanqiao: [46, 18], shuangjing: [68, 29], guomao: [86, 28],
  fuxingmen: [18, 63], chaoyangmen: [53, 62], dongzhimen: [78, 61],
  nanluoguxiang: [40, 80], hujialou: [69, 79], tongzhoubeiguan: [89, 86],
};
const lineColors: Record<string, string> = {
  'line-4': '#4f8067', 'line-10': '#d5aa45', 'line-2': '#bd4334', 'line-6': '#6f7f79', classic: '#bd4334',
};
const lineName = (id: string) => id === 'classic' ? '经典线路' : `${id.replace('line-', '')}号线`;

export function SubwayMap({ state, pack, disabled, onTravel }: {
  state: GameState; pack: ContentPack; disabled: boolean; onTravel: (targetId: string) => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = pack.locations.find(({ id }) => id === targetId);
  let selectedQuote: ReturnType<typeof quoteTravel> | null = null;
  if (target) {
    try { selectedQuote = quoteTravel(state, target.id, pack); } catch { /* The route is unavailable. */ }
  }
  const lines = [...new Set(pack.locations.flatMap(({ lineIds }) => lineIds))];
  return <>
    <div className={`subway-map ${pack.mode === 'classic' ? 'subway-map-classic' : ''}`} aria-label="北京线路图">
      {pack.mode === 'modern' && lines.flatMap((lineId) => {
        const stations = pack.locations.filter(({ lineIds }) => lineIds.includes(lineId));
        return stations.slice(1).map((station, index) => {
          const [x1, y1] = positions[stations[index].id];
          const [x2, y2] = positions[station.id];
          const dx = x2 - x1;
          const dy = (y2 - y1) * (520 / 1110);
          return <span key={`${lineId}-${station.id}`} className="subway-connector" aria-hidden="true" style={{
            left: `${x1}%`, top: `${y1}%`, width: `${Math.hypot(dx, dy)}%`,
            transform: `rotate(${Math.atan2(dy, dx)}rad)`, backgroundColor: lineColors[lineId],
          }} />;
        });
      })}
      {pack.locations.map((station) => {
        let quote: ReturnType<typeof quoteTravel> | null = null;
        try { quote = quoteTravel(state, station.id, pack); } catch { /* The route is unavailable. */ }
        const current = station.id === state.locationId;
        const route = quote?.path.map((id) => pack.locations.find((place) => place.id === id)?.name ?? id).join(' → ');
        const lineDescription = quote?.lineIds.map(lineName).join(' → ');
        const stationLines = station.lineIds.map(lineName).join('、');
        const position = positions[station.id];
        return <button key={station.id} type="button" className="subway-station"
          style={position && pack.mode === 'modern' ? { left: `${position[0]}%`, top: `${position[1]}%` } : undefined}
          aria-current={current ? 'location' : undefined}
          aria-labelledby={`station-name-${station.id}`}
          aria-describedby={`station-detail-${station.id}`}
          aria-pressed={targetId === station.id}
          disabled={disabled || current || !quote}
          onClick={() => setTargetId(station.id)}>
          <span className="station-symbol" aria-hidden="true" style={{ borderColor: lineColors[station.lineIds[0]] }} />
          <span className="station-copy"><strong id={`station-name-${station.id}`}>{station.name}</strong>
            {station.lineIds.length > 1 && <em>换乘</em>}
            {current ? <small id={`station-detail-${station.id}`}>当前位置；{station.lineIds.length > 1 ? '换乘站；' : ''}{stationLines}</small>
              : <small id={`station-detail-${station.id}`}>{station.lineIds.length > 1 ? '换乘站；' : ''}线路：{stationLines}；路线：{route}；{lineDescription || '线路未标注'} · {quote?.transfers ?? 0} 次换乘 · 车费 ¥{quote?.fare ?? 0}{quote?.freeTransitUsed ? '（免票）' : ''}</small>}
          </span>
        </button>;
      })}
    </div>
    {target && selectedQuote && <ConfirmDialog title={`前往${target.name}？`} confirmLabel="确认换站"
      onCancel={() => setTargetId(null)} onConfirm={() => { onTravel(target.id); setTargetId(null); }}>
      {selectedQuote.path.map((id) => pack.locations.find((place) => place.id === id)?.name ?? id).join(' → ')}；
      {selectedQuote.lineIds.map(lineName).join(' → ')}；{selectedQuote.transfers} 次换乘；
      票价 ¥{selectedQuote.fare}{selectedQuote.freeTransitUsed ? '（免票）' : ''}。换站后进入下一天。
    </ConfirmDialog>}
  </>;
}
