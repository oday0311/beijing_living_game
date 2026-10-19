import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { ArrowLeft, Download, RotateCcw, Trophy } from 'lucide-react';
import type { GameState } from './engine/types';
import { GameProvider } from './game/GameProvider';
import { useGame } from './game/useGame';
import { BACKUP_SAVE_KEY, loadScores } from './persistence/storage';
import { gameStateSchema } from './persistence/schema';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { StartScreen } from './ui/StartScreen';
import { GameShell } from './ui/GameShell';
import './app.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';

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
export function AppContent({ storage }: { storage?: Storage }) {
  const { state, loadResult, storageAvailable, error, clearError, startGame, continueGame, abandonGame, restoreSavedGame } = useGame();
  const [view, setView] = useState<'home' | 'scores' | 'about'>('home');
  const [confirmNew, setConfirmNew] = useState(false);
  const [focusAfterConfirmation, setFocusAfterConfirmation] = useState(false);
  const [backupAvailable] = useState(() => hasBackup(storage));
  const recoveryFocusHandled = useRef(false);

  useEffect(() => {
    if (!focusAfterConfirmation) {
      recoveryFocusHandled.current = false;
      return;
    }
    if (recoveryFocusHandled.current || (loadResult.kind !== 'corrupt' && loadResult.kind !== 'incompatible')) return;
    const heading = document.getElementById('recovery-title');
    if (!heading) return;
    recoveryFocusHandled.current = true;
    heading.focus();
    queueMicrotask(() => setFocusAfterConfirmation(false));
  }, [focusAfterConfirmation, loadResult.kind]);

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

  if (state) return <><GameShell onShowScores={() => setView('scores')} onShowAbout={() => setView('about')} />
    {!storageAvailable && <p className="storage-warning" role="status">浏览器存储不可用，本局进度只在当前页面有效。</p>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
  </>;

  if (loadResult.kind === 'corrupt' || loadResult.kind === 'incompatible') return <main className="start-screen recovery-screen">
    <div className="start-inner">
      <header className="start-heading"><div className="brand-mark" aria-hidden="true">京</div><div><p className="eyebrow">存档恢复</p><h1>北京浮生记</h1></div></header>
      <section className="start-section" aria-labelledby="recovery-title">
        <div className="section-label">需要处理</div><h2 id="recovery-title" tabIndex={-1}>{loadResult.kind === 'corrupt' ? '当前存档无法读取' : '当前存档版本不兼容'}</h2>
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
      onConfirm={() => { setFocusAfterConfirmation(true); setConfirmNew(false); abandonGame(); }}>当前无法读取的存档会被清除。</ConfirmDialog>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
  </main>;

  return <><StartScreen savedGame={loadResult.kind === 'ok' ? loadResult.state : null} onStart={startGame}
    onContinue={continueGame} onRestart={() => { setFocusAfterConfirmation(true); abandonGame(); }}
    onShowScores={() => setView('scores')} onShowAbout={() => setView('about')}
    focusAfterConfirmation={focusAfterConfirmation}
    onConfirmationFocusHandled={() => setFocusAfterConfirmation(false)} />
    {!storageAvailable && <p className="storage-warning" role="status">浏览器存储不可用，本局进度只在当前页面有效。</p>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
  </>;
}

export function App({ storage, initialState }: AppProps): JSX.Element {
  return <GameProvider storage={storage} initialState={initialState}><AppContent storage={storage} /></GameProvider>;
}
