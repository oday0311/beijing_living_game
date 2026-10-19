import { useState } from 'react';
import type { JSX } from 'react';
import { ArrowLeft, ArrowRight, Download, Info, MapPin, RotateCcw, Trophy } from 'lucide-react';
import { classicContent } from './content/classic';
import { modernContent } from './content/modern';
import type { GameState } from './engine/types';
import { GameProvider } from './game/GameProvider';
import { useGame } from './game/useGame';
import { BACKUP_SAVE_KEY, loadScores } from './persistence/storage';
import { gameStateSchema } from './persistence/schema';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { StartScreen } from './ui/StartScreen';
import './app.css';

interface AppProps {
  storage?: Storage;
  initialState?: GameState;
}

function hasBackup(storage?: Storage): boolean {
  try {
    const raw = (storage ?? localStorage).getItem(BACKUP_SAVE_KEY);
    return raw !== null && gameStateSchema.safeParse(JSON.parse(raw)).success;
  } catch {
    return false;
  }
}

function downloadDamagedSave(raw: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `beijing-fushengji-damaged-${timestamp}.json.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function GameView({ onShowScores, onShowAbout }: { onShowScores: () => void; onShowAbout: () => void }) {
  const { state, dispatch, returnToStart } = useGame();
  const [tab, setTab] = useState<'market' | 'inventory' | 'city'>('market');
  if (!state) return null;
  const pack = state.mode === 'classic' ? classicContent : modernContent;
  const location = pack.locations.find(({ id }) => id === state.locationId);
  const pending = state.pendingEvents[0];
  return <main className="game-screen">
    <header className="game-header">
      <div className="game-brand"><span className="brand-mark small" aria-hidden="true">京</span><span>北京浮生记</span></div>
      <nav aria-label="页面导航" className="game-nav">
        <button type="button" title="排行榜" aria-label="排行榜" onClick={onShowScores}><Trophy size={19} /></button>
        <button type="button" title="关于" aria-label="关于" onClick={onShowAbout}><Info size={19} /></button>
        <button type="button" className="back-link" onClick={returnToStart}><ArrowLeft size={17} /> 返回入口</button>
      </nav>
    </header>
    <div className="game-content">
      <div className="game-title-row">
        <div><p className="eyebrow">{state.mode === 'classic' ? '经典模式' : '新北京模式'} · 第 {state.day} / {state.daysTotal} 天</p>
          <h1>{state.playerName}的北京日程</h1></div>
        <span className="location-chip"><MapPin size={17} aria-hidden="true" /> {location?.name ?? '尚未出发'}</span>
      </div>
      <dl className="status-strip">
        <div><dt>现金</dt><dd>¥{state.cash.toLocaleString()}</dd></div>
        <div><dt>存款</dt><dd>¥{state.bank.toLocaleString()}</dd></div>
        {state.mode === 'modern' && <div><dt>电子余额</dt><dd>¥{state.wallet.toLocaleString()}</dd></div>}
        <div><dt>债务</dt><dd>¥{state.debt.toLocaleString()}</dd></div>
        <div><dt>健康</dt><dd>{state.health}</dd></div>
        <div><dt>容量</dt><dd>{Object.values(state.inventory).reduce((sum, lot) => sum + lot.quantity, 0)} / {state.capacity}</dd></div>
      </dl>
      {pending && <section className="event-notice" aria-labelledby="event-title">
        <div><p className="eyebrow">城市快讯</p><h2 id="event-title">{pending.title}</h2><p>{pending.body}</p></div>
        <button className="button button-primary" type="button" onClick={() => dispatch({ type: 'ACK_EVENT' })}>知道了 <ArrowRight size={17} /></button>
      </section>}
      {state.status !== 'playing' && <section className="end-notice">
        <h2>{state.status === 'won' ? '这一程，收获颇丰' : '这一程，暂告一段落'}</h2>
        <p>{state.finalScore === null ? '旅程已经结束。' : `最终得分：${state.finalScore.toLocaleString()}`}</p>
      </section>}
      <div className="game-tabs" role="tablist" aria-label="游戏视图">
        {([['market', '行情'], ['inventory', '存货'], ['city', '城市']] as const).map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <section className="game-panel" role="tabpanel">
        {tab === 'market' && <><h2>今日行情</h2><div className="data-list">
          {pack.goods.filter((good) => state.market[good.id] !== undefined).map((good) =>
            <div key={good.id}><span>{good.name}</span><strong>¥{state.market[good.id].toLocaleString()}</strong></div>)}
        </div></>}
        {tab === 'inventory' && <><h2>当前存货</h2><div className="data-list">
          {Object.entries(state.inventory).length === 0 ? <p className="empty-note">暂无存货</p> :
            Object.entries(state.inventory).map(([id, lot]) => <div key={id}>
              <span>{pack.goods.find((good) => good.id === id)?.name ?? id}</span><strong>{lot.quantity} 件</strong>
            </div>)}
        </div></>}
        {tab === 'city' && <><h2>选择下一站</h2><div className="station-list">
          {pack.locations.map((station) => <button key={station.id} type="button" disabled={state.status !== 'playing' || station.id === state.locationId || !!pending}
            onClick={() => dispatch({ type: 'TRAVEL', targetId: station.id })}>
            <span>{station.name}</span>{station.id === state.locationId ? <small>当前位置</small> : <ArrowRight size={16} />}
          </button>)}
        </div></>}
      </section>
    </div>
  </main>;
}

export function AppContent({ storage }: { storage?: Storage }) {
  const { state, loadResult, storageAvailable, error, clearError, startGame, continueGame, abandonGame, restoreSavedGame } = useGame();
  const [view, setView] = useState<'home' | 'scores' | 'about'>('home');
  const [confirmNew, setConfirmNew] = useState(false);
  const [backupAvailable] = useState(() => hasBackup(storage));

  if (view === 'scores') {
    const scores = loadScores(storage);
    return <main className="aux-screen"><div className="aux-inner">
      <button type="button" className="button button-link" onClick={() => setView('home')}><ArrowLeft size={16} /> 返回</button>
      <h1><Trophy size={26} /> 本地排行榜</h1>
      {(['classic', 'modern'] as const).map((mode) => <section key={mode} className="score-section">
        <h2>{mode === 'classic' ? '经典模式' : '新北京模式'}</h2>
        {scores[mode].length === 0 ? <p className="empty-note">暂无成绩</p> : <ol>{scores[mode].map((entry) =>
          <li key={entry.id}><span>{entry.playerName}</span><strong>{entry.score.toLocaleString()}</strong></li>)}</ol>}
      </section>)}
    </div></main>;
  }
  if (view === 'about') return <main className="aux-screen"><div className="aux-inner">
    <button type="button" className="button button-link" onClick={() => setView('home')}><ArrowLeft size={16} /> 返回</button>
    <h1>关于北京浮生记</h1><p>四十天，一座城，两种年代。</p>
    <p>经典模式重现旧作规则；新北京模式讲述当代城市里的另一段日常。</p>
  </div></main>;

  if (state) return <><GameView onShowScores={() => setView('scores')} onShowAbout={() => setView('about')} />
    {!storageAvailable && <p className="storage-warning" role="status">浏览器存储不可用，本局进度只在当前页面有效。</p>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
  </>;

  if (loadResult.kind === 'corrupt' || loadResult.kind === 'incompatible') return <main className="start-screen recovery-screen">
    <div className="start-inner">
      <header className="start-heading"><div className="brand-mark" aria-hidden="true">京</div><div><p className="eyebrow">存档恢复</p><h1>北京浮生记</h1></div></header>
      <section className="start-section" aria-labelledby="recovery-title">
        <div className="section-label">需要处理</div><h2 id="recovery-title">{loadResult.kind === 'corrupt' ? '当前存档无法读取' : '当前存档版本不兼容'}</h2>
        <p>原始内容仍保留在浏览器中。请选择下一步。</p>
        <div className="recovery-actions">
          <button type="button" className="button button-primary" disabled={!backupAvailable} onClick={restoreSavedGame}>
            <RotateCcw size={17} /> 恢复上一份有效存档</button>
          <button type="button" className="button button-outline" onClick={() => downloadDamagedSave(loadResult.raw)}>
            <Download size={17} /> 下载损坏存档原文</button>
          <button type="button" className="button button-link" onClick={() => setConfirmNew(true)}>新开游戏</button>
        </div>
      </section>
    </div>
    {confirmNew && <ConfirmDialog title="新开游戏？" confirmLabel="确认新开" onCancel={() => setConfirmNew(false)}
      onConfirm={() => { setConfirmNew(false); abandonGame(); }}>当前无法读取的存档会被清除。</ConfirmDialog>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
  </main>;

  return <><StartScreen savedGame={loadResult.kind === 'ok' ? loadResult.state : null} onStart={startGame}
    onContinue={continueGame} onRestart={abandonGame} onShowScores={() => setView('scores')} onShowAbout={() => setView('about')} />
    {!storageAvailable && <p className="storage-warning" role="status">浏览器存储不可用，本局进度只在当前页面有效。</p>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
  </>;
}

export function App({ storage, initialState }: AppProps): JSX.Element {
  return <GameProvider storage={storage} initialState={initialState}><AppContent storage={storage} /></GameProvider>;
}
