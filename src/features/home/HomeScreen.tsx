// 퍼즐 목록 (FR-01, design.md §5.2): 단계마다 원고지 한 줄처럼 퍼즐 10개
import { useEffect, useState } from 'react';
import { hrefFor } from '../../app/router';
import { loadProgress, loadRecords, storageFailed } from '../../app/storage';
import { puzzlesOfStage } from '../../data';
import { PUZZLES_PER_STAGE, STAGE_LIST } from '../../data/stages';
import { formatTime } from '../../domain/scoring';
import type { BestRecord, Puzzle } from '../../domain/types';
import styles from './HomeScreen.module.css';

const TITLE = '가로세로 낱말 퍼즐';

type Status = 'new' | 'inProgress' | 'completed';

interface CardInfo {
  puzzle: Puzzle;
  status: Status;
  record?: BestRecord;
}

function readCards(): CardInfo[][] {
  const records = loadRecords();
  return STAGE_LIST.map((cfg) =>
    puzzlesOfStage(cfg.stage).map((puzzle) => {
      const progress = loadProgress(puzzle);
      const record = records[puzzle.number];
      // 상태 우선순위: 푸는 중 > 완료 > 안 풂 (다시 푸는 중이면 별점도 함께)
      const status: Status = progress && !progress.completed ? 'inProgress' : record ? 'completed' : 'new';
      return { puzzle, status, record };
    }),
  );
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

function PuzzleCard({ puzzle, status, record }: CardInfo) {
  const label = [
    `${puzzle.number}번 ${puzzle.theme}`,
    status === 'inProgress' ? '푸는 중' : null,
    record ? `별 ${record.stars}개, 최고 기록 ${formatTime(record.bestTimeMs)}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <li>
      <a className={styles.card} href={hrefFor({ name: 'puzzle', number: puzzle.number, reveal: false })} data-status={status} aria-label={label}>
        <span className={styles.num}>{puzzle.number}</span>
        <span className={styles.body}>
          <span className={styles.theme}>{puzzle.theme}</span>
          {status !== 'new' ? (
            <span className={styles.status}>
              {status === 'inProgress' ? <span className={styles.progress}>푸는 중</span> : null}
              {record ? (
                <>
                  <span className={styles.stars}>{stars(record.stars)}</span>
                  {status === 'completed' ? <span className={styles.time}>{formatTime(record.bestTimeMs)}</span> : null}
                </>
              ) : null}
            </span>
          ) : null}
        </span>
      </a>
    </li>
  );
}

export function HomeScreen() {
  const [cards] = useState(readCards);
  const failed = storageFailed();

  useEffect(() => {
    document.title = '가로세로 낱말 퍼즐';
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title} aria-label={TITLE}>
          {Array.from(TITLE).map((ch, i) => (
            <span key={i} className={styles.titleCell} aria-hidden>
              {ch.trim()}
            </span>
          ))}
        </h1>
        <a className={styles.settings} href={hrefFor({ name: 'settings' })} aria-label="설정">
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" />
          </svg>
        </a>
      </header>
      <p className={styles.lead}>한 칸에 한 글자. 열쇠를 읽고 빈칸을 채워 보세요.</p>

      {failed ? (
        <p className={styles.notice} role="alert">
          이 브라우저에서는 기록이 저장되지 않아요. 사생활 보호 모드라면 일반 창에서 열어 주세요.
        </p>
      ) : null}

      {STAGE_LIST.map((cfg, k) => {
        const list = cards[k];
        const earned = list.reduce((a, c) => a + (c.record?.stars ?? 0), 0);
        return (
          <section key={cfg.stage} className={styles.stage} aria-labelledby={`stage-${cfg.stage}`}>
            <div className={styles.stageHead}>
              <h2 id={`stage-${cfg.stage}`} className={styles.stageTitle}>
                {cfg.stage}단계 <span className={styles.stageName}>{cfg.name}</span>
              </h2>
              <p className={styles.stageMeta}>
                <span className={styles.size}>
                  {cfg.size}×{cfg.size}
                </span>
                <span aria-label={`별 ${earned}개 모음, 최대 ${PUZZLES_PER_STAGE * 3}개`}>
                  ★ {earned}/{PUZZLES_PER_STAGE * 3}
                </span>
              </p>
            </div>
            <ol className={styles.cards}>
              {list.map((c) => (
                <PuzzleCard key={c.puzzle.number} {...c} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
