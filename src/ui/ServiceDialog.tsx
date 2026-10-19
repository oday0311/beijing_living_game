import { useEffect, useRef, useState } from 'react';
import type { Account, GameCommand, GameState } from '../engine/types';
import { housingUpgradeCost } from '../engine/services';
import { useModalFocus } from './useModalFocus';

export type ServiceKind = 'bank' | 'repay' | 'borrow' | 'heal' | 'housing';
const accountNames: Record<Account, string> = { cash: '现金', bank: '存款', wallet: '电子余额' };
const labels: Record<ServiceKind, string> = { bank: '银行转账', repay: '还债', borrow: '借款', heal: '医院', housing: '住房扩容' };
const commands: Record<ServiceKind, string> = { bank: '确认转账', repay: '确认还债', borrow: '确认借款', heal: '确认治疗', housing: '确认扩容' };
const positiveInteger = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));

export function ServiceDialog({ state, kind, onClose, onSubmit }: {
  state: GameState; kind: ServiceKind; onClose: () => void; onSubmit: (command: GameCommand) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);
  const accounts: Account[] = state.mode === 'modern' ? ['cash', 'bank', 'wallet'] : ['cash', 'bank'];
  const [amount, setAmount] = useState('1');
  const [from, setFrom] = useState<Account>('cash');
  const [to, setTo] = useState<Account>('bank');
  const [account, setAccount] = useState<Account>('cash');
  const [confirmSpend, setConfirmSpend] = useState(false);
  useEffect(() => {
    if (confirmSpend) dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    else dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [confirmSpend]);
  const value = Number(amount);
  const valid = kind === 'housing' || positiveInteger(amount);
  const liquid = state.cash + state.bank + (state.mode === 'modern' ? state.wallet : 0);
  const spend = kind === 'repay' ? value : kind === 'heal' ? Math.min(value, 100 - state.health) * 3500
    : kind === 'housing' ? housingUpgradeCost(state.cash) : 0;
  function command(): GameCommand {
    switch (kind) {
      case 'bank': return { type: 'TRANSFER', from, to, amount: value };
      case 'repay': return { type: 'REPAY_DEBT', amount: value, account };
      case 'borrow': return { type: 'BORROW', amount: value };
      case 'heal': return { type: 'HEAL', points: value, account: 'cash' };
      case 'housing': return { type: 'UPGRADE_HOUSING', account: 'cash' };
    }
  }
  function submit() {
    if (!valid) return;
    const threshold = kind === 'housing' ? state.cash / 2 : liquid / 2;
    if (spend > threshold && (kind !== 'housing' || state.cash >= 30_000) && !confirmSpend) {
      setConfirmSpend(true);
      return;
    }
    onSubmit(command());
  }
  return <div className="dialog-backdrop"><div ref={dialogRef} className="desk-dialog" role="dialog" aria-modal="true" aria-label={confirmSpend ? '确认大额支出' : labels[kind]}>
    <h2>{confirmSpend ? '确认大额支出' : labels[kind]}</h2>
    {confirmSpend ? <><p className="dialog-warning">预计支出 ¥{spend.toLocaleString()}，超过现有流动资产的一半。</p>
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={() => setConfirmSpend(false)}>返回修改</button>
        <button className="button button-danger" type="button" onClick={submit}>继续支出</button></div></> : <>
      {kind === 'bank' && <><label className="dialog-field">转出账户<select value={from} onChange={(event) => setFrom(event.target.value as Account)}>
        {accounts.map((id) => <option key={id} value={id}>{accountNames[id]} · ¥{state[id].toLocaleString()}</option>)}
      </select></label><label className="dialog-field">转入账户<select value={to} onChange={(event) => setTo(event.target.value as Account)}>
        {accounts.map((id) => <option key={id} value={id}>{accountNames[id]}</option>)}
      </select></label></>}
      {kind === 'repay' && <><p className="dialog-note">当前债务 ¥{state.debt.toLocaleString()}</p>
        {state.mode === 'modern' && <label className="dialog-field">支付账户<select value={account} onChange={(event) => setAccount(event.target.value as Account)}>
          {accounts.map((id) => <option key={id} value={id}>{accountNames[id]} · ¥{state[id].toLocaleString()}</option>)}
        </select></label>}</>}
      {kind === 'borrow' && <p className="dialog-note">借款将计入债务，额度由当前信用决定。</p>}
      {kind === 'heal' && <p className="dialog-note">当前健康 {state.health} / 100，每点 ¥3,500，现金支付。</p>}
      {kind === 'housing' && <><p className="dialog-note">当前容量 {state.capacity}，扩容 10 格。</p>
        {state.cash >= 30_000 ? <p className="dialog-total">预计费用 <strong>¥{housingUpgradeCost(state.cash).toLocaleString()}</strong></p>
          : <p className="dialog-note">扩容需要至少 ¥30,000 现金。</p>}</>}
      {kind !== 'housing' && <label className="dialog-field">{kind === 'heal' ? '点数' : '金额'}<input type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>}
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>取消</button>
        <button className="button button-primary" type="button" disabled={!valid} onClick={submit}>{commands[kind]}</button></div>
    </>}
  </div></div>;
}
