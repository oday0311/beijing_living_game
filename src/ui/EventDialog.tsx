import { useRef } from 'react';
import type { RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
import type { GameEvent, Mode } from '../engine/types';
import { eventCopy } from './eventCopy';
import { useModalFocus } from './useModalFocus';

export function eventArtPath(mode: Mode, artId: string, kind: GameEvent['kind']): string {
  const prefix = artId.split('/')[0];
  const category = ['market', 'health', 'money', 'weather', 'identity', 'system'].includes(prefix) ? prefix : kind;
  if (mode === 'classic') {
    const suffix = category === 'market' || category === 'health' || category === 'money' ? category : 'system';
    return `/assets/events/classic-${suffix}.webp`;
  }
  const suffix = category === 'market' ? 'market' : category === 'health' || category === 'weather' ? 'weather'
    : category === 'money' ? 'credit' : category === 'identity' ? 'identity' : 'credit';
  return `/assets/events/modern-${suffix}.webp`;
}

export function EventDialog({ event, mode, onAcknowledge, fallbackFocus }: {
  event: GameEvent; mode: Mode; onAcknowledge: () => void; fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, () => {}, fallbackFocus);
  const { title, body } = eventCopy(event);
  return <div className="dialog-backdrop"><div ref={ref} className="desk-dialog event-dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title">
    <img className="event-art" src={eventArtPath(mode, event.artId, event.kind)} alt={`${title}插画`} width="1200" height="800" />
    <p className="eyebrow">城市快讯</p><h2 id="event-dialog-title">{title}</h2><p>{body}</p>
    <div className="dialog-actions"><button type="button" className="button button-primary" onClick={onAcknowledge}>知道了 <ArrowRight size={17} aria-hidden="true" /></button></div>
  </div></div>;
}
