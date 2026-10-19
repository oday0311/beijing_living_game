import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import type { GameState } from './engine/types';
import { GameProvider } from './game/GameProvider';
import { useGame } from './game/useGame';
import { BACKUP_SAVE_KEY, exportGame, loadScores, loadSettings, saveSettings } from './persistence/storage';
import type { GameSettings } from './persistence/schema';
import { gameStateSchema } from './persistence/schema';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { StartScreen } from './ui/StartScreen';
import { GameShell } from './ui/GameShell';
import { AboutDialog } from './ui/AboutDialog';
import { EndGameDialog } from './ui/EndGameDialog';
import { HelpDialog } from './ui/HelpDialog';
import { ScoreboardDialog } from './ui/ScoreboardDialog';
import { SettingsDialog } from './ui/SettingsDialog';
import './app.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/art.css';

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
  const { state, loadResult, storageAvailable, error, clearError, startGame, continueGame, abandonGame, restoreSavedGame, importSavedGame, returnToStart, accelerateToFinalDayForTest } = useGame();
  const [view, setView] = useState<'scores' | 'about' | 'help' | 'settings' | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings(storage));
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settlementDismissed, setSettlementDismissed] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [entryFocusRequested, setEntryFocusRequested] = useState(false);
  const [backupAvailable] = useState(() => hasBackup(storage));

  useEffect(() => {
    if (import.meta.env.MODE !== 'test') return;
    const target = window as Window & { __beijingTest?: { advanceToDay39: () => void } };
    target.__beijingTest = { advanceToDay39: accelerateToFinalDayForTest };
    return () => { delete target.__beijingTest; };
  }, [accelerateToFinalDayForTest]);

  const saved = state ?? (loadResult.kind === 'ok' ? loadResult.state : null);
  const scores = view === 'scores' || (state && state.status !== 'playing' && state.finalScore !== null) ? loadScores(storage) : null;
  function returnToEntry() {
    returnToStart();
    setSettlementDismissed(false);
    setEntryFocusRequested(true);
  }
  function resetToEntry() {
    if (!abandonGame()) return;
    setSettlementDismissed(false);
    setEntryFocusRequested(true);
  }
  function updateSettings(next: GameSettings) {
    setSettings(next);
    if (!storageAvailable) {
      setSettingsError('设置已在本次会话生效，但未保存；刷新页面后会恢复上次设置。');
      return;
    }
    try {
      saveSettings(next, storage);
      setSettingsError(null);
    } catch {
      setSettingsError('设置已在本次会话生效，但未保存；刷新页面后会恢复上次设置。');
    }
  }
  function exportSave() {
    if (!saved) return;
    const url = URL.createObjectURL(new Blob([exportGame(saved)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `beijing-fushengji-${saved.mode}-day-${saved.day}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const auxiliary = <>
    {view === 'scores' && <ScoreboardDialog scores={scores ?? loadScores(storage)} onClose={() => setView(null)} />}
    {view === 'about' && <AboutDialog onClose={() => setView(null)} />}
    {view === 'help' && <HelpDialog onClose={() => setView(null)} />}
    {view === 'settings' && <SettingsDialog settings={settings} notice={settingsError} onChange={updateSettings} onClose={() => setView(null)}
      onExport={exportSave} canExport={!!saved} canReset={!!saved} onImport={importSavedGame}
      onReset={resetToEntry} />}
    {settingsError && view !== 'settings' && <p className="settings-toast" role="status" aria-label="设置保存状态">{settingsError}</p>}
  </>;

  if (state) return <div className={`${settings.animationsEnabled ? '' : 'reduced-motion'} ${settings.compactDisplay ? 'compact-display' : ''}`}><GameShell
    onShowScores={() => setView('scores')} onShowAbout={() => setView('about')} onShowHelp={() => setView('help')} onShowSettings={() => setView('settings')}
    onReturnToEntry={returnToEntry}
    soundEnabled={settings.soundEnabled} onToggleSound={() => updateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
    onShowSettlement={() => setSettlementDismissed(false)} />
    {state.status !== 'playing' && state.pendingEvents.length === 0 && !view && !settlementDismissed &&
      <EndGameDialog state={state} scores={scores ?? loadScores(storage)} onClose={() => setSettlementDismissed(true)}
        onReturn={returnToEntry}
        onRestart={resetToEntry} />}
    {auxiliary}
    {!storageAvailable && <p className="storage-warning" role="status">浏览器存储不可用，本局进度只在当前页面有效。</p>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
  </div>;

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
      onConfirm={() => { setConfirmNew(false); if (abandonGame()) setEntryFocusRequested(true);
        else queueMicrotask(() => document.getElementById('recovery-title')?.focus()); }}>当前无法读取的存档会被清除。</ConfirmDialog>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
    {auxiliary}
  </main>;

  return <><StartScreen savedGame={loadResult.kind === 'ok' ? loadResult.state : null} onStart={startGame}
    onContinue={continueGame} onRestart={resetToEntry}
    onShowScores={() => setView('scores')} onShowAbout={() => setView('about')} onShowHelp={() => setView('help')} onShowSettings={() => setView('settings')}
    focusOnEntry={entryFocusRequested}
    onEntryFocusHandled={() => setEntryFocusRequested(false)} />
    {!storageAvailable && <p className="storage-warning" role="status">浏览器存储不可用，本局进度只在当前页面有效。</p>}
    {error && <div className="global-error" role="alert">{error}<button type="button" onClick={clearError}>关闭</button></div>}
    {auxiliary}
  </>;
}

export function App({ storage, initialState }: AppProps): JSX.Element {
  return <GameProvider storage={storage} initialState={initialState}><AppContent storage={storage} /></GameProvider>;
}
