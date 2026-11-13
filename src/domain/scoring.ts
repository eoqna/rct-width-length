// 별점과 기록 (requirements.md §3.6, design.md §6.6)
import type { BestRecord } from './types';

export interface StarInput {
  hintsUsed: number;
  elapsedMs: number;
  targetTimeSec: number;
}

/** 별점 = 1 + (힌트 0회 ? 1 : 0) + (걸린 시간 ≤ 목표 시간 ? 1 : 0) */
export function computeStars({ hintsUsed, elapsedMs, targetTimeSec }: StarInput): 1 | 2 | 3 {
  const noHint = hintsUsed === 0 ? 1 : 0;
  const inTime = elapsedMs <= targetTimeSec * 1000 ? 1 : 0;
  return (1 + noHint + inTime) as 1 | 2 | 3;
}

export interface ClearResult {
  stars: 1 | 2 | 3;
  timeMs: number;
}

/** 별점은 최댓값, 시간은 최솟값으로 따로 갱신. 처음 완료한 시각은 유지 */
export function updateRecord(
  prev: BestRecord | undefined,
  result: ClearResult & { at: string },
): BestRecord {
  if (!prev) return { stars: result.stars, bestTimeMs: result.timeMs, clearedAt: result.at };
  return {
    stars: Math.max(prev.stars, result.stars) as 1 | 2 | 3,
    bestTimeMs: Math.min(prev.bestTimeMs, result.timeMs),
    clearedAt: prev.clearedAt,
  };
}

export function isNewBest(prev: BestRecord | undefined, result: ClearResult): boolean {
  if (!prev) return true;
  return result.stars > prev.stars || result.timeMs < prev.bestTimeMs;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 00:00 · 한 시간 이상이면 1:00:00 */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
