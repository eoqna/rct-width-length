// 완료 창: 채점 도장 + 별점 기준을 ○✕로 보여 준다 (FR-07, US-6)
import { hrefFor } from '../../app/router';
import { Dialog } from '../../components/Dialog';
import dialog from '../../components/Dialog.module.css';
import { formatTime } from '../../domain/scoring';
import styles from './CompletionModal.module.css';

export interface CompletionResult {
  stars: 1 | 2 | 3;
  timeMs: number;
  hintsUsed: number;
  targetTimeSec: number;
  newBest: boolean;
  firstClear: boolean;
}

interface CompletionModalProps {
  number: number;
  theme: string;
  result: CompletionResult;
  hasNext: boolean;
  onClose(): void;
}

const STAMP: Record<1 | 2 | 3, string> = { 3: '참 잘했어요', 2: '잘했어요', 1: '다 풀었어요' };

export function CompletionModal({ number, theme, result, hasNext, onClose }: CompletionModalProps) {
  const noHint = result.hintsUsed === 0;
  const inTime = result.timeMs <= result.targetTimeSec * 1000;
  return (
    <Dialog title={`${number}번 ${theme} 퍼즐을 다 풀었어요`} onClose={onClose} className={styles.panel}>
      <div className={styles.stamp} aria-hidden>
        {STAMP[result.stars]}
      </div>
      <p className={styles.stars} aria-label={`별 ${result.stars}개`}>
        {'★'.repeat(result.stars)}
        <span className={styles.empty}>{'★'.repeat(3 - result.stars)}</span>
      </p>
      {result.newBest && !result.firstClear ? <p className={styles.best}>최고 기록을 새로 세웠어요</p> : null}
      <ul className={styles.rules}>
        <li>
          <span className={styles.mark} data-ok={noHint || undefined} aria-hidden>
            {noHint ? '○' : '✕'}
          </span>
          <span>힌트 없이 풀기</span>
          <span className={styles.value}>{noHint ? '힌트 0번' : `힌트 ${result.hintsUsed}번`}</span>
        </li>
        <li>
          <span className={styles.mark} data-ok={inTime || undefined} aria-hidden>
            {inTime ? '○' : '✕'}
          </span>
          <span>{formatTime(result.targetTimeSec * 1000)} 안에 풀기</span>
          <span className={styles.value}>{formatTime(result.timeMs)}</span>
        </li>
      </ul>
      <div className={dialog.actions}>
        <a className={dialog.secondary + ' ' + styles.link} href={hrefFor({ name: 'home' })}>
          목록으로
        </a>
        {hasNext ? (
          <a
            className={dialog.primary + ' ' + styles.link}
            href={hrefFor({ name: 'puzzle', number: number + 1, reveal: false })}
            data-autofocus
          >
            다음 퍼즐
          </a>
        ) : (
          <button type="button" className={dialog.primary} onClick={onClose} data-autofocus>
            닫기
          </button>
        )}
      </div>
    </Dialog>
  );
}
