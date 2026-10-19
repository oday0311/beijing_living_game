import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

function focusIfAvailable(element: HTMLElement | null, allowProgrammatic = false): boolean {
  if (!element?.isConnected || element.closest('[inert]') || element.getAttribute('aria-disabled') === 'true') return false;
  if ('disabled' in element && element.disabled) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  if (element.tabIndex < 0 && !allowProgrammatic) return false;
  element.focus();
  return document.activeElement === element;
}

export function useModalFocus(dialogRef: RefObject<HTMLElement | null>, onClose: () => void,
  fallbackFocus?: RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallback = fallbackFocus?.current ?? document.querySelector<HTMLElement>('main h1');
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), select:not(:disabled), [tabindex="0"]',
    ) ?? [])];
    focusable()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (!focusIfAvailable(previous)) {
        focusIfAvailable(fallback, true);
      }
    };
  }, [dialogRef, fallbackFocus]);
}
