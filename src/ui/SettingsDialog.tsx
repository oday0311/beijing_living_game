import { useRef, useState } from 'react';
import type { GameSettings } from '../persistence/schema';
import { useModalFocus } from './useModalFocus';

export function SettingsDialog({ settings, notice, onChange, onExport, onImport, onReset, onClose, canExport, canReset }: {
  settings: GameSettings;
  notice: string | null;
  onChange: (settings: GameSettings) => void;
  onExport: () => void;
  onImport: (raw: string) => boolean;
  onReset: () => void;
  onClose: () => void;
  canExport: boolean;
  canReset: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useModalFocus(ref, onClose);

  async function selectFile(file?: File) {
    if (!file) return;
    try {
      setConfirmImport(await file.text());
      setMessage(null);
    } catch {
      setMessage('无法读取所选文件。');
    }
  }

  return <div className="dialog-backdrop"><div ref={ref} className="desk-dialog auxiliary-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <h2 id="settings-title">设置</h2>
    <div className="settings-options">
      <label><span>音效</span><input type="checkbox" checked={settings.soundEnabled}
        onChange={(event) => onChange({ ...settings, soundEnabled: event.target.checked })} /></label>
      <label><span>动态效果</span><input type="checkbox" checked={settings.animationsEnabled}
        onChange={(event) => onChange({ ...settings, animationsEnabled: event.target.checked })} /></label>
      <label><span>紧凑显示</span><input type="checkbox" checked={settings.compactDisplay}
        onChange={(event) => onChange({ ...settings, compactDisplay: event.target.checked })} /></label>
    </div>
    {notice && <p className="settings-notice" role="status" aria-label="设置保存状态">{notice}</p>}
    <div className="settings-data">
      <h3>本地存档</h3>
      <div className="settings-actions"><button type="button" className="button button-outline" disabled={!canExport} onClick={onExport}>导出存档</button>
        <button type="button" className="button button-outline" onClick={() => fileRef.current?.click()}>导入存档</button>
        <input ref={fileRef} type="file" accept=".json,application/json" aria-label="选择存档文件" aria-hidden="true" tabIndex={-1} className="visually-hidden"
          onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ''; }} />
        <button type="button" className="button button-link danger-text" disabled={!canReset} onClick={() => setConfirmReset(true)}>重置本局</button></div>
      {confirmImport !== null && <div className="settings-confirm"><p>导入会替换当前存档。确认导入？</p>
        <button type="button" className="button button-quiet" onClick={() => setConfirmImport(null)}>取消</button>
        <button type="button" className="button button-danger" onClick={() => {
          if (onImport(confirmImport)) onClose();
          setConfirmImport(null);
        }}>确认导入</button></div>}
      {confirmReset && <div className="settings-confirm"><p>重置本局会清除当前进度。确认重置？</p>
        <button type="button" className="button button-quiet" onClick={() => setConfirmReset(false)}>取消</button>
        <button type="button" className="button button-danger" onClick={() => { onReset(); onClose(); }}>确认重置</button></div>}
      {message && <p role="alert">{message}</p>}
    </div>
    <div className="dialog-actions"><button type="button" className="button button-primary" onClick={onClose}>完成</button></div>
  </div></div>;
}
