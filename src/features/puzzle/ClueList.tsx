// 가로·세로 열쇠 목록 (FR-02): 누르면 그 단어 선택, 맞힌 단어는 답과 함께 표시
import { memo } from 'react';
import { isEntrySolved } from '../../domain/game';
import type { Direction, Puzzle } from '../../domain/types';
import styles from './ClueList.module.css';

interface ClueListProps {
  puzzle: Puzzle;
  letters: readonly string[];
  activeEntryId: string;
  onSelect(entryId: string): void;
}

const TITLE: Record<Direction, string> = { across: '가로 열쇠', down: '세로 열쇠' };

export const ClueList = memo(function ClueList({ puzzle, letters, activeEntryId, onSelect }: ClueListProps) {
  return (
    <div className={styles.lists}>
      {(['across', 'down'] as const).map((direction) => (
        <section key={direction} className={styles.section} aria-label={TITLE[direction]}>
          <h2 className={styles.title}>{TITLE[direction]}</h2>
          <ol className={styles.list}>
            {puzzle.entries
              .filter((e) => e.direction === direction)
              .map((e) => {
                const solved = isEntrySolved(e, letters);
                const active = e.id === activeEntryId;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={styles.item}
                      data-active={active || undefined}
                      data-solved={solved || undefined}
                      aria-current={active ? 'true' : undefined}
                      onPointerDown={(ev) => ev.preventDefault()}
                      onClick={() => onSelect(e.id)}
                    >
                      <span className={styles.num}>{e.number}</span>
                      <span className={styles.text}>
                        {e.clue}
                        {solved ? (
                          <span className={styles.answer}>
                            <span className="visually-hidden">맞힌 단어 </span>
                            {e.answer}
                          </span>
                        ) : (
                          <span className={styles.length}>{e.cells.length}글자</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </div>
  );
});
