import { useEffect, useRef, useState } from 'react';
import type { ContentPack } from '../content/contract';
import type { Account, GameCommand, GameState } from '../engine/types';
import { useModalFocus } from './useModalFocus';

const accountNames: Record<Account, string> = { cash: '现金', bank: '存款', wallet: '电子余额' };
const positiveInteger = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));

export function TradeDialog({ state, pack, itemId, kind, onClose, onSubmit }: {
  state: GameState; pack: ContentPack; itemId: string; kind: 'buy' | 'sell';
  onClose: () => void; onSubmit: (command: GameCommand) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);
  const good = pack.goods.find(({ id }) => id === itemId);
  const accounts = pack.locations.find(({ id }) => id === state.locationId)?.acceptedAccounts ?? ['cash' as Account];
  const [account, setAccount] = useState<Account>(accounts[0]);
  const [quantity, setQuantity] = useState('1');
  const [confirmSpend, setConfirmSpend] = useState(false);
  useEffect(() => {
    if (confirmSpend) dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    else dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [confirmSpend]);
  if (!good) return null;
  const price = state.market[itemId] ?? 0;
  const owned = state.inventory[itemId]?.quantity ?? 0;
  const free = state.capacity - Object.values(state.inventory).reduce((sum, lot) => sum + lot.quantity, 0);
  const max = kind === 'buy' ? Math.min(Math.floor(state[account] / price) || 0, free) : owned;
  const valid = positiveInteger(quantity);
  const command: GameCommand = kind === 'buy'
    ? { type: 'BUY', itemId, quantity: Number(quantity), account }
    : { type: 'SELL', itemId, quantity: Number(quantity), account };
  const liquid = state.cash + state.bank + (state.mode === 'modern' ? state.wallet : 0);
  const spend = kind === 'buy' ? price * Number(quantity) : 0;
  function submit() {
    if (!valid) return;
    if (spend > liquid / 2 && !confirmSpend) { setConfirmSpend(true); return; }
    onSubmit(command);
  }
  const verb = kind === 'buy' ? '买进' : '卖出';
  return <div className="dialog-backdrop"><div ref={dialogRef} className="desk-dialog" role="dialog" aria-modal="true" aria-labelledby="trade-title">
    <h2 id="trade-title">{verb} · {good.name}</h2>
    {confirmSpend ? <><p className="dialog-warning">这笔支出为 ¥{spend.toLocaleString()}，超过现有流动资产的一半。</p>
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={() => setConfirmSpend(false)}>返回修改</button>
        <button className="button button-danger" type="button" onClick={submit}>继续支出</button></div></> : <>
      <dl className="dialog-facts"><div><dt>单价</dt><dd>¥{price.toLocaleString()}</dd></div><div><dt>已持有</dt><dd>{owned} 件</dd></div>
        <div><dt>剩余容量</dt><dd>{free} 件</dd></div><div><dt>账户余额</dt><dd>¥{state[account].toLocaleString()}</dd></div><div><dt>最多可{verb}</dt><dd>{max} 件</dd></div></dl>
      <label className="dialog-field">数量<input type="number" inputMode="numeric" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      {accounts.length > 1 && <label className="dialog-field">{kind === 'buy' ? '支付账户' : '到账账户'}<select value={account} onChange={(event) => setAccount(event.target.value as Account)}>
        {accounts.map((id) => <option key={id} value={id}>{accountNames[id]}</option>)}
      </select></label>}
      <p className="dialog-total">{kind === 'buy' ? '预计支出' : '预计收入'} <strong>¥{(price * (Number(quantity) || 0)).toLocaleString()}</strong></p>
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>取消</button>
        <button className="button button-primary" type="button" disabled={!valid} onClick={submit}>确认{verb}</button></div>
    </>}
  </div></div>;
}
