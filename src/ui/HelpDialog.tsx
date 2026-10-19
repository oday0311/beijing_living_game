import { useRef } from 'react';
import { useModalFocus } from './useModalFocus';

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose);
  return <div className="dialog-backdrop"><div ref={ref} className="desk-dialog auxiliary-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <h2 id="help-title">游戏帮助</h2>
    <dl className="help-rules">
      <div><dt>目标</dt><dd>在北京度过 40 天，结算时保持健康，并让现金、存款与电子余额之和高于债务。</dd></div>
      <div><dt>买卖与换站</dt><dd>到站后可在当地行情中买卖商品。换站进入下一天，价格、债务和城市事件可能变化。</dd></div>
      <div><dt>两种模式</dt><dd>经典模式沿用原作的贸易与事件规则；新北京模式加入身份、天气、电子钱包和信用。</dd></div>
      <div><dt>保存</dt><dd>每次有效操作后自动保存到当前浏览器。设置中可以导出或导入存档。</dd></div>
    </dl>
    <div className="dialog-actions"><button type="button" className="button button-primary" onClick={onClose}>关闭</button></div>
  </div></div>;
}
