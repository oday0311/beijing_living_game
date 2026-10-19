import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowLeft, BanknoteArrowDown, BookOpen, Building2, HeartPulse, Info, Landmark, MapPin, Trophy, Volume2, VolumeX, Wallet } from 'lucide-react';
import { classicContent } from '../content/classic';
import { modernContent } from '../content/modern';
import type { GameCommand } from '../engine/types';
import { playCue } from '../audio/sounds';
import { useGame } from '../game/useGame';
import { EventDialog } from './EventDialog';
import { JournalDrawer } from './JournalDrawer';
import { SubwayMap } from './SubwayMap';
import { InventoryTable } from './InventoryTable';
import { MarketTable } from './MarketTable';
import { ServiceDialog } from './ServiceDialog';
import type { ServiceKind } from './ServiceDialog';
import { StatusStrip } from './StatusStrip';
import { TradeDialog } from './TradeDialog';

const tabs = [
  { id: 'market', label: '行情' }, { id: 'inventory', label: '存货' }, { id: 'city', label: '城市' },
] as const;
type Tab = typeof tabs[number]['id'];

export function GameShell({ onShowScores, onShowAbout }: { onShowScores: () => void; onShowAbout: () => void }) {
  const { state, dispatch, returnToStart } = useGame();
  const [tab, setTab] = useState<Tab>('market');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trade, setTrade] = useState<'buy' | 'sell' | null>(null);
  const [service, setService] = useState<ServiceKind | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabButtons = useRef<Record<Tab, HTMLButtonElement | null>>({ market: null, inventory: null, city: null });
  const journalButton = useRef<HTMLButtonElement>(null);
  const lastEventId = useRef<string | null>(null);
  const pendingEventId = state?.pendingEvents[0]?.id ?? null;
  useEffect(() => {
    if (pendingEventId && pendingEventId !== lastEventId.current) playCue('event', soundEnabled);
    lastEventId.current = pendingEventId;
  }, [pendingEventId, soundEnabled]);
  if (!state) return null;
  const pack = state.mode === 'classic' ? classicContent : modernContent;
  const location = pack.locations.find(({ id }) => id === state.locationId);
  const pending = state.pendingEvents[0];
  const selected = selectedId && state.market[selectedId] !== undefined ? selectedId : pack.goods.find(({ id }) => state.market[id] !== undefined)?.id ?? null;
  const active = state.status === 'playing' && !pending;

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((item) => item.id === tab);
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabButtons.current[tabs[next].id]?.focus();
  }
  function submit(command: GameCommand) {
    dispatch(command);
    if (command.type === 'BUY' || command.type === 'SELL') playCue(command.type === 'BUY' ? 'buy' : 'sell', soundEnabled);
    setTrade(null);
    setService(null);
  }
  return <main className="game-screen">
    <header className="game-header"><div className="game-brand"><span className="brand-mark small" aria-hidden="true">京</span><span>北京浮生记</span></div>
      <nav aria-label="页面导航" className="game-nav">
        <button type="button" title="排行榜" aria-label="排行榜" onClick={onShowScores}><Trophy size={19} /></button>
        <button type="button" title="关于" aria-label="关于" onClick={onShowAbout}><Info size={19} /></button>
        <button ref={journalButton} type="button" title="旅程日记" aria-label="旅程日记" onClick={() => setJournalOpen(true)}><BookOpen size={19} /></button>
        <button type="button" title={soundEnabled ? '关闭音效' : '开启音效'} aria-label={soundEnabled ? '关闭音效' : '开启音效'} aria-pressed={soundEnabled} onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        <button type="button" className="back-link" onClick={returnToStart}><ArrowLeft size={17} /> 返回入口</button>
      </nav></header>
    <div className="game-content desk-content">
      <div className="game-title-row"><div><p className="eyebrow">{state.mode === 'classic' ? '经典模式' : '新北京模式'} · 第 {state.day} / {state.daysTotal} 天</p>
        <h1 ref={headingRef} tabIndex={-1}>{state.playerName}的北京日程</h1></div><span className="location-chip"><MapPin size={17} aria-hidden="true" /> {location?.name ?? '尚未出发'}</span></div>
      <StatusStrip state={state} pack={pack} />
      {state.status !== 'playing' && <section className="end-notice"><div><h2>{state.status === 'won' ? '这一程，收获颇丰' : '这一程，暂告一段落'}</h2>
        <p>{state.finalScore === null ? '旅程已经结束。' : `最终得分：${state.finalScore.toLocaleString()}`}</p></div></section>}
      <div className="game-tabs" role="tablist" aria-label="游戏视图" onKeyDown={handleTabKeyDown}>
        {tabs.map(({ id, label }) => <button key={id} ref={(node) => { tabButtons.current[id] = node; }} id={`game-tab-${id}`}
          type="button" role="tab" aria-controls={`game-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
          onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <div className="desk-board">
        <section id="game-panel-market" aria-labelledby="game-tab-market" className="game-panel desk-market" role="tabpanel" tabIndex={0} hidden={tab !== 'market'}>
          <div className="desk-section-head"><h2>今日行情</h2><span>点击商品选择</span></div>
          <MarketTable state={state} pack={pack} selectedId={selected} onSelect={setSelectedId} />
        </section>
        <section id="game-panel-inventory" aria-labelledby="game-tab-inventory" className="game-panel desk-inventory" role="tabpanel" tabIndex={0} hidden={tab !== 'inventory'}>
          <div className="desk-section-head"><h2>当前存货</h2><span>货架 {Object.values(state.inventory).reduce((sum, lot) => sum + lot.quantity, 0)} / {state.capacity}</span></div>
          <InventoryTable state={state} pack={pack} />
        </section>
        <section id="game-panel-city" aria-labelledby="game-tab-city" className="game-panel desk-city" role="tabpanel" tabIndex={0} hidden={tab !== 'city'}>
          <div className="desk-section-head"><h2>选择下一站</h2><span>旅行将进入下一天</span></div>
          <SubwayMap state={state} pack={pack} disabled={!active} onTravel={(targetId) => { dispatch({ type: 'TRAVEL', targetId }); playCue('travel', soundEnabled); }} />
        </section>
      </div>
    </div>
    <div className="desk-actionbar"><div className="desk-action-inner"><span className="desk-selected">{selected ? pack.goods.find(({ id }) => id === selected)?.name : '今日无商品'}</span>
      <div className="desk-actions"><button className="button button-primary" type="button" disabled={!active || !selected} onClick={() => setTrade('buy')}>买进</button>
        <button className="button button-outline" type="button" disabled={!active || !selected || !state.inventory[selected]?.quantity} onClick={() => setTrade('sell')}>卖出</button></div>
      <div className="desk-services">{location?.services.includes('bank') && <button type="button" onClick={() => setService('bank')} disabled={!active} title="银行"><Landmark size={18} aria-hidden="true" /><span>银行</span></button>}
        <button type="button" onClick={() => setService('repay')} disabled={!active} title="还债"><Wallet size={18} aria-hidden="true" /><span>还债</span></button>
        {state.mode === 'modern' && <button type="button" onClick={() => setService('borrow')} disabled={!active} title="借款"><BanknoteArrowDown size={18} aria-hidden="true" /><span>借款</span></button>}
        {state.mode === 'classic' && location?.services.includes('hospital') && <button type="button" onClick={() => setService('heal')} disabled={!active} title="医院"><HeartPulse size={18} aria-hidden="true" /><span>医院</span></button>}
        {state.mode === 'classic' && location?.services.includes('housing') && <button type="button" onClick={() => setService('housing')} disabled={!active} title="住房"><Building2 size={18} aria-hidden="true" /><span>住房</span></button>}</div></div></div>
    {trade && selected && <TradeDialog key={`${trade}-${selected}`} state={state} pack={pack} itemId={selected} kind={trade} onClose={() => setTrade(null)} onSubmit={submit} />}
    {service && <ServiceDialog key={service} state={state} kind={service} onClose={() => setService(null)} onSubmit={submit} />}
    {pending && <EventDialog event={pending} mode={state.mode} onAcknowledge={() => dispatch({ type: 'ACK_EVENT' })} fallbackFocus={headingRef} />}
    {journalOpen && <JournalDrawer entries={state.journal} pack={pack} onClose={() => setJournalOpen(false)} fallbackFocus={journalButton} />}
  </main>;
}
