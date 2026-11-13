import { describe, expect, it } from 'vitest';
import { computeStars, formatTime, isNewBest, updateRecord } from './scoring';

describe('computeStars', () => {
  const target = 180; // 초

  it('힌트 없이 목표 시간 안이면 3개', () => {
    expect(computeStars({ hintsUsed: 0, elapsedMs: 100_000, targetTimeSec: target })).toBe(3);
  });

  it('목표 시간과 같으면 시간 안으로 본다', () => {
    expect(computeStars({ hintsUsed: 0, elapsedMs: 180_000, targetTimeSec: target })).toBe(3);
  });

  it('둘 중 하나만 만족하면 2개', () => {
    expect(computeStars({ hintsUsed: 1, elapsedMs: 100_000, targetTimeSec: target })).toBe(2);
    expect(computeStars({ hintsUsed: 0, elapsedMs: 180_001, targetTimeSec: target })).toBe(2);
  });

  it('둘 다 못 하면 1개', () => {
    expect(computeStars({ hintsUsed: 3, elapsedMs: 999_000, targetTimeSec: target })).toBe(1);
  });
});

describe('updateRecord', () => {
  it('첫 완료면 그대로 기록', () => {
    expect(updateRecord(undefined, { stars: 2, timeMs: 5000, at: 'T1' })).toEqual({
      stars: 2,
      bestTimeMs: 5000,
      clearedAt: 'T1',
    });
  });

  it('별점은 최댓값, 시간은 최솟값, 처음 완료한 시각은 유지', () => {
    const prev = { stars: 2 as const, bestTimeMs: 100_000, clearedAt: 'T1' };
    expect(updateRecord(prev, { stars: 3, timeMs: 120_000, at: 'T2' })).toEqual({
      stars: 3,
      bestTimeMs: 100_000,
      clearedAt: 'T1',
    });
    expect(updateRecord(prev, { stars: 1, timeMs: 80_000, at: 'T2' })).toEqual({
      stars: 2,
      bestTimeMs: 80_000,
      clearedAt: 'T1',
    });
  });
});

describe('isNewBest', () => {
  const prev = { stars: 2 as const, bestTimeMs: 100_000, clearedAt: 'T1' };

  it('첫 완료는 최고 기록', () => {
    expect(isNewBest(undefined, { stars: 1, timeMs: 1 })).toBe(true);
  });

  it('별이 늘거나 시간이 줄면 최고 기록', () => {
    expect(isNewBest(prev, { stars: 3, timeMs: 200_000 })).toBe(true);
    expect(isNewBest(prev, { stars: 1, timeMs: 90_000 })).toBe(true);
  });

  it('둘 다 아니면 아님', () => {
    expect(isNewBest(prev, { stars: 2, timeMs: 100_000 })).toBe(false);
  });
});

describe('formatTime', () => {
  it('분:초, 한 시간 이상이면 시:분:초', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(59_999)).toBe('00:59');
    expect(formatTime(65_000)).toBe('01:05');
    expect(formatTime(3_600_000)).toBe('1:00:00');
  });
});
