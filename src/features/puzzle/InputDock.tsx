// 화면 아래 입력 영역 (design.md §5.5): 현재 열쇠 · 칸 상태 · 입력창
import type { RefObject } from 'react';
import type { Feedback } from '../../domain/game';
import type { Entry } from '../../domain/types';
import { AnswerInput } from './AnswerInput';
import styles from './InputDock.module.css';

interface InputDockProps {
  entry: Entry;
  solved: boolean;
  completed: boolean;
  letters: readonly string[];
  revealed: readonly number[];
  activeCell: number;
  feedback?: Feedback;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit(text: string): void;
  onMove(delta: 1 | -1): void;
  onSlotTap(cellIndex: number): void;
  onRestart(): void;
}

const keep = (e: React.PointerEvent) => e.preventDefault();

export function InputDock({
  entry,
  solved,
  completed,
  letters,
  revealed,
  activeCell,
  feedback,
  inputRef,
  onSubmit,
  onMove,
  onSlotTap,
  onRestart,
}: InputDockProps) {
  const label = `${entry.direction === 'across' ? '가로' : '세로'} ${entry.number}`;
  return (
    <div className={styles.dock}>
      <div className={styles.clueBar}>
        <button type="button" className={styles.nav} aria-label="이전 단어" onPointerDown={keep} onClick={() => onMove(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <p className={styles.clue} aria-live="polite">
          <span className={styles.tag}>{label}</span>
          <span>{entry.clue || '열쇠가 아직 없어요'}</span>
        </p>
        <button type="button" className={styles.nav} aria-label="다음 단어" onPointerDown={keep} onClick={() => onMove(1)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className={styles.pattern}>
        <ol className={styles.slots} aria-label={`${label} 칸 (${entry.cells.length}글자)`}>
          {entry.cells.map((cellIndex, k) => (
            <li key={cellIndex}>
              <button
                type="button"
                className={styles.slot}
                data-active={cellIndex === activeCell || undefined}
                data-revealed={revealed.includes(cellIndex) || undefined}
                aria-label={`${k + 1}번째 칸${letters[cellIndex] ? `, ${letters[cellIndex]}` : ', 빈칸'}`}
                onPointerDown={keep}
                onClick={() => onSlotTap(cellIndex)}
              >
                {letters[cellIndex]}
              </button>
            </li>
          ))}
        </ol>
        <span className={styles.count}>{entry.cells.length}글자</span>
      </div>

      {completed ? (
        <div className={styles.done}>
          <p>모든 칸을 채웠어요.</p>
          <button type="button" className={styles.restart} onClick={onRestart}>
            다시 풀기
          </button>
        </div>
      ) : solved ? (
        <p className={styles.solved} role="status">
          맞힌 단어예요
        </p>
      ) : (
        <AnswerInput
          length={entry.cells.length}
          resetKey={entry.id}
          feedback={feedback}
          inputRef={inputRef}
          onSubmit={onSubmit}
          onMove={onMove}
        />
      )}
    </div>
  );
}
