// 진행 자동 저장 (design.md §6.8, FR-08)
// - 칸·힌트·완료가 바뀌면 바로
// - 시간은 5초마다, 그리고 pagehide·화면 숨김·화면 이탈 때
// - 아무것도 안 하고 잠깐 본 퍼즐은 저장하지 않는다 (목록에 '푸는 중'으로 남지 않게)
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { saveProgress } from '../app/storage';
import { toProgress, type GameState } from '../domain/game';
import type { Puzzle } from '../domain/types';

const MIN_IDLE_SAVE_MS = 10_000;

export function useAutosave(puzzle: Puzzle, state: GameState, options: { enabled: boolean; hadProgress: boolean }) {
  const latest = useRef(state);
  const stored = useRef(options.hadProgress);
  const { enabled } = options;

  useLayoutEffect(() => {
    latest.current = state;
  });

  const save = useCallback(() => {
    if (!enabled) return;
    const s = latest.current;
    const pristine = !s.completed && s.revealed.length === 0 && s.letters.every((l) => l === '');
    if (!stored.current && pristine && s.elapsedMs < MIN_IDLE_SAVE_MS) return;
    saveProgress(puzzle, toProgress(puzzle, s));
    stored.current = true;
  }, [puzzle, enabled]);

  useEffect(() => {
    save();
  }, [state.letters, state.revealed, state.completed, save]);

  useEffect(() => {
    const id = window.setInterval(save, 5000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
      save();
    };
  }, [save]);
}
