import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Clock3, Info, RotateCcw, Trophy } from 'lucide-react';
import { modernContent } from '../content/modern';
import type { GameState, Mode } from '../engine/types';
import type { StartGameOptions } from '../game/useGame';
import { ConfirmDialog } from './ConfirmDialog';

interface StartScreenProps {
  savedGame: GameState | null;
  onStart: (options: StartGameOptions) => void;
  onContinue?: () => void;
  onRestart?: () => void;
  onShowScores?: () => void;
  onShowAbout?: () => void;
  focusAfterConfirmation?: boolean;
}

export function StartScreen({ savedGame, onStart, onContinue, onRestart, onShowScores, onShowAbout, focusAfterConfirmation = false }: StartScreenProps) {
  const [mode, setMode] = useState<Mode>('classic');
  const [playerName, setPlayerName] = useState('');
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusAfterConfirmation) return;
    if (savedGame) continueRef.current?.focus();
    else nameRef.current?.focus();
  }, [focusAfterConfirmation, savedGame]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playerName.trim()) {
      setValidation('请输入角色姓名。');
      return;
    }
    if (mode === 'modern' && !identityId) {
      setValidation('请选择一个身份。');
      return;
    }
    setValidation(null);
    onStart({ mode, playerName: playerName.trim(), identityId: mode === 'modern' ? identityId : null });
  }

  return <main className="start-screen">
    <div className="start-inner">
      <header className="start-heading">
        <div className="brand-mark" aria-hidden="true">京</div>
        <div>
          <p className="eyebrow">40 日 · 城市经营</p>
          <h1>北京浮生记</h1>
        </div>
      </header>

      {savedGame ? <section className="start-section saved-section" aria-labelledby="saved-title">
        <div className="section-label"><Clock3 size={17} aria-hidden="true" /> 本地进度</div>
        <h2 id="saved-title">{savedGame.playerName}，继续上次的路</h2>
        <p>第 {savedGame.day} / {savedGame.daysTotal} 天 · {savedGame.mode === 'classic' ? '经典模式' : '新北京模式'}</p>
        <button ref={continueRef} type="button" className="button button-primary start-primary" onClick={onContinue}>
          继续游戏 <ArrowRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="button button-link" onClick={() => setConfirmRestart(true)}>
          <RotateCcw size={15} aria-hidden="true" /> 重新开始
        </button>
      </section> : <section className="start-section" aria-labelledby="new-title">
        <div className="section-label">新的一局</div>
        <h2 id="new-title">从哪一个北京出发？</h2>
        <form onSubmit={submit} noValidate>
          <div className="form-field">
            <span className="field-label">游戏模式</span>
            <div className="mode-control" role="group" aria-label="游戏模式">
              <button type="button" aria-pressed={mode === 'classic'} onClick={() => { setMode('classic'); setValidation(null); }}>经典模式</button>
              <button type="button" aria-pressed={mode === 'modern'} onClick={() => { setMode('modern'); setValidation(null); }}>新北京模式</button>
            </div>
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="player-name">角色姓名</label>
            <input ref={nameRef} id="player-name" autoComplete="off" maxLength={24} value={playerName}
              onChange={(event) => setPlayerName(event.target.value)} placeholder="写下你的名字" />
          </div>
          {mode === 'modern' && <fieldset className="identity-list" role="radiogroup" aria-label="选择身份">
            <legend className="field-label">选择身份</legend>
            {modernContent.identities.map((identity) => <label key={identity.id} className="identity-choice">
              <input type="radio" name="identity" value={identity.id} checked={identityId === identity.id}
                onChange={() => { setIdentityId(identity.id); setValidation(null); }} />
              <span><strong>{identity.name}</strong><small>{identity.description}</small></span>
            </label>)}
          </fieldset>}
          {validation && <p className="form-error" role="alert">{validation}</p>}
          <button type="submit" className="button button-primary start-primary">开始游戏 <ArrowRight size={18} aria-hidden="true" /></button>
        </form>
      </section>}

      <nav className="start-footer" aria-label="其他页面">
        <button type="button" onClick={onShowScores}><Trophy size={17} aria-hidden="true" /> 本地排行榜</button>
        <button type="button" onClick={onShowAbout}><Info size={17} aria-hidden="true" /> 关于</button>
      </nav>
    </div>
    {confirmRestart && <ConfirmDialog title="重新开始？" confirmLabel="确认重新开始"
      onCancel={() => setConfirmRestart(false)} onConfirm={() => { setConfirmRestart(false); onRestart?.(); }}>
      当前进度会被清除。此操作无法撤销。
    </ConfirmDialog>}
  </main>;
}
