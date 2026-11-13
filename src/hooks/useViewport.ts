// 화면 크기와 휴대폰 키보드 (design.md §8.2)
// - visualViewport 높이·위치를 따라가 키보드 위에 입력 영역을 둔다 (iOS Safari는 레이아웃이 줄지 않음)
// - 같은 폭에서 본 최대 높이보다 150px 넘게 줄면 키보드가 열린 것으로 본다
import { useCallback, useState, useSyncExternalStore } from 'react';

export interface ViewportSnapshot {
  height: number;
  top: number;
  keyboardOpen: boolean;
}

const KEYBOARD_THRESHOLD = 150;
let snapshot: ViewportSnapshot = { height: 0, top: 0, keyboardOpen: false };
let maxHeight = 0;
let lastWidth = 0;

function readViewport(): ViewportSnapshot {
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  const top = Math.max(0, Math.round(vv?.offsetTop ?? 0));
  if (width !== lastWidth) {
    lastWidth = width;
    maxHeight = 0;
  }
  maxHeight = Math.max(maxHeight, height, Math.round(window.innerHeight));
  const keyboardOpen = maxHeight - height > KEYBOARD_THRESHOLD;
  if (height !== snapshot.height || top !== snapshot.top || keyboardOpen !== snapshot.keyboardOpen) {
    snapshot = { height, top, keyboardOpen };
  }
  return snapshot;
}

function subscribe(onChange: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener('resize', onChange);
  vv?.addEventListener('scroll', onChange);
  window.addEventListener('resize', onChange);
  return () => {
    vv?.removeEventListener('resize', onChange);
    vv?.removeEventListener('scroll', onChange);
    window.removeEventListener('resize', onChange);
  };
}

export function useVisualViewport(): ViewportSnapshot {
  return useSyncExternalStore(subscribe, readViewport, () => snapshot);
}

export function useMediaQuery(query: string): boolean {
  const subscribeQuery = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribeQuery,
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}

export interface ElementSize {
  width: number;
  height: number;
}

/** 콜백 ref로 요소 크기를 잰다 (ResizeObserver) */
export function useElementSize<T extends HTMLElement>(): [(el: T | null) => void, ElementSize] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const measure = () => {
      // 안쪽 여백을 뺀 내용 영역 크기
      const cs = getComputedStyle(el);
      const px = (v: string) => parseFloat(v) || 0;
      const width = Math.round(el.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight));
      const height = Math.round(el.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom));
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}
