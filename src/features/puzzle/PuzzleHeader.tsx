import { hrefFor } from '../../app/router';
import { formatTime } from '../../domain/scoring';
import styles from './PuzzleScreen.module.css';

interface PuzzleHeaderProps {
  number: number;
  theme: string;
  stageName: string;
  elapsedMs: number;
  hintsLeft: number;
  hintDisabled: boolean;
  onHint(): void;
}

export function PuzzleHeader({ number, theme, stageName, elapsedMs, hintsLeft, hintDisabled, onHint }: PuzzleHeaderProps) {
  return (
    <header className={styles.header}>
      <a className={styles.back} href={hrefFor({ name: 'home' })} aria-label="퍼즐 목록으로">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </a>
      <h1 className={styles.heading}>
        <span className={styles.number}>{number}</span>
        <span className={styles.theme}>{theme}</span>
        <span className="visually-hidden">, {stageName}</span>
      </h1>
      <p className={styles.timer}>
        <span className="visually-hidden">걸린 시간 </span>
        <time aria-live="off">{formatTime(elapsedMs)}</time>
      </p>
      <button
        type="button"
        className={styles.hint}
        disabled={hintDisabled}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onHint}
      >
        힌트 <span className={styles.hintCount}>{hintsLeft}</span>
        <span className="visually-hidden">번 남음</span>
      </button>
    </header>
  );
}
