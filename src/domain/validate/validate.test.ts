import { describe, expect, it } from 'vitest';
import type { BankWord, PuzzleFile } from '../types';
import {
  checkStageClueRatio,
  checkStageNewGrade,
  hasErrors,
  parseBankCsv,
  validateBank,
  validateCollection,
  validatePuzzle,
  type Issue,
} from './index';

// ── 고정 데이터 ──

const example: PuzzleFile = {
  number: 2,
  theme: '동물',
  grid: ['#태###', '고양이##', '릴#야##', '라#기러기', '####차'],
  clues: {
    고양이: { type: 'definition', text: '야옹 하고 울며 쥐를 잘 잡는 동물' },
    기러기: { type: 'definition', text: '가을에 줄지어 날아오는 철새' },
    태양: { type: 'definition', text: '낮 하늘에서 빛과 열을 내리쬐는 별' },
    고릴라: { type: 'definition', text: '몸집이 크고 가슴을 쿵쿵 두드리는 동물' },
    이야기: { type: 'definition', text: "할머니가 '옛날 옛적에' 하며 들려주는 것" },
    기차: { type: 'definition', text: '철길 위를 달리는 긴 탈것' },
  },
};

const word = (w: string, grade = 1, themes: string[] = [], category: BankWord['category'] = 'general'): BankWord => ({
  word: w,
  grade,
  category,
  themes,
  note: '',
});

const baseBank: BankWord[] = [
  word('고양이', 1, ['동물']),
  word('기러기', 1, ['동물']),
  word('고릴라', 1, ['동물']),
  word('태양', 1, ['날씨']),
  word('이야기', 1),
  word('기차', 1, ['탈것']),
];

const bankMap = (words: BankWord[]) => new Map(words.map((w) => [w.word, w]));
const codes = (issues: Issue[]) => issues.map((i) => i.code);
const errorCodes = (issues: Issue[]) => issues.filter((i) => i.level === 'error').map((i) => i.code);

/** 격자 오른쪽·아래에 검은 칸을 붙여 n×n으로 */
const pad = (grid: string[], n: number) => {
  const rows = grid.map((r) => r + '#'.repeat(n - Array.from(r).length));
  while (rows.length < n) rows.push('#'.repeat(n));
  return rows;
};

// ── 단일 퍼즐 ──

describe('validatePuzzle', () => {
  it('설계 예시 퍼즐은 문제가 없다', () => {
    expect(validatePuzzle(example, bankMap(baseBank))).toEqual([]);
  });

  it('F01 파일 형식', () => {
    expect(codes(validatePuzzle(null, bankMap(baseBank)))).toEqual(['F01']);
    expect(codes(validatePuzzle({ ...example, number: 51 }, bankMap(baseBank)))).toContain('F01');
    expect(codes(validatePuzzle({ ...example, theme: '' }, bankMap(baseBank)))).toContain('F01');
    expect(
      codes(validatePuzzle({ ...example, clues: { 기차: { type: 'x', text: 'a' } } }, bankMap(baseBank))),
    ).toContain('F01');
  });

  it('G01 크기가 단계와 다르거나 잘못된 글자', () => {
    expect(codes(validatePuzzle({ ...example, number: 12 }, bankMap(baseBank)))).toEqual(['G01']);
    const bad = [...example.grid];
    bad[4] = '####a';
    expect(codes(validatePuzzle({ ...example, grid: bad }, bankMap(baseBank)))).toEqual(['G01']);
    expect(codes(validatePuzzle({ ...example, grid: ['가나', '다'] }, bankMap(baseBank)))).toEqual(['G01']);
  });

  it('G02 어느 단어에도 속하지 않는 외딴 칸', () => {
    const grid = [...example.grid];
    grid[0] = '#태##가';
    expect(codes(validatePuzzle({ ...example, grid }, bankMap(baseBank)))).toContain('G02');
  });

  it('G03 흰 칸이 둘 이상으로 나뉨', () => {
    const grid = ['기차###', '#####', '###태양', '#####', '#####'];
    const clues = { 기차: example.clues.기차, 태양: example.clues.태양 };
    expect(codes(validatePuzzle({ ...example, grid, clues }, bankMap(baseBank)))).toContain('G03');
  });

  it('G04 쓰지 않은 줄이 있으면 경고', () => {
    const grid = ['#태###', '고양이##', '릴#야##', '라#기러기', '#####'];
    const { 기차: _omit, ...clues } = example.clues;
    void _omit;
    const issues = validatePuzzle({ ...example, grid, clues }, bankMap(baseBank));
    expect(issues.find((i) => i.code === 'G04')?.level).toBe('warning');
  });

  it('W01 단어 은행에 없는 단어', () => {
    const bank = baseBank.filter((w) => w.word !== '기차');
    expect(codes(validatePuzzle(example, bankMap(bank)))).toContain('W01');
  });

  it('W02 퍼즐 안 중복 단어', () => {
    const grid = ['기차#기차', '#####', '#####', '#####', '#####'];
    expect(codes(validatePuzzle({ ...example, grid, clues: { 기차: example.clues.기차 } }, bankMap(baseBank)))).toContain(
      'W02',
    );
  });

  it('W04 등급이 단계보다 높거나 범주가 아직 나올 단계가 아님', () => {
    const hard = baseBank.map((w) => (w.word === '고릴라' ? { ...w, grade: 2 } : w));
    expect(codes(validatePuzzle(example, bankMap(hard)))).toContain('W04');
    const proper = baseBank.map((w) => (w.word === '기차' ? { ...w, category: 'proper' as const } : w));
    expect(codes(validatePuzzle(example, bankMap(proper)))).toContain('W04');
  });

  it('W05 단어 수가 단계 범위 밖', () => {
    const grid = ['#태###', '고양이##', '릴#야##', '라#기러기', '#####'];
    const { 기차: _omit, ...clues } = example.clues;
    void _omit;
    expect(codes(validatePuzzle({ ...example, grid, clues }, bankMap(baseBank)))).toContain('W05');
  });

  it('W06 2단계부터 새 등급 단어가 1개 이상, 50% 이하', () => {
    const stage2 = { ...example, number: 12, grid: pad(example.grid, 6) };
    expect(errorCodes(validatePuzzle(stage2, bankMap(baseBank)))).toContain('W06');

    const twoNew = baseBank.map((w) => (['태양', '기차'].includes(w.word) ? { ...w, grade: 2 } : w));
    expect(codes(validatePuzzle(stage2, bankMap(twoNew)))).not.toContain('W06');

    const fourNew = baseBank.map((w) => (w.word !== '고양이' && w.word !== '기러기' ? { ...w, grade: 2 } : w));
    expect(codes(validatePuzzle(stage2, bankMap(fourNew)))).toContain('W06');
  });

  it('W07 주제 단어 비율 40~60%', () => {
    expect(codes(validatePuzzle({ ...example, theme: '탈것' }, bankMap(baseBank)))).toContain('W07');
  });

  it('W08 5음절 이상은 4단계부터, 퍼즐당 2개 이하', () => {
    const grid = ['아이스크림', '#####', '#####', '#####', '#####'];
    const clues = { 아이스크림: { type: 'definition' as const, text: '차갑고 달콤한 간식' } };
    const bank = [...baseBank, word('아이스크림', 1, [], 'loan')];
    expect(codes(validatePuzzle({ ...example, grid, clues }, bankMap(bank)))).toContain('W08');
  });

  it('C01 열쇠가 없거나 격자에 없는 열쇠', () => {
    const { 기차: _omit, ...missing } = example.clues;
    void _omit;
    expect(codes(validatePuzzle({ ...example, clues: missing }, bankMap(baseBank)))).toContain('C01');
    const extra = { ...example.clues, 사과: { type: 'definition' as const, text: '빨간 과일' } };
    expect(codes(validatePuzzle({ ...example, clues: extra }, bankMap(baseBank)))).toContain('C01');
  });

  it('C02 열쇠에 정답의 연속 2음절 (공백 무시)', () => {
    const leak = (text: string) => ({ ...example.clues, 고양이: { type: 'definition' as const, text } });
    expect(codes(validatePuzzle({ ...example, clues: leak('고양 하고 우는 동물') }, bankMap(baseBank)))).toContain('C02');
    expect(codes(validatePuzzle({ ...example, clues: leak('새끼 양 이 녀석') }, bankMap(baseBank)))).toContain('C02');
    expect(codes(validatePuzzle({ ...example, clues: leak('고 하고 이 하는 동물') }, bankMap(baseBank)))).not.toContain(
      'C02',
    );
  });

  it('C03 열쇠는 1~40자', () => {
    const set = (text: string) => ({ ...example.clues, 기차: { type: 'definition' as const, text } });
    expect(codes(validatePuzzle({ ...example, clues: set('  ') }, bankMap(baseBank)))).toContain('C03');
    expect(codes(validatePuzzle({ ...example, clues: set('가'.repeat(41)) }, bankMap(baseBank)))).toContain('C03');
    expect(codes(validatePuzzle({ ...example, clues: set('가'.repeat(40)) }, bankMap(baseBank)))).not.toContain('C03');
  });

  it('C04 단계에서 허용하지 않은 열쇠 유형', () => {
    const clues = { ...example.clues, 기차: { type: 'association' as const, text: '칙칙폭폭' } };
    expect(codes(validatePuzzle({ ...example, clues }, bankMap(baseBank)))).toContain('C04');
  });
});

// ── 단계 단위 규칙 ──

describe('checkStageNewGrade', () => {
  it('단계 평균 25~40%이고 앞 5개 평균 ≤ 뒤 5개 평균이면 통과', () => {
    expect(checkStageNewGrade(2, [0.25, 0.25, 0.3, 0.3, 0.3, 0.3, 0.35, 0.35, 0.4, 0.4])).toEqual([]);
  });

  it('평균이 범위 밖이면 오류', () => {
    expect(codes(checkStageNewGrade(2, Array(10).fill(0.1)))).toEqual(['W06']);
  });

  it('앞쪽이 더 어려우면 오류', () => {
    expect(codes(checkStageNewGrade(2, [0.4, 0.4, 0.4, 0.4, 0.4, 0.25, 0.25, 0.25, 0.25, 0.25]))).toEqual(['W06']);
  });
});

describe('checkStageClueRatio', () => {
  it('뜻풀이 비율이 기준 ±10%p 안이면 통과', () => {
    expect(checkStageClueRatio(3, 55, 100)).toEqual([]);
    expect(checkStageClueRatio(3, 70, 100)).toEqual([]);
  });

  it('밖이면 C05 오류', () => {
    expect(codes(checkStageClueRatio(3, 80, 100))).toEqual(['C05']);
    expect(codes(checkStageClueRatio(5, 10, 100))).toEqual(['C05']);
  });
});

// ── 단어 은행 ──

describe('parseBankCsv / validateBank', () => {
  it('CSV를 읽는다 (주제는 | 로 구분)', () => {
    const { words, issues } = parseBankCsv('word,grade,category,themes,note\n무지개,2,general,날씨|색깔,\n');
    expect(issues).toEqual([]);
    expect(words).toEqual([{ word: '무지개', grade: 2, category: 'general', themes: ['날씨', '색깔'], note: '', line: 2 }]);
  });

  it('따옴표로 감싼 칸과 빈 줄을 처리한다', () => {
    const { words } = parseBankCsv('word,grade,category,themes,note\n\n사과,1,general,과일,"빨갛고, 둥글다"\n');
    expect(words[0].note).toBe('빨갛고, 둥글다');
  });

  it('열 수가 틀리거나 머리글이 다르면 B01', () => {
    expect(codes(parseBankCsv('word,grade\n사과,1\n').issues)).toContain('B01');
    expect(codes(parseBankCsv('word,grade,category,themes,note\n사과,1,general\n').issues)).toContain('B01');
  });

  it('형식·중복·등급·범주·범주별 최소 등급을 검사한다', () => {
    const issues = validateBank([
      word('사과'),
      word('사과'),
      word('사'),
      word('사과ㄱ'),
      word('포도', 6),
      { ...word('딸기'), category: 'fruit' as BankWord['category'] },
      word('작심삼일', 3, [], 'idiom'),
      word('광합성', 2, [], 'concept'),
    ]);
    expect(issues.filter((i) => i.code === 'B01')).toHaveLength(7);
  });

  it('문제가 없으면 빈 목록', () => {
    expect(validateBank(baseBank)).toEqual([]);
  });
});

// ── 전체 모음 ──

describe('validateCollection', () => {
  it('S01 빠진 번호는 개발 중 경고, release에서 오류', () => {
    const dev = validateCollection({ files: [example], bank: baseBank });
    expect(dev.find((i) => i.code === 'S01')?.level).toBe('warning');
    expect(hasErrors(dev)).toBe(false);
    const rel = validateCollection({ files: [example], bank: baseBank, release: true });
    expect(rel.find((i) => i.code === 'S01')?.level).toBe('error');
  });

  it('S01 번호 중복은 항상 오류', () => {
    const issues = validateCollection({ files: [example, example], bank: baseBank });
    expect(issues.some((i) => i.code === 'S01' && i.level === 'error')).toBe(true);
  });

  it('S02 주제 중복은 경고', () => {
    const issues = validateCollection({ files: [example, { ...example, number: 3 }], bank: baseBank });
    expect(issues.find((i) => i.code === 'S02')?.level).toBe('warning');
  });

  it('W03 같은 단계 안 재사용 금지', () => {
    const issues = validateCollection({
      files: [example, { ...example, number: 3, theme: '친구' }],
      bank: baseBank,
    });
    expect(errorCodes(issues)).toContain('W03');
  });

  it('W03 전체에서 3번 이상 쓰면 오류', () => {
    const p = (number: number, theme: string) => ({ ...example, number, theme });
    const bank = baseBank.map((w) => ({ ...w, grade: 1 }));
    // 다른 단계 세 곳에 같은 단어 (크기 오류는 무시하고 W03만 본다)
    const issues = validateCollection({ files: [p(2, '가'), p(12, '나'), p(22, '다')], bank });
    expect(issues.some((i) => i.code === 'W03' && i.message.includes('3번'))).toBe(true);
  });

  it('은행 문제도 함께 보고한다', () => {
    const issues = validateCollection({ files: [example], bank: [...baseBank, word('사')] });
    expect(codes(issues)).toContain('B01');
  });
});
