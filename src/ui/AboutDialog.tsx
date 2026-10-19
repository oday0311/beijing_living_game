import { useRef } from 'react';
import { useModalFocus } from './useModalFocus';

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose);
  return <div className="dialog-backdrop"><div ref={ref} className="desk-dialog auxiliary-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
    <h2 id="about-title">关于北京浮生记</h2>
    <p>原作由郭祥昊于 2000 至 2001 年创作。本网页改编于 2026 年完成。</p>
    <p>本作品依据 <a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html" target="_blank" rel="noopener noreferrer">GNU General Public License v2</a> 发布，不提供任何担保。</p>
    <p>事件插画由本项目本地程序生成；界面图标采用 Lucide，依其 ISC 与 MIT 许可使用。<a href="/licenses/lucide-license.txt" target="_blank" rel="noopener noreferrer">查看图标许可</a></p>
    <div className="dialog-actions"><button type="button" className="button button-primary" onClick={onClose}>关闭</button></div>
  </div></div>;
}
