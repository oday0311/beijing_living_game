import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ScoresByMode } from '../persistence/storage';
import type { Mode } from '../engine/types';
import { useModalFocus } from './useModalFocus';

export function ScoreboardDialog({ scores, onClose }: { scores: ScoresByMode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('classic');
  useModalFocus(ref, onClose);
  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'classic' : event.key === 'End' ? 'modern' : mode === 'classic' ? 'modern' : 'classic';
    setMode(next);
    ref.current?.querySelector<HTMLButtonElement>(`[data-score-mode="${next}"]`)?.focus();
  }
  return <div className="dialog-backdrop"><div ref={ref} className="desk-dialog auxiliary-dialog" role="dialog" aria-modal="true" aria-labelledby="scores-title">
    <h2 id="scores-title">本地排行榜</h2>
    <div className="mode-control score-tabs" role="tablist" aria-label="排行榜模式" onKeyDown={handleTabKeyDown}>
      {(['classic', 'modern'] as const).map((item) => <button key={item} type="button" role="tab" data-score-mode={item} aria-selected={mode === item}
        aria-controls="score-panel" tabIndex={mode === item ? 0 : -1} onClick={() => setMode(item)}>{item === 'classic' ? '经典模式' : '新北京模式'}</button>)}
    </div>
    <div id="score-panel" role="tabpanel" aria-label={mode === 'classic' ? '经典模式' : '新北京模式'}>
      {scores[mode].length ? <ol className="score-list">{scores[mode].map((entry) => <li key={entry.id}>
        <span>{entry.playerName}<small>{new Date(entry.finishedAt).toLocaleDateString('zh-CN')}</small></span>
        <strong>{entry.score.toLocaleString()}</strong></li>)}</ol> : <p className="empty-note">暂无成绩</p>}
    </div>
    <div className="dialog-actions"><button type="button" className="button button-primary" onClick={onClose}>关闭</button></div>
  </div></div>;
}
