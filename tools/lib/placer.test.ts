import { describe, expect, it } from 'vitest';
import { parsePuzzle } from '../../src/domain/parse';
import type { BankWord, PuzzleFile } from '../../src/domain/types';
import { validatePuzzle } from '../../src/domain/validate';
import { generateGrid, type Candidate } from './placer';
import { createRng } from './rng';

const THEME = ['고양이', '기러기', '고릴라', '사자', '기린', '오리', '다람쥐', '나비', '하마', '여우', '사슴', '토끼', '원숭이', '강아지', '돼지', '염소', '비둘기', '참새', '까치', '부엉이', '개미', '개구리', '물개', '거북이'];
const OTHER = ['태양', '이야기', '기차', '사과', '자두', '두부', '부자', '지도', '도시', '시계', '계단', '단추', '고구마', '마차', '차도', '도로', '우산', '수박', '박수', '수건', '나무', '구름', '미소', '소리', '리본', '바다', '다리', '리듬', '모자', '자리', '이불', '불꽃', '가방', '방울', '우유', '유리', '거울', '울타리', '하늘', '늘보'];

const candidates: Candidate[] = [
  ...THEME.map((w) => ({ word: w, isTheme: true, isNew: false })),
  ...OTHER.map((w) => ({ word: w, isTheme: false, isNew: false })),
];

const options = { size: 5, words: { min: 6, max: 8 }, attempts: 3000, maxLongWords: 0, targetNewRatio: null };

describe('generateGrid', () => {
  const result = generateGrid({ ...options, candidates, rng: createRng(7) });

  it('결과를 만든다', () => {
    expect(result).not.toBeNull();
  });

  it('N×N 격자이고, 격자의 단어가 곧 놓은 단어다', () => {
    const r = result!;
    expect(r.grid).toHaveLength(5);
    r.grid.forEach((row) => expect(Array.from(row)).toHaveLength(5));
    const puzzle = parsePuzzle({ number: 1, theme: '동물', grid: r.grid, clues: {} });
    expect(puzzle.entries.map((e) => e.answer).sort()).toEqual([...r.words].sort());
    const known = new Set(candidates.map((c) => c.word));
    expect(r.words.every((w) => known.has(w))).toBe(true);
  });

  it('격자 규칙(G01~G04)과 중복·단어 수·주제 비율 규칙을 지킨다', () => {
    const r = result!;
    const bank = new Map<string, BankWord>(
      candidates.map((c) => [
        c.word,
        { word: c.word, grade: 1, category: 'general', themes: c.isTheme ? ['동물'] : [], note: '' },
      ]),
    );
    const clues = Object.fromEntries(r.words.map((w) => [w, { type: 'definition' as const, text: '열쇠' }]));
    const file: PuzzleFile = { number: 1, theme: '동물', grid: r.grid, clues };
    expect(validatePuzzle(file, bank)).toEqual([]);
  });

  it('같은 시드는 같은 결과', () => {
    const again = generateGrid({ ...options, candidates, rng: createRng(7) });
    expect(again?.grid).toEqual(result?.grid);
  });

  it('연속 2음절이 겹치는 단어는 한 퍼즐에 함께 놓지 않는다 (종이·색종이·종이학)', () => {
    // 주제 단어가 서로 많이 겹치게 만든다: 규칙이 없으면 겹치는 쌍이 거의 늘 들어간다
    const school = ['종이', '색종이', '종이학', '종이배', '연필', '색연필', '필통', '학교', '교실', '실내화', '학생', '생일', '일기', '일기장'];
    const overlapping: Candidate[] = [
      ...[...OTHER, ...THEME].map((w) => ({ word: w, isTheme: false, isNew: false })),
      ...school.map((w) => ({ word: w, isTheme: true, isNew: false })),
    ];
    const results = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((seed) => generateGrid({ ...options, candidates: overlapping, rng: createRng(seed) }))
      .filter((r) => r !== null);
    expect(results.length).toBeGreaterThanOrEqual(6);
    for (const r of results) {
      const bigrams = r.words.map((w) => {
        const s = Array.from(w);
        return new Set(s.slice(1).map((ch, i) => s[i] + ch));
      });
      for (let i = 0; i < bigrams.length; i++) {
        for (let j = i + 1; j < bigrams.length; j++) {
          const shared = [...bigrams[i]].filter((b) => bigrams[j].has(b));
          expect(shared, `${r.words[i]} / ${r.words[j]}`).toEqual([]);
        }
      }
    }
  });

  it('다른 퍼즐에서 이미 쓴 단어는 되도록 피한다', () => {
    const reusedSet = new Set(OTHER.slice(0, 25));
    const flagged: Candidate[] = candidates.map((c) => ({ ...c, isReused: reusedSet.has(c.word) }));
    const count = (cands: Candidate[]) =>
      [1, 2, 3, 4, 5, 6, 7, 8]
        .map((seed) => generateGrid({ ...options, candidates: cands, rng: createRng(seed) }))
        .reduce((n, r) => n + (r?.words.filter((w) => reusedSet.has(w)).length ?? 0), 0);
    expect(count(flagged)).toBeLessThan(count(candidates) / 2);
  });

  it('새 등급 단어 비율은 목표의 ±10%p 안', () => {
    // 새 등급 단어가 적은 후보에서 목표 40%를 맞춰야 한다 (제약이 없으면 1/7 안팎으로 나온다)
    const fresh = new Set([...THEME.slice(-4), ...OTHER.slice(-10)]);
    const graded: Candidate[] = candidates.map((c) => ({ ...c, isNew: fresh.has(c.word) }));
    const results = [1, 2, 3, 4, 5, 6]
      .map((seed) => generateGrid({ ...options, targetNewRatio: 0.4, candidates: graded, rng: createRng(seed) }))
      .filter((r) => r !== null);
    expect(results.length).toBeGreaterThanOrEqual(4);
    for (const r of results) {
      const ratio = r.words.filter((w) => fresh.has(w)).length / r.words.length;
      expect(Math.abs(ratio - 0.4)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('같은 뜻 묶음의 단어는 한 퍼즐에 하나만 놓는다', () => {
    // 사자·호랑이·기린·하마를 한 묶음으로: 둘 이상 함께 나오면 안 된다
    const group = new Set(['사자', '호랑이', '기린', '하마', '오리', '여우']);
    const grouped: Candidate[] = [
      ...candidates,
      { word: '호랑이', isTheme: true, isNew: false },
    ].map((c) => (group.has(c.word) ? { ...c, conflicts: ['동물묶음'] } : c));
    let total = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = generateGrid({ ...options, candidates: grouped, rng: createRng(seed) });
      const n = r?.words.filter((w) => group.has(w)).length ?? 0;
      expect(n).toBeLessThanOrEqual(1);
      total += r ? 1 : 0;
    }
    expect(total).toBeGreaterThanOrEqual(6);
  });

  it('조건을 만족할 수 없으면 null', () => {
    const few = candidates.filter((c) => ['고양이', '이야기', '기차'].includes(c.word));
    expect(generateGrid({ ...options, candidates: few, rng: createRng(1), attempts: 50 })).toBeNull();
  });
});
