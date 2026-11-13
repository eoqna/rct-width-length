// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGameReducer, createInitialState, toProgress } from '../domain/game';
import { parsePuzzle } from '../domain/parse';
import { clearAll, loadPrefs, loadProgress, loadRecords, PREFIX, savePrefs, saveProgress, saveRecord } from './storage';

const puzzle = parsePuzzle({
  number: 2,
  theme: '동물',
  grid: ['#태###', '고양이##', '릴#야##', '라#기러기', '####차'],
  clues: {},
});

beforeEach(() => {
  clearAll();
  localStorage.clear();
});

describe('진행 저장', () => {
  it('저장한 진행을 다시 읽는다', () => {
    const state = createGameReducer(puzzle)(createInitialState(puzzle), { type: 'useHint' });
    saveProgress(puzzle, toProgress(puzzle, state));
    expect(loadProgress(puzzle)?.revealed).toEqual([5]);
  });

  it('손상된 JSON은 그 키만 지우고 새로 시작', () => {
    localStorage.setItem(`${PREFIX}progress:2`, '{망가짐');
    localStorage.setItem(`${PREFIX}prefs`, JSON.stringify({ onboardingDone: true }));
    expect(loadProgress(puzzle)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}progress:2`)).toBeNull();
    expect(loadPrefs().onboardingDone).toBe(true);
  });

  it('퍼즐 지문이 다르면 버린다', () => {
    const progress = toProgress(puzzle, createInitialState(puzzle));
    localStorage.setItem(`${PREFIX}progress:2`, JSON.stringify({ ...progress, fingerprint: '00000000' }));
    expect(loadProgress(puzzle)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}progress:2`)).toBeNull();
  });
});

describe('기록', () => {
  it('퍼즐별로 저장하고 형식이 틀린 항목은 버린다', () => {
    saveRecord(3, { stars: 2, bestTimeMs: 1000, clearedAt: 'T' });
    localStorage.setItem(
      `${PREFIX}records`,
      JSON.stringify({ ...JSON.parse(localStorage.getItem(`${PREFIX}records`)!), 4: { stars: 9 } }),
    );
    expect(loadRecords()).toEqual({ 3: { stars: 2, bestTimeMs: 1000, clearedAt: 'T' } });
  });
});

describe('clearAll', () => {
  it('wl:v1: 키만 모두 지운다', () => {
    savePrefs({ onboardingDone: true });
    saveRecord(1, { stars: 3, bestTimeMs: 1, clearedAt: 'T' });
    localStorage.setItem('other-app', 'keep');
    clearAll();
    expect(loadPrefs().onboardingDone).toBe(false);
    expect(loadRecords()).toEqual({});
    expect(localStorage.getItem('other-app')).toBe('keep');
  });
});
