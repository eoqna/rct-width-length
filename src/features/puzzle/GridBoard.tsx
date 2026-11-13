// 격자 (design.md §5.5·§8): 원고지 칸, 선택한 단어는 형광펜, 힌트 칸은 파란 펜 표시, 맞힌 단어는 빨간 펜 동그라미
import { memo, useEffect, useMemo, useRef } from 'react';
import type { Puzzle } from '../../domain/types';
import styles from './GridBoard.module.css';

export interface Flash {
  entryId: string;
  seq: number;
}

interface GridBoardProps {
  puzzle: Puzzle;
  letters: readonly string[];
  revealed: readonly number[];
  activeEntryId: string;
  activeCell: number;
  cellSize: number;
  flash?: Flash;
  onFlashEnd?(): void;
  onCellTap(index: number): void;
}

const GAP = 1;

export const GridBoard = memo(function GridBoard({
  puzzle,
  letters,
  revealed,
  activeEntryId,
  activeCell,
  cellSize,
  flash,
  onFlashEnd,
  onCellTap,
}: GridBoardProps) {
  const n = puzzle.size;
  const activeEntry = puzzle.entries.find((e) => e.id === activeEntryId);
  const inWord = useMemo(() => new Set(activeEntry?.cells ?? []), [activeEntry]);
  const revealedSet = useMemo(() => new Set(revealed), [revealed]);
  const activeRef = useRef<HTMLButtonElement>(null);

  // 키보드가 열려 격자가 스크롤될 때 활성 칸을 화면 안에 둔다
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeCell, cellSize]);

  const labelFor = (index: number) => {
    const cell = puzzle.cells[index];
    const parts: string[] = [];
    if (cell.number) parts.push(`${cell.number}번`);
    parts.push(`${cell.row + 1}행 ${cell.col + 1}열`);
    parts.push(letters[index] ? `${letters[index]}${revealedSet.has(index) ? ' (힌트)' : ''}` : '빈칸');
    return parts.join(', ');
  };

  const flashEntry = flash ? puzzle.entries.find((e) => e.id === flash.entryId) : undefined;

  return (
    <div
      className={styles.frame}
      style={{ '--cell': `${cellSize}px`, '--n': n } as React.CSSProperties}
      aria-label={`${n}×${n} 낱말 격자`}
      role="group"
    >
      <div className={styles.grid}>
        {puzzle.cells.map((cell) => {
          if (cell.solution === null) return <div key={cell.index} className={styles.block} aria-hidden />;
          const active = cell.index === activeCell;
          return (
            <button
              key={cell.index}
              ref={active ? activeRef : undefined}
              type="button"
              tabIndex={-1}
              className={styles.cell}
              data-word={inWord.has(cell.index) || undefined}
              data-active={active || undefined}
              data-revealed={revealedSet.has(cell.index) || undefined}
              aria-label={labelFor(cell.index)}
              aria-current={active ? 'true' : undefined}
              // 칸을 눌러도 입력창 포커스(휴대폰 키보드)를 유지한다
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onCellTap(cell.index)}
            >
              {cell.number ? <span className={styles.num}>{cell.number}</span> : null}
              <span className={styles.letter}>{letters[cell.index]}</span>
            </button>
          );
        })}
      </div>
      {flashEntry && flash ? (
        <svg
          key={flash.seq}
          className={styles.flash}
          aria-hidden
          style={(() => {
            const rows = flashEntry.cells.map((i) => Math.floor(i / n));
            const cols = flashEntry.cells.map((i) => i % n);
            const step = cellSize + GAP;
            const x = Math.min(...cols) * step;
            const y = Math.min(...rows) * step;
            const w = (Math.max(...cols) - Math.min(...cols) + 1) * step;
            const h = (Math.max(...rows) - Math.min(...rows) + 1) * step;
            return { left: x - 8, top: y - 8, width: w + 16, height: h + 16 };
          })()}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onAnimationEnd={(e) => {
            if (e.animationName.includes('fade')) onFlashEnd?.();
          }}
        >
          <ellipse cx="50" cy="50" rx="47" ry="45" pathLength={1} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
    </div>
  );
});
