// 1초마다 경과 시간을 보낸다. 화면이 숨으면 세지 않는다 (design.md §6.6)
import { useEffect, useLayoutEffect, useRef } from 'react';

export function useTimer(running: boolean, onTick: (deltaMs: number) => void) {
  const tick = useRef(onTick);
  useLayoutEffect(() => {
    tick.current = onTick;
  });

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === 'visible') tick.current(now - last);
      last = now;
    }, 1000);
    // 다른 탭·앱에 있던 시간은 세지 않는다
    const onVisibility = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running]);
}
