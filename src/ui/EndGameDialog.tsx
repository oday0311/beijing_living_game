import { useRef } from 'react';
import type { GameState } from '../engine/types';
import type { ScoresByMode } from '../persistence/storage';
import { useModalFocus } from './useModalFocus';

export function EndGameDialog({ state, scores, onClose, onRestart, onReturn }: {
  state: GameState;
  scores: ScoresByMode;
  onClose: () => void;
  onRestart: () => void;
  onReturn: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose);
  const scored = state.finalScore !== null;
  const rank = scored ? scores[state.mode].findIndex(({ id }) => id === `${state.mode}:${state.seed}:${state.playerName}`) + 1 : 0;
  return <div className="dialog-backdrop"><div ref={ref} className="desk-dialog auxiliary-dialog" role="dialog" aria-modal="true" aria-labelledby="end-title">
    <p className="eyebrow">第 {state.day} 天 · {state.mode === 'classic' ? '经典模式' : '新北京模式'}</p>
    <h2 id="end-title">本局结算</h2>
    <p>{state.status === 'won' ? '旅程完成' : scored ? '旅程结束' : '健康耗尽，旅程提前结束。本局没有最终得分。'}</p>
    {scored && <><strong className="end-score">{state.finalScore?.toLocaleString()}</strong>
      <p className="dialog-note">现金 + 银行存款 + 电子余额 - 债务</p></>}
    <dl className="dialog-facts"><div><dt>现金</dt><dd>{state.cash.toLocaleString()}</dd></div>
      <div><dt>银行存款</dt><dd>{state.bank.toLocaleString()}</dd></div>
      <div><dt>电子余额</dt><dd>{state.wallet.toLocaleString()}</dd></div>
      <div><dt>债务</dt><dd>{state.debt.toLocaleString()}</dd></div>
      <div><dt>健康</dt><dd>{state.health.toLocaleString()}</dd></div>
      <div><dt>名声</dt><dd>{state.fame.toLocaleString()}</dd></div></dl>
    {scored && <p>本地排名：{rank > 0 ? `第 ${rank} 名` : '未进入前十'}</p>}
    <div className="dialog-actions end-actions"><button type="button" className="button button-quiet" onClick={onClose}>查看棋盘</button>
      <button type="button" className="button button-outline" onClick={onReturn}>返回入口</button>
      <button type="button" className="button button-primary" onClick={onRestart}>重新开始</button></div>
  </div></div>;
}
