// 퍼즐 화면 (design.md §5.3~5.5, §6): 리듀서 상태 + 부수 효과(타이머·저장·기록)
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadPrefs, loadProgress, loadRecords, savePrefs, saveRecord } from '../../app/storage';
import { STAGES, TOTAL_PUZZLES } from '../../data/stages';
import {
  createGameReducer,
  createInitialState,
  hintsLeft,
  isEntrySolved,
  type GameAction,
  type GameState,
} from '../../domain/game';
import { computeStars, isNewBest, updateRecord } from '../../domain/scoring';
import type { Puzzle } from '../../domain/types';
import { useAutosave } from '../../hooks/useAutosave';
import { useTimer } from '../../hooks/useTimer';
import { useElementSize, useMediaQuery, useVisualViewport } from '../../hooks/useViewport';
import { OnboardingOverlay } from '../onboarding/OnboardingOverlay';
import { ClueList } from './ClueList';
import { CompletionModal, type CompletionResult } from './CompletionModal';
import { GridBoard, type Flash } from './GridBoard';
import { HintConfirmDialog } from './HintConfirmDialog';
import { InputDock } from './InputDock';
import { PuzzleHeader } from './PuzzleHeader';
import styles from './PuzzleScreen.module.css';

const MIN_CELL = 28;
const MAX_CELL = 56;

function initialState(puzzle: Puzzle, reveal: boolean, saved: ReturnType<typeof loadProgress>): GameState {
  if (reveal) {
    // 검수용: 정답을 채운 채로 보기 (개발 빌드에서만, 저장하지 않음)
    const letters = puzzle.cells.map((c) => c.solution ?? '');
    return createInitialState(puzzle, { letters, revealed: [], elapsedMs: 0, completed: true });
  }
  return createInitialState(puzzle, saved ?? undefined);
}

export function PuzzleScreen({ puzzle, reveal = false }: { puzzle: Puzzle; reveal?: boolean }) {
  const reducer = useMemo(() => createGameReducer(puzzle), [puzzle]);
  const [saved] = useState(() => (reveal ? null : loadProgress(puzzle)));
  const [state, dispatch] = useReducer(reducer, null, () => initialState(puzzle, reveal, saved));
  const [onboarding, setOnboarding] = useState(() => !reveal && !loadPrefs().onboardingDone);
  const [hintOpen, setHintOpen] = useState(false);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [flash, setFlash] = useState<Flash | undefined>();
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(state);

  useLayoutEffect(() => {
    latest.current = state;
  });

  useTimer(!state.completed && !onboarding && !reveal, (deltaMs) => dispatch({ type: 'tick', deltaMs }));
  useAutosave(puzzle, state, { enabled: !reveal, hadProgress: saved !== null });

  useEffect(() => {
    document.title = `${puzzle.number}번 ${puzzle.theme} | 가로세로 낱말 퍼즐`;
  }, [puzzle]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  /** 액션을 보내고, 순수 리듀서로 다음 상태를 미리 계산해 완료·정답 연출을 처리한다 */
  const act = useCallback(
    (action: GameAction) => {
      const prev = latest.current;
      const next = reducer(prev, action);
      if (next === prev) return;
      latest.current = next;
      dispatch(action);
      if (action.type === 'submitWord' && next.feedback?.kind === 'correct') {
        setFlash({ entryId: prev.activeEntryId, seq: next.feedback.seq });
      }
      if (!prev.completed && next.completed && !reveal) {
        const stars = computeStars({
          hintsUsed: next.revealed.length,
          elapsedMs: next.elapsedMs,
          targetTimeSec: puzzle.targetTimeSec,
        });
        const before = loadRecords()[puzzle.number];
        const result = { stars, timeMs: Math.round(next.elapsedMs) };
        saveRecord(puzzle.number, updateRecord(before, { ...result, at: new Date().toISOString() }));
        setCompletion({
          ...result,
          hintsUsed: next.revealed.length,
          targetTimeSec: puzzle.targetTimeSec,
          newBest: isNewBest(before, result),
          firstClear: !before,
        });
      }
    },
    [reducer, puzzle, reveal],
  );

  const onCellTap = useCallback(
    (index: number) => {
      act({ type: 'tapCell', index });
      focusInput();
    },
    [act, focusInput],
  );
  const onSelectEntry = useCallback(
    (entryId: string) => {
      act({ type: 'selectEntry', entryId });
      focusInput();
    },
    [act, focusInput],
  );
  const onSubmit = useCallback((text: string) => act({ type: 'submitWord', text }), [act]);
  const onMove = useCallback((delta: 1 | -1) => act({ type: 'moveEntry', delta }), [act]);
  const onSlotTap = useCallback((index: number) => act({ type: 'setActiveCell', index }), [act]);
  const onFlashEnd = useCallback(() => setFlash(undefined), []);

  // PC에서는 바로 칠 수 있게 입력창에 포커스 (휴대폰은 키보드가 저절로 열리지 않게 두지 않음)
  const finePointer = useMediaQuery('(pointer: fine)');
  useEffect(() => {
    if (finePointer && !onboarding) focusInput();
  }, [finePointer, onboarding, focusInput]);

  // 입력창 포커스 여부 (휴대폰 키보드 판단에 쓴다)
  useEffect(() => {
    // focusout 순간에는 activeElement가 아직 바뀌지 않은 브라우저가 있어 다음 태스크에서 읽는다
    const update = () =>
      window.setTimeout(() => setInputFocused(!!inputRef.current && document.activeElement === inputRef.current), 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  // ── 칸 크기 (design.md §8.1) ──
  const viewport = useVisualViewport();
  const wide = useMediaQuery('(min-width: 900px)');
  const coarse = useMediaQuery('(pointer: coarse)');
  const keyboardOpen = !wide && coarse && inputFocused && viewport.keyboardOpen;
  const [mainRef, mainSize] = useElementSize<HTMLDivElement>();
  const [boardRef, boardSize] = useElementSize<HTMLDivElement>();
  const n = puzzle.size;
  const frame = 8; // 격자 바깥 테두리
  const widthBudget = boardSize.width - frame;
  const heightBudget = wide ? boardSize.height - frame : keyboardOpen ? mainSize.height - frame - 32 : Infinity;
  const raw = Math.floor(Math.min((widthBudget - (n - 1)) / n, (heightBudget - (n - 1)) / n));
  const cellSize = raw > 0 && Number.isFinite(raw) ? Math.max(MIN_CELL, Math.min(MAX_CELL, raw)) : 40;

  const entry = puzzle.entries.find((e) => e.id === state.activeEntryId) ?? puzzle.entries[0];
  const left = hintsLeft(state);

  return (
    <div
      className={styles.screen}
      data-keyboard={keyboardOpen || undefined}
      style={
        {
          '--vvh': viewport.height ? `${viewport.height}px` : undefined,
          '--vvtop': `${viewport.top}px`,
        } as React.CSSProperties
      }
    >
      <PuzzleHeader
        number={puzzle.number}
        theme={puzzle.theme}
        stageName={`${puzzle.stage}단계 ${STAGES[puzzle.stage].name}`}
        elapsedMs={state.elapsedMs}
        hintsLeft={left}
        hintDisabled={state.completed || left === 0}
        onHint={() => setHintOpen(true)}
      />

      <div className={styles.main} ref={mainRef}>
        <section className={styles.board} ref={boardRef} aria-label="격자">
          {reveal ? <p className={styles.reveal}>검수용 정답 보기예요. 기록은 저장되지 않아요.</p> : null}
          <GridBoard
            puzzle={puzzle}
            letters={state.letters}
            revealed={state.revealed}
            activeEntryId={state.activeEntryId}
            activeCell={state.activeCell}
            cellSize={cellSize}
            flash={flash}
            onFlashEnd={onFlashEnd}
            onCellTap={onCellTap}
          />
        </section>
        <section className={styles.clues} aria-label="열쇠 목록">
          <ClueList puzzle={puzzle} letters={state.letters} activeEntryId={state.activeEntryId} onSelect={onSelectEntry} />
        </section>
      </div>

      <div className={styles.dock}>
        <InputDock
          entry={entry}
          solved={isEntrySolved(entry, state.letters)}
          completed={state.completed}
          letters={state.letters}
          revealed={state.revealed}
          activeCell={state.activeCell}
          feedback={state.feedback}
          inputRef={inputRef}
          onSubmit={onSubmit}
          onMove={onMove}
          onSlotTap={onSlotTap}
          onRestart={() => {
            setCompletion(null);
            act({ type: 'restart' });
            focusInput();
          }}
        />
      </div>

      {hintOpen ? (
        <HintConfirmDialog
          entry={entry}
          cellIndex={state.activeCell}
          cellFilled={state.letters[state.activeCell] !== ''}
          hintsLeft={left}
          onConfirm={() => {
            act({ type: 'useHint' });
            setHintOpen(false);
          }}
          onClose={() => setHintOpen(false)}
        />
      ) : null}

      {completion ? (
        <CompletionModal
          number={puzzle.number}
          theme={puzzle.theme}
          result={completion}
          hasNext={puzzle.number < TOTAL_PUZZLES}
          onClose={() => setCompletion(null)}
        />
      ) : null}

      {onboarding ? (
        <OnboardingOverlay
          onClose={() => {
            savePrefs({ onboardingDone: true });
            setOnboarding(false);
          }}
        />
      ) : null}
    </div>
  );
}
