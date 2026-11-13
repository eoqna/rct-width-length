// 모달 창: 바깥 누르기·Esc로 닫기, 포커스 가두기, 닫으면 원래 자리로 포커스 (NFR-07)
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** 제목을 화면에서 숨기고 스크린 리더에만 읽힌다 */
  hideTitle?: boolean;
  /** 바깥을 눌러도 닫지 않는다 */
  modal?: boolean;
  className?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ title, onClose, children, hideTitle, modal, className }: DialogProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = panel.current;
    const preferred = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>(FOCUSABLE);
    preferred?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      } else if (e.key === 'Tab' && root) {
        const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (!modal && e.target === e.currentTarget) close.current();
      }}
    >
      <div
        ref={panel}
        className={`${styles.panel} ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <h2 id={id} className={hideTitle ? 'visually-hidden' : styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
