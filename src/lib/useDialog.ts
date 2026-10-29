import { useEffect, type RefObject } from 'react';

export function useDialog(ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const element = ref.current;
    const focusable = () => [...(element?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
    (element?.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0] ?? element)?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); element?.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected && getComputedStyle(previous).visibility !== 'hidden') previous.focus();
      else document.querySelector<HTMLElement>('[aria-label="Open navigation"]')?.focus();
    };
  }, [ref, close]);
}
